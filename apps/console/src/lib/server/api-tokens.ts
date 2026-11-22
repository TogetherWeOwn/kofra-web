import { KofraError } from '@kofra/api';
import { error, type RequestEvent } from '@sveltejs/kit';

export interface ApiToken {
	id: string;
	name: string;
	scopes: string[];
	buckets: string[] | null;
	allowed_ips: string[] | null;
	agent: boolean;
	created_by: string;
	created_at: string;
	expires_at: string | null;
	last_used_at: string | null;
}

export interface ApiTokenCreate {
	name: string;
	scopes: string[];
	buckets?: string[];
	allowed_ips?: string[];
	expires_in_days?: number;
	agent?: boolean;
}

export type ApiTokenCreated = ApiToken & { token: string | null };

export interface TokensPort {
	list(): Promise<ApiToken[]>;
	create(input: ApiTokenCreate): Promise<ApiTokenCreated>;
	revoke(id: string): Promise<void>;
}

const lists = new Map<string, Map<string, ApiToken>>();
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function randomBase62(length: number) {
	let result = '';
	while (result.length < length) {
		for (const byte of crypto.getRandomValues(new Uint8Array(length - result.length))) {
			// Rejection sampling avoids bias because 256 is not a multiple of 62.
			if (byte < 248) result += alphabet[byte % 62];
		}
	}
	return result;
}

const COOKIE = 'kofra_token_visitor';
/** Most visitors kept in memory; the oldest are dropped first (sample data only). */
const MAX_VISITORS = 1000;

function visitorOf(cookies: RequestEvent['cookies']) {
	const v = cookies.get(COOKIE);
	return v && /^[a-zA-Z0-9]{32}$/.test(v) ? v : null;
}

/** Forgets the visitor's sample tokens (used by "Reset demo data"). */
export function resetSampleTokens({ cookies, url }: RequestEvent) {
	const visitor = visitorOf(cookies);
	if (visitor) lists.delete(visitor);
	cookies.delete(COOKIE, {
		path: '/',
		secure: url.protocol === 'https:',
		httpOnly: true,
		sameSite: 'lax'
	});
}

/** Most pages of tokens read for one list (100 each; a workspace has far fewer). */
const MAX_PAGES = 10;

/**
 * The API's `tokens.list`, `tokens.create` and `tokens.revoke` over the live transport. The
 * vendored SDK predates these operations, so they are called directly. An error answer throws
 * a `KofraError`, as the SDK does, so each route handles it as it handles SDK errors: an error
 * page for a load, the form's problem for an action.
 */
export function liveTokensPort(apiFetch: NonNullable<App.Locals['apiFetch']>): TokensPort {
	const call = async (method: string, path: string, body?: unknown, key?: string) => {
		const headers = new Headers();
		if (body !== undefined) headers.set('Content-Type', 'application/json');
		if (key) headers.set('Idempotency-Key', key);
		const r = await apiFetch(path, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		if (r.status === 204) return null;
		const data: unknown = await r.json().catch(() => null);
		if (!r.ok) {
			const p = (data ?? {}) as Record<string, unknown>;
			throw new KofraError({
				type: typeof p.type === 'string' ? p.type : 'about:blank',
				status: r.status,
				code: typeof p.code === 'string' ? p.code : 'internal_error',
				title: typeof p.title === 'string' ? p.title : 'Error',
				detail: typeof p.detail === 'string' ? p.detail : 'The request was refused.',
				hint: typeof p.hint === 'string' ? p.hint : '',
				docs_url: typeof p.docs_url === 'string' ? p.docs_url : '',
				request_id:
					typeof p.request_id === 'string'
						? p.request_id
						: (r.headers.get('Kofra-Request-Id') ?? ''),
				retryable: p.retryable === true
			});
		}
		return data;
	};
	return {
		async list() {
			const all: ApiToken[] = [];
			let cursor: string | null = null;
			for (let i = 0; i < MAX_PAGES; i++) {
				const q = new URLSearchParams({ limit: '100' });
				if (cursor) q.set('cursor', cursor);
				const page = (await call('GET', `/v1/tokens?${q}`)) as {
					data: ApiToken[];
					next_cursor: string | null;
				};
				all.push(...page.data);
				cursor = page.next_cursor;
				if (!cursor) break;
			}
			return all;
		},
		async create(input) {
			// One key per click: a retry inside the transport cannot make a second token.
			return (await call('POST', '/v1/tokens', input, crypto.randomUUID())) as ApiTokenCreated;
		},
		async revoke(id) {
			if (!/^tok_[A-Za-z0-9]+$/.test(id))
				error(404, { message: 'That token is no longer available.' });
			await call('DELETE', `/v1/tokens/${id}`);
		}
	};
}

export function tokensPort({ locals, cookies, url }: RequestEvent): TokensPort {
	if (locals.mode === 'live' && locals.apiFetch) return liveTokensPort(locals.apiFetch);
	// Sample tokens only (demo and live-fake).
	if (locals.mode !== 'demo' && locals.mode !== 'live-fake')
		error(503, { message: 'API tokens are not available yet.' });

	const creator = locals.me?.user.id ?? 'demo';
	const prefix = `${creator}/${locals.member?.id ?? ''}/`;
	// Reading allocates nothing: a visitor gets a list only when they create a token.
	const existing = () => {
		const visitor = visitorOf(cookies);
		return visitor ? lists.get(visitor) : undefined;
	};
	const writable = () => {
		let visitor = visitorOf(cookies);
		if (!visitor || !lists.has(visitor)) {
			visitor = randomBase62(32);
			cookies.set(COOKIE, visitor, {
				path: '/',
				httpOnly: true,
				secure: url.protocol === 'https:',
				sameSite: 'lax'
			});
			if (lists.size >= MAX_VISITORS) lists.delete(lists.keys().next().value!);
			lists.set(visitor, new Map());
		}
		return lists.get(visitor)!;
	};
	return {
		async list() {
			return Array.from(existing() ?? [])
				.filter(([key]) => key.startsWith(prefix))
				.map(([, token]) => token);
		},
		async create(input) {
			const list = writable();
			const id = randomBase62(26);
			const created: ApiToken = {
				id,
				name: input.name,
				scopes: input.scopes,
				buckets: input.buckets ?? null,
				allowed_ips: input.allowed_ips ?? null,
				agent: input.agent ?? false,
				created_by: creator,
				created_at: new Date().toISOString(),
				expires_at: input.expires_in_days
					? new Date(Date.now() + input.expires_in_days * 86_400_000).toISOString()
					: null,
				last_used_at: null
			};
			list.set(prefix + id, created);
			return { ...created, token: `kofra_tok_${id}_${randomBase62(46)}` };
		},
		async revoke(id) {
			if (!existing()?.delete(prefix + id))
				error(404, { message: 'That token is no longer available.' });
		}
	};
}
