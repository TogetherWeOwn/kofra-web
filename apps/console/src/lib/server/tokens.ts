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

export function tokensPort({ locals, cookies, url }: RequestEvent): TokensPort {
	// Connect the live port to the SDK here once its token endpoints are released.
	if (locals.mode === 'live') error(503, { message: 'API tokens are not available yet.' });

	const cookieName = 'kofra_token_visitor';
	let visitor = cookies.get(cookieName);
	if (!visitor || !/^[a-zA-Z0-9]{32}$/.test(visitor) || !lists.has(visitor)) {
		visitor = randomBase62(32);
		cookies.set(cookieName, visitor, {
			path: '/',
			httpOnly: true,
			secure: url.protocol === 'https:',
			sameSite: 'lax'
		});
		lists.set(visitor, new Map());
	}
	const list = lists.get(visitor)!;
	const creator = locals.me?.user.id ?? 'demo';
	const prefix = `${creator}/${locals.workspace?.id ?? ''}/`;
	return {
		async list() {
			return Array.from(list)
				.filter(([key]) => key.startsWith(prefix))
				.map(([, token]) => token);
		},
		async create(input) {
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
			if (!list.delete(prefix + id)) error(404, { message: 'That token is no longer available.' });
		}
	};
}
