// An in-memory, contract-shaped stand-in for the Kofra API, for the console's demo mode.
// It answers the SDK through its `fetch` option, so the console calls the real SDK; only the
// transport is replaced. Responses follow vendor/openapi.json (checked by backend.spec.ts),
// errors use the codes and wording of vendor/errors.json. State lives in a DemoState that the
// caller persists (the console keeps it in a cookie), so each visitor has their own demo.
import catalogue from '../../vendor/errors.json';
import type { components } from '../../vendor/sdk/schema.ts';
import {
	DEMO_LIMITS,
	DEMO_WORKSPACE_CREATED_DAYS_AGO,
	SEED_BUCKETS,
	SEED_FILES,
	SEED_KEYS
} from './seed.ts';
import { type CompactGrant, type DemoState, fits } from './state.ts';

type S = components['schemas'];
export type Bucket = S['Bucket'];
export type AccessKey = S['AccessKey'];

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** Token the console's demo mode sends; the demo accepts any `kofra_tok_` token. */
export const DEMO_TOKEN = 'kofra_tok_demo';

export interface DemoOptions {
	/** Clock; tests pass a fixed one. */
	now?: () => number;
	/** The S3 endpoint shown to the visitor. */
	endpoint?: string;
	/** Builds the URL a presigned download points at. Defaults to the S3 endpoint. */
	downloadUrl?: (bucket: string, key: string, expiresAt: Date) => string;
	/** Absolute URL of the console page where an Owner confirms workspace deletion. */
	confirmDeletionUrl?: string;
	/** Most buckets the demo holds (the cookie has room for little more). */
	maxBuckets?: number;
	/** Most files a visitor can add. */
	maxUploads?: number;
}

/** A file or a folder in a bucket listing (a folder is a key prefix ending in "/"). */
export interface DemoListing {
	folders: { prefix: string; name: string }[];
	files: { key: string; name: string; size: number; type: string; modified: string }[];
}

/** Why a demo-only write was refused. */
export type DemoRefusal = 'bucket_not_found' | 'demo_full' | 'invalid_key';

type Problem = S['Problem'];
interface CatalogueEntry {
	code: string;
	status: number;
	title: string;
	retryable: boolean;
	hint: string;
	type: string;
	docs_url: string;
}
const ERRORS = new Map(
	(catalogue as { errors: CatalogueEntry[] }).errors.map((e) => [e.code, e] as const)
);

const BUCKET_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const iso = (ms: number) =>
	new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');
const sec = (ms: number) => Math.floor(ms / 1000);

/** A deterministic number in [0, 1) for a given integer, so a day's figures never change. */
function noise(n: number): number {
	const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
	return x - Math.floor(x);
}

function randomId(alphabet: string, length: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

class HttpProblem extends Error {
	constructor(
		readonly code: string,
		readonly detail: string,
		readonly fieldErrors?: S['FieldError'][],
		/** For 405: the methods the path accepts. */
		readonly allow?: string
	) {
		super(detail);
	}
}

export class DemoApi {
	readonly state: DemoState;
	/** True once a request changed the state; the caller then persists it. */
	dirty = false;
	readonly #now: () => number;
	readonly #endpoint: string;
	readonly #downloadUrl: (bucket: string, key: string, expiresAt: Date) => string;
	readonly #confirmUrl: string;
	readonly #maxBuckets: number;
	readonly #maxUploads: number;

	constructor(state: DemoState, options: DemoOptions = {}) {
		this.state = state;
		this.#now = options.now ?? Date.now;
		this.#endpoint = options.endpoint ?? 'https://s3.kofra.io';
		this.#downloadUrl =
			options.downloadUrl ??
			((bucket, key, expiresAt) =>
				`${this.#endpoint}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}?X-Amz-Expires=${Math.max(
					0,
					Math.round((expiresAt.getTime() - this.#now()) / 1000)
				)}&X-Amz-Signature=DEMO`);
		this.#confirmUrl = options.confirmDeletionUrl ?? 'https://console.kofra.app/settings';
		this.#maxBuckets = options.maxBuckets ?? 12;
		this.#maxUploads = options.maxUploads ?? 20;
	}

	/** A `fetch` for the SDK's `fetch` option. */
	fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const request = new Request(input, init);
		const requestId = `req_demo${randomId('abcdefghijklmnopqrstuvwxyz0123456789', 18)}`;
		try {
			const auth = request.headers.get('authorization') ?? '';
			if (!/^Bearer kofra_tok_[A-Za-z0-9_]{1,200}$/.test(auth))
				throw new HttpProblem('unauthenticated', 'The request has no valid API token.');
			const result = await this.#route(request);
			const headers = new Headers({ 'kofra-request-id': requestId });
			if (result.body === undefined) return new Response(null, { status: result.status, headers });
			headers.set('content-type', 'application/json');
			return new Response(JSON.stringify(result.body), { status: result.status, headers });
		} catch (err) {
			if (err instanceof HttpProblem) return problemResponse(err, requestId);
			if (err instanceof DemoLimit) throw err;
			// Anything else is a defect in the demo; answer as the API would, not with a throw.
			return problemResponse(new HttpProblem('internal_error', 'Something went wrong.'), requestId);
		}
	};

	/**
	 * A creation time in Unix seconds, later than every time handed out before (even for items
	 * since removed), so two changes in the same second still have a clear order: the event
	 * feed's cursor relies on it.
	 */
	#stamp(): number {
		const st = this.state;
		const latest = Math.max(
			st.t ?? 0,
			st.d,
			...st.b.map((b) => b[1]),
			...st.k.map((k) => k[3]),
			...st.o.map((o) => o[4])
		);
		st.t = Math.max(sec(this.#now()), latest + 1);
		return st.t;
	}

	// ---- Operations ------------------------------------------------------------------------

	async #route(req: Request): Promise<{ status: number; body?: unknown }> {
		const url = new URL(req.url);
		const path = url.pathname;
		const m = req.method;
		const q = url.searchParams;
		const body = async () => readJson(req);
		let match: RegExpExecArray | null;

		if (path === '/v1/account') {
			if (m === 'GET') {
				only(q, []);
				return { status: 200, body: this.account() };
			}
			if (m === 'DELETE') {
				only(q, ['dry_run']);
				return this.#deleteAccount(dryRun(q));
			}
		}
		if (path === '/v1/account/deletion/cancel' && m === 'POST') {
			only(q, []);
			// The operation takes no body; anything sent is an unknown field.
			if ((await req.text()).trim() !== '')
				throw new HttpProblem('unknown_field', 'This operation accepts no request body.');
			if (!this.state.d) throw new HttpProblem('deletion_not_requested', 'No deletion is pending.');
			this.state.d = 0;
			this.dirty = true;
			return { status: 200, body: this.account() };
		}
		if (path === '/v1/buckets') {
			if (m === 'GET') {
				only(q, ['limit', 'cursor']);
				return page(this.buckets(), q);
			}
			if (m === 'POST') {
				only(q, []);
				return this.#createBucket(await body());
			}
		}
		if ((match = /^\/v1\/buckets\/([^/]+)$/.exec(path))) {
			const name = pathParam(match[1]!, '#path/bucket', BUCKET_NAME);
			if (m === 'GET') {
				only(q, []);
				return { status: 200, body: this.#bucket(name) };
			}
			if (m === 'DELETE') {
				only(q, ['dry_run']);
				return this.#deleteBucket(name, dryRun(q));
			}
		}
		if (path === '/v1/keys') {
			if (m === 'GET') {
				only(q, ['limit', 'cursor']);
				return page(this.keys(), q);
			}
			if (m === 'POST') {
				only(q, []);
				return this.#createKey(await body());
			}
		}
		if ((match = /^\/v1\/keys\/([^/]+)$/.exec(path))) {
			const id = pathParam(match[1]!, '#path/key_id', /^[A-Z0-9]{16,128}$/);
			if (m === 'PATCH') {
				only(q, []);
				return this.#updateKey(id, await body());
			}
			if (m === 'DELETE') {
				only(q, ['dry_run']);
				return this.#revokeKey(id, dryRun(q));
			}
		}
		if (path === '/v1/usage' && m === 'GET') {
			only(q, []);
			return { status: 200, body: this.usage() };
		}
		if (path === '/v1/usage/days' && m === 'GET') {
			only(q, ['after', 'limit', 'cursor']);
			const after = q.get('after');
			if (after !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(after) || !isDate(after)))
				throw invalid('/after', 'Must be a date (YYYY-MM-DD).');
			return page(
				this.usageDays().filter((d) => after === null || d.day > after),
				q
			);
		}
		if (path === '/v1/usage/buckets' && m === 'GET') {
			only(q, ['limit', 'cursor']);
			const asOf = iso(this.#now());
			return page(
				this.buckets().map((b) => ({
					bucket: b.name,
					stored_bytes: b.stored_bytes,
					object_count: b.object_count,
					as_of: asOf
				})),
				q
			);
		}
		if (path === '/v1/events' && m === 'GET') {
			only(q, ['limit', 'cursor']);
			const limit = limitOf(q);
			const events = this.events();
			const cursor = q.get('cursor');
			// The cursor holds the time and ID of the last event delivered; the next page starts
			// after that position, so events removed since (a revoked key) shift nothing.
			const pos = (e: S['Event']) => [Date.parse(e.created_at), e.id] as const;
			const after = (e: S['Event'], t: number, id: string) => {
				const [et, eid] = pos(e);
				return et > t || (et === t && eid > id);
			};
			let rest = events;
			if (cursor !== null) {
				const c = /^e_(\d{1,15})_(evt_[a-z0-9]{1,64})$/.exec(cursor);
				if (!c) throw new HttpProblem('invalid_cursor', 'The cursor is not one this list issued.');
				rest = events.filter((e) => after(e, Number(c[1]), c[2]!));
			}
			const data = rest.slice(0, limit);
			const last = data.at(-1);
			// The feed always hands back a position to poll from.
			const next = last ? `e_${pos(last)[0]}_${last.id}` : (cursor ?? 'e_0_evt_0');
			return { status: 200, body: { data, next_cursor: next } };
		}
		if (path === '/v1/objects/presign' && m === 'POST') {
			only(q, []);
			return this.#presign(await body());
		}
		const allow = allowedMethods(path);
		if (allow)
			throw new HttpProblem('method_not_allowed', `${m} is not allowed here.`, undefined, allow);
		throw new HttpProblem('not_found', `No operation answers ${m} ${path}.`);
	}

	account(): S['Account'] {
		const now = this.#now();
		const requested = this.state.d * 1000;
		return {
			id: 'ws_demo0workspace',
			state: 'active',
			access: 'full',
			s3_endpoint: this.#endpoint,
			limits: { ...DEMO_LIMITS },
			suspension: null,
			deletion: this.state.d
				? {
						status: 'pending_confirmation',
						reason: 'customer',
						requested_at: iso(requested),
						confirm_url: this.#confirmUrl,
						confirm_by: iso(requested + 7 * DAY),
						erase_at: null
					}
				: null,
			created_at: iso(now - DEMO_WORKSPACE_CREATED_DAYS_AGO * DAY)
		};
	}

	#deleteAccount(dry: boolean) {
		if (this.state.d)
			throw new HttpProblem('deletion_already_requested', 'Deletion is already pending.');
		const buckets = this.buckets();
		const keys = this.keys();
		const totals = {
			buckets: buckets.length,
			objects: buckets.reduce((n, b) => n + b.object_count, 0),
			stored_bytes: buckets.reduce((n, b) => n + b.stored_bytes, 0),
			keys: keys.length
		};
		if (dry)
			return {
				status: 200,
				body: {
					dry_run: true,
					operation: 'account.delete',
					summary: `Requests deletion of this workspace: ${totals.buckets} buckets, ${totals.objects} objects and ${totals.keys} access keys. An Owner must confirm in the console within 7 days; after that, the data is erased when the deletion window ends.`,
					reversible: true,
					effects: [{ resource: 'account', id: 'ws_demo0workspace', change: 'delete' }],
					totals
				} satisfies S['Plan']
			};
		this.state.d = this.#stamp();
		this.dirty = true;
		return { status: 202, body: this.account().deletion };
	}

	buckets(): Bucket[] {
		const now = this.#now();
		const uploads = (name: string) => this.state.o.filter((o) => o[0] === name);
		const sum = (name: string) => uploads(name).reduce((n, o) => n + o[2], 0);
		// An upload over a sample file replaces it: its bytes and count leave the seed totals.
		const replaced = (name: string) => {
			const keys = new Set(uploads(name).map((o) => o[1]));
			return seedFiles(name).filter(([key]) => keys.has(key));
		};
		const list: Bucket[] = [
			...SEED_BUCKETS.filter((b) => !this.state.xb.includes(b.name)).map((b) => ({
				name: b.name,
				created_at: iso(now - b.createdDaysAgo * DAY),
				stored_bytes: b.storedBytes + sum(b.name) - replaced(b.name).reduce((n, f) => n + f[1], 0),
				object_count: b.objectCount + uploads(b.name).length - replaced(b.name).length
			})),
			...this.state.b.map(([name, created]) => ({
				name,
				created_at: iso(created * 1000),
				stored_bytes: sum(name),
				object_count: uploads(name).length
			}))
		];
		return list.sort((a, b) => a.name.localeCompare(b.name));
	}

	#bucket(name: string): Bucket {
		const b = this.buckets().find((x) => x.name === name);
		if (!b) throw new HttpProblem('bucket_not_found', `There is no bucket "${name}".`);
		return b;
	}

	#createBucket(input: unknown) {
		const body = object(input, ['name'], ['name']);
		const name = body.name;
		if (typeof name !== 'string') throw invalid('/name', 'Must be a string.');
		if (!BUCKET_NAME.test(name))
			throw new HttpProblem(
				'invalid_bucket_name',
				`"${name}" is not a valid bucket name: use 3 to 63 lowercase letters, digits or hyphens, starting and ending with a letter or digit.`
			);
		if (this.buckets().some((b) => b.name === name))
			throw new HttpProblem('bucket_already_exists', `A bucket named "${name}" already exists.`);
		if (this.buckets().length >= this.#maxBuckets)
			throw new DemoLimit(`The demo holds at most ${this.#maxBuckets} buckets.`);
		this.state.b.push([name, this.#stamp()]);
		if (!fits(this.state)) {
			this.state.b.pop();
			throw new DemoLimit('The demo has no room for another bucket.');
		}
		this.dirty = true;
		return { status: 201, body: this.#bucket(name) };
	}

	#deleteBucket(name: string, dry: boolean) {
		const b = this.#bucket(name);
		if (b.object_count > 0)
			throw new HttpProblem(
				'bucket_not_empty',
				`Bucket "${name}" still holds ${b.object_count.toLocaleString('en-US')} objects.`
			);
		if (dry)
			return {
				status: 200,
				body: {
					dry_run: true,
					operation: 'buckets.delete',
					summary: `Deletes the empty bucket "${name}". This cannot be undone.`,
					reversible: false,
					effects: [{ resource: 'bucket', id: name, change: 'delete' }],
					totals: { buckets: 1, objects: 0, stored_bytes: 0, keys: 0 }
				} satisfies S['Plan']
			};
		const added = this.state.b.findIndex(([n]) => n === name);
		if (added >= 0) this.state.b.splice(added, 1);
		else this.state.xb.push(name);
		this.state.o = this.state.o.filter((o) => o[0] !== name);
		// Deleting a bucket removes every grant on it. (Seed keys reach only seed buckets, which
		// hold files and so can never be deleted.)
		for (const k of this.state.k) k[2] = k[2].filter(([bucket]) => bucket !== name);
		this.dirty = true;
		return { status: 204 };
	}

	keys(): AccessKey[] {
		const now = this.#now();
		const expand = (g: CompactGrant[]) =>
			g.map(([bucket, a]) => ({
				bucket,
				access: a === 'rw' ? ('read_write' as const) : ('read' as const)
			}));
		const list: (AccessKey & { _t: number })[] = [
			...SEED_KEYS.filter((k) => !this.state.xk.includes(k.id)).map((k) => ({
				id: k.id,
				name: k.name,
				grants: k.grants.map((g) => ({ ...g })),
				created_at: iso(now - k.createdDaysAgo * DAY),
				last_used_at: k.lastUsedHoursAgo === null ? null : iso(now - k.lastUsedHoursAgo * HOUR),
				_t: now - k.createdDaysAgo * DAY
			})),
			...this.state.k.map(([id, name, grants, created]) => ({
				id,
				name,
				grants: expand(grants),
				created_at: iso(created * 1000),
				last_used_at: null,
				_t: created * 1000
			}))
		];
		return list.sort((a, b) => b._t - a._t).map(({ _t, ...k }) => (void _t, k));
	}

	#grants(input: unknown, pointer: string): CompactGrant[] {
		if (!Array.isArray(input) || input.length < 1 || input.length > 32)
			throw invalid(pointer, 'Give 1 to 32 grants.');
		const seen = new Set<string>();
		const existing = new Set(this.buckets().map((b) => b.name));
		return input.map((g, i) => {
			const o = object(g, ['bucket', 'access'], ['bucket', 'access'], `${pointer}/${i}`);
			if (typeof o.bucket !== 'string' || !BUCKET_NAME.test(o.bucket))
				throw invalid(`${pointer}/${i}/bucket`, 'Must be a bucket name.');
			if (o.access !== 'read' && o.access !== 'read_write')
				throw invalid(`${pointer}/${i}/access`, 'Must be "read" or "read_write".');
			if (seen.has(o.bucket)) throw invalid(`${pointer}/${i}/bucket`, 'Each bucket at most once.');
			seen.add(o.bucket);
			if (!existing.has(o.bucket))
				throw new HttpProblem('bucket_not_found', `There is no bucket "${o.bucket}".`);
			return [o.bucket, o.access === 'read_write' ? 'rw' : 'r'];
		});
	}

	#createKey(input: unknown) {
		const body = object(input, ['name', 'grants'], ['grants']);
		const name = keyName(body.name);
		const grants = this.#grants(body.grants, '/grants');
		if (this.keys().length >= DEMO_LIMITS.active_keys)
			throw new HttpProblem(
				'key_limit_reached',
				`The workspace already has ${DEMO_LIMITS.active_keys} active keys.`
			);
		const id = `KF${randomId('ABCDEFGHJKLMNPQRSTUVWXYZ0123456789', 14)}`;
		this.state.k.push([id, name, grants, this.#stamp()]);
		if (!fits(this.state)) {
			this.state.k.pop();
			throw new DemoLimit('The demo has no room for another key.');
		}
		this.dirty = true;
		const key = this.keys().find((k) => k.id === id)!;
		// The secret exists only in this response; nothing keeps it.
		const secret = randomId('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 40);
		return {
			status: 201,
			body: {
				...key,
				secret_access_key: secret,
				s3_endpoint: this.#endpoint
			} satisfies S['AccessKeyCreated']
		};
	}

	#updateKey(id: string, input: unknown) {
		const body = object(input, ['name', 'grants'], []);
		if (Object.keys(body).length === 0) throw invalid('', 'Give `name`, `grants` or both.');
		const current = this.keys().find((k) => k.id === id);
		if (!current) throw new HttpProblem('key_not_found', `There is no access key ${id}.`);
		// Work on copies: a refused edit must change nothing.
		const name = body.name !== undefined ? keyName(body.name) : current.name;
		const grants: CompactGrant[] = current.grants.map((g) => [
			g.bucket,
			g.access === 'read_write' ? 'rw' : 'r'
		]);
		if (body.grants !== undefined) {
			for (const [bucket, access] of this.#grants(body.grants, '/grants')) {
				const had = grants.find((g) => g[0] === bucket);
				if (had && had[1] === 'rw' && access === 'r')
					throw new HttpProblem(
						'grant_narrowing_refused',
						`The key already has read and write access to "${bucket}".`
					);
				if (had) had[1] = access;
				else grants.push([bucket, access]);
			}
			if (grants.length > 32)
				throw new HttpProblem('grant_limit_reached', 'A key holds at most 32 grants.');
		}
		// A seed key is copied into the state the first time it changes.
		const before = { k: this.state.k, xk: this.state.xk };
		const created = sec(Date.parse(current.created_at));
		this.state.k = [...this.state.k.filter((k) => k[0] !== id), [id, name, grants, created]];
		if (SEED_KEYS.some((k) => k.id === id) && !this.state.xk.includes(id))
			this.state.xk = [...this.state.xk, id];
		if (!fits(this.state)) {
			this.state.k = before.k;
			this.state.xk = before.xk;
			throw new DemoLimit('The demo has no room for this change.');
		}
		this.dirty = true;
		return { status: 200, body: this.keys().find((k) => k.id === id) };
	}

	#revokeKey(id: string, dry: boolean) {
		const key = this.keys().find((k) => k.id === id);
		if (!key) throw new HttpProblem('key_not_found', `There is no access key ${id}.`);
		if (dry) {
			const n = key.grants.length;
			return {
				status: 200,
				body: {
					dry_run: true,
					operation: 'keys.revoke',
					summary: `Revokes access key ${id}${key.name ? ` ("${key.name}")` : ''}, which can reach ${n} bucket${n === 1 ? '' : 's'}. This cannot be undone.`,
					reversible: false,
					effects: [{ resource: 'key', id, change: 'revoke' }],
					totals: { buckets: 0, objects: 0, stored_bytes: 0, keys: 1 }
				} satisfies S['Plan']
			};
		}
		const added = this.state.k.findIndex((k) => k[0] === id);
		if (added >= 0) this.state.k.splice(added, 1);
		if (SEED_KEYS.some((k) => k.id === id) && !this.state.xk.includes(id)) this.state.xk.push(id);
		this.dirty = true;
		return { status: 204 };
	}

	/** Daily figures for the last 30 days, oldest first; the last two days are provisional. */
	usageDays(): S['UsageDay'][] {
		const now = this.#now();
		const today = Math.floor(now / DAY);
		// History comes from the sample workspace plus the visitor's uploads up to each day, so
		// a new upload changes today's figures only, never a day already marked final.
		const seedStored = SEED_BUCKETS.reduce((n, b) => n + b.storedBytes, 0);
		const uploadedBy = (end: number) =>
			this.state.o.filter((o) => o[4] * 1000 < end).reduce((n, o) => n + o[2], 0);
		const days: S['UsageDay'][] = [];
		for (let i = 29; i >= 0; i--) {
			const d = today - i;
			const r = noise(d);
			const end = (d + 1) * DAY;
			days.push({
				day: new Date(d * DAY).toISOString().slice(0, 10),
				status: i <= 1 ? 'provisional' : 'final',
				peak_stored_bytes:
					Math.max(0, Math.round(seedStored - i * 1.35e9 - r * 0.6e9)) + uploadedBy(end),
				uploaded_bytes: Math.round(1.1e9 + r * 4.8e9) + uploadedBy(end) - uploadedBy(d * DAY),
				downloaded_bytes: Math.round(
					1.8e9 + noise(d + 7) * 15e9 * (new Date(d * DAY).getUTCDay() % 6 === 0 ? 0.4 : 1)
				),
				requests_approx: Math.round(9000 + noise(d + 3) * 31000)
			});
		}
		return days;
	}

	usage(): S['Usage'] {
		const now = this.#now();
		const buckets = this.buckets();
		const stored = buckets.reduce((n, b) => n + b.stored_bytes, 0);
		const days = this.usageDays();
		const start = new Date(now);
		const periodStart = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);
		const downloaded = days
			.filter((d) => Date.parse(d.day) >= periodStart)
			.reduce((n, d) => n + d.downloaded_bytes, 0);
		const uploadedToday = days.at(-1)?.uploaded_bytes ?? 0;
		const allowance = DEMO_LIMITS.download_allowance_bytes;
		return {
			as_of: iso(now),
			stored_bytes: stored,
			object_count: buckets.reduce((n, b) => n + b.object_count, 0),
			storage_limit_bytes: DEMO_LIMITS.storage_bytes,
			over_limit: null,
			upload_24h: {
				limit_bytes: DEMO_LIMITS.upload_24h_bytes,
				used_bytes: uploadedToday,
				remaining_bytes: Math.max(0, DEMO_LIMITS.upload_24h_bytes - uploadedToday),
				resets_at: iso((Math.floor(now / DAY) + 1) * DAY)
			},
			downloads: {
				period_start: iso(periodStart),
				allowance_bytes: allowance,
				used_bytes: downloaded,
				over_bytes: Math.max(0, downloaded - allowance)
			},
			open_uploads: { count: 0, limit: 1000 }
		};
	}

	/** The event feed, oldest first. */
	/**
	 * The event feed, oldest first. Seed events are anchored to the start of the current UTC
	 * day and every ID derives from the event itself, so a saved cursor stays valid.
	 */
	events(): S['Event'][] {
		const day0 = Math.floor(this.#now() / DAY) * DAY;
		const out: { t: number; type: string; subject: string; data: Record<string, unknown> }[] = [];
		for (const b of SEED_BUCKETS)
			out.push({
				t: day0 - b.createdDaysAgo * DAY,
				type: 'bucket.created',
				subject: b.name,
				data: { bucket: b.name }
			});
		for (const k of SEED_KEYS)
			out.push({
				t: day0 - k.createdDaysAgo * DAY + HOUR,
				type: 'key.created',
				subject: k.id,
				data: { key_id: k.id }
			});
		for (const [name, t] of this.state.b)
			out.push({ t: t * 1000, type: 'bucket.created', subject: name, data: { bucket: name } });
		for (const [id, , , t] of this.state.k)
			// An edited seed key is copied into the state; its creation event is the seed one.
			if (!SEED_KEYS.some((k) => k.id === id))
				out.push({ t: t * 1000, type: 'key.created', subject: id, data: { key_id: id } });
		if (this.state.d)
			out.push({
				t: this.state.d * 1000,
				type: 'account.deletion_requested',
				subject: 'ws',
				data: {}
			});
		return out
			.map((e) => ({
				id: `evt_${e.t.toString(36)}${e.type.replace(/[^a-z]/g, '').slice(0, 12)}${e.subject.toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(
					0,
					68
				),
				type: e.type,
				created_at: iso(e.t),
				data: e.data
			}))
			.sort((x, y) =>
				x.created_at === y.created_at
					? x.id < y.id
						? -1
						: 1
					: x.created_at < y.created_at
						? -1
						: 1
			);
	}

	#presign(input: unknown) {
		const body = object(
			input,
			['bucket', 'key', 'method', 'expires_in_seconds'],
			['bucket', 'key', 'method']
		);
		if (typeof body.bucket !== 'string') throw invalid('/bucket', 'Must be a bucket name.');
		if (
			typeof body.key !== 'string' ||
			body.key.length < 1 ||
			body.key.length > 1024 ||
			!wellFormed(body.key)
		)
			throw invalid('/key', 'Must be 1 to 1024 characters of valid text.');
		if (body.method !== 'GET') throw invalid('/method', 'Only "GET" is offered.');
		const ttl = body.expires_in_seconds === undefined ? 900 : body.expires_in_seconds;
		if (typeof ttl !== 'number' || !Number.isInteger(ttl) || ttl < 1 || ttl > 900)
			throw invalid('/expires_in_seconds', 'Must be 1 to 900.');
		this.#bucket(body.bucket);
		const expires = new Date(Math.floor((this.#now() + ttl * 1000) / 1000) * 1000);
		return {
			status: 200,
			body: {
				method: 'GET',
				url: this.#downloadUrl(body.bucket, body.key, expires),
				expires_at: iso(expires.getTime())
			} satisfies S['PresignedUrl']
		};
	}

	// ---- Files (not in the contract yet; the console lists files through S3) ---------------

	/** Files and folders directly under `prefix` (which is "" or ends in "/"), or null. */
	listFiles(bucket: string, prefix: string): DemoListing | null {
		if (!this.buckets().some((b) => b.name === bucket)) return null;
		const now = this.#now();
		const all = [
			...(this.state.xb.includes(bucket) ? [] : seedFiles(bucket)).map(
				([key, size, type, days]) => ({
					key,
					size,
					type,
					modified: iso(now - days * DAY)
				})
			),
			...this.state.o
				.filter((o) => o[0] === bucket)
				.map(([, key, size, type, t]) => ({ key, size, type, modified: iso(t * 1000) }))
		];
		const folders = new Map<string, { prefix: string; name: string }>();
		const files = new Map<string, DemoListing['files'][number]>();
		for (const f of all) {
			if (!f.key.startsWith(prefix)) continue;
			const rest = f.key.slice(prefix.length);
			const slash = rest.indexOf('/');
			if (slash >= 0) {
				const name = rest.slice(0, slash);
				folders.set(name, { prefix: `${prefix}${name}/`, name });
			} else files.set(f.key, { ...f, name: rest });
		}
		const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
		return { folders: [...folders.values()].sort(byName), files: [...files.values()].sort(byName) };
	}

	/** Metadata of one file, or null. */
	file(bucket: string, key: string) {
		const slash = key.lastIndexOf('/');
		const listing = this.listFiles(bucket, slash >= 0 ? key.slice(0, slash + 1) : '');
		return listing?.files.find((f) => f.key === key) ?? null;
	}

	/** Records a finished upload; the bytes themselves are not kept. */
	recordUpload(bucket: string, key: string, size: number, type: string): DemoRefusal | null {
		if (!this.buckets().some((b) => b.name === bucket)) return 'bucket_not_found';
		if (!Number.isSafeInteger(size) || size < 0 || !wellFormed(key)) return 'invalid_key';
		if (
			key.length < 1 ||
			key.length > 1024 ||
			key.startsWith('/') ||
			key.endsWith('/') ||
			key.includes('//')
		)
			return 'invalid_key';
		const others = this.state.o.filter((o) => !(o[0] === bucket && o[1] === key));
		if (others.length >= this.#maxUploads) return 'demo_full';
		const before = this.state.o;
		this.state.o = [
			...others,
			[bucket, key, size, type.slice(0, 100) || 'application/octet-stream', this.#stamp()]
		];
		if (!fits(this.state)) {
			this.state.o = before;
			return 'demo_full';
		}
		this.dirty = true;
		return null;
	}
}

/** A demo-only refusal (the demo's own size limits); the console shows its message. */
export class DemoLimit extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DemoLimit';
	}
}

// ---- Helpers ---------------------------------------------------------------------------------

/** A real calendar date in YYYY-MM-DD form. */
function isDate(day: string): boolean {
	const t = Date.parse(`${day}T00:00:00Z`);
	return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === day;
}

/** The methods a known path accepts, or null for an unknown path. */
function allowedMethods(path: string): string | null {
	if (path === '/v1/account') return 'GET, DELETE';
	if (path === '/v1/account/deletion/cancel' || path === '/v1/objects/presign') return 'POST';
	if (path === '/v1/buckets' || path === '/v1/keys') return 'GET, POST';
	if (/^\/v1\/buckets\/[^/]+$/.test(path)) return 'GET, DELETE';
	if (/^\/v1\/keys\/[^/]+$/.test(path)) return 'PATCH, DELETE';
	if (['/v1/usage', '/v1/usage/days', '/v1/usage/buckets', '/v1/events'].includes(path))
		return 'GET';
	return null;
}

/** True when the text has no lone surrogate (it can be encoded as UTF-8). */
function wellFormed(s: string): boolean {
	try {
		encodeURIComponent(s);
		return true;
	} catch {
		return false;
	}
}

/** A decoded path parameter that matches its pattern, or a validation_failed problem. */
function pathParam(raw: string, pointer: string, pattern: RegExp): string {
	let value: string;
	try {
		value = decodeURIComponent(raw);
	} catch {
		throw invalid(pointer, 'Not a valid escaped path segment.');
	}
	if (!pattern.test(value)) throw invalid(pointer, 'Does not match the required pattern.');
	return value;
}

/** The sample files of a seed bucket; own properties only, so "constructor" is just a name. */
const seedFiles = (bucket: string) =>
	Object.hasOwn(SEED_FILES, bucket) ? SEED_FILES[bucket]! : [];

function problemResponse(err: HttpProblem, requestId: string): Response {
	const entry = ERRORS.get(err.code);
	if (!entry) throw new Error(`demo: no catalogue entry for ${err.code}`);
	const problem: Problem = {
		type: entry.type,
		title: entry.title,
		status: entry.status,
		code: entry.code,
		detail: err.detail,
		hint: entry.hint,
		docs_url: entry.docs_url,
		request_id: requestId,
		retryable: entry.retryable,
		...(err.fieldErrors ? { errors: err.fieldErrors } : {})
	};
	const headers = new Headers({
		'content-type': 'application/problem+json',
		'kofra-request-id': requestId
	});
	if (entry.status === 401) headers.set('www-authenticate', 'Bearer realm="kofra"');
	if (err.allow) headers.set('allow', err.allow);
	return new Response(JSON.stringify(problem), { status: entry.status, headers });
}

const invalid = (pointer: string, detail: string) =>
	new HttpProblem('validation_failed', 'The request is not valid.', [
		{ pointer, code: 'invalid', detail }
	]);

/** Refuses query parameters the operation does not declare. */
function only(q: URLSearchParams, allowed: string[]) {
	for (const name of new Set(q.keys())) {
		if (!allowed.includes(name))
			throw new HttpProblem(
				'unknown_field',
				`The query parameter "${name}" is not accepted here.`,
				[{ pointer: `/${name}`, code: 'unknown', detail: 'Not a parameter of this operation.' }]
			);
		if (q.getAll(name).length > 1) throw invalid(`/${name}`, 'Give this parameter once.');
	}
}

function dryRun(q: URLSearchParams): boolean {
	const v = q.get('dry_run');
	if (v === null || v === 'false') return false;
	if (v === 'true') return true;
	throw invalid('/dry_run', 'Must be true or false.');
}

async function readJson(req: Request): Promise<unknown> {
	const media = (req.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
	if (media !== 'application/json')
		throw new HttpProblem('unsupported_media_type', 'Send the body as application/json.');
	const text = await req.text();
	if (text.length > 64 * 1024)
		throw new HttpProblem('payload_too_large', 'The body is over 64 KiB.');
	try {
		return JSON.parse(text);
	} catch {
		throw invalid('', 'The body is not valid JSON.');
	}
}

/** A JSON object with only the `allowed` fields and every `required` one. */
function object(
	input: unknown,
	allowed: string[],
	required: string[],
	pointer = ''
): Record<string, unknown> {
	if (typeof input !== 'object' || input === null || Array.isArray(input))
		throw invalid(pointer, 'Must be a JSON object.');
	const o = input as Record<string, unknown>;
	for (const k of Object.keys(o))
		if (!allowed.includes(k))
			throw new HttpProblem('unknown_field', `The field "${k}" is not accepted here.`, [
				{ pointer: `${pointer}/${k}`, code: 'unknown', detail: 'Not a field of this request.' }
			]);
	for (const k of required) if (o[k] === undefined) throw invalid(`${pointer}/${k}`, 'Required.');
	return o;
}

function keyName(v: unknown): string | null {
	if (v === undefined) return null;
	if (typeof v !== 'string' || v.length < 1 || v.length > 64)
		throw invalid('/name', 'Must be 1 to 64 characters.');
	return v;
}

/** One page of a list, with an offset cursor. */
function limitOf(q: URLSearchParams): number {
	const limitRaw = q.get('limit');
	if (limitRaw !== null && !/^\d{1,3}$/.test(limitRaw))
		throw invalid('/limit', 'Must be 1 to 200.');
	const limit = limitRaw === null ? 50 : Number(limitRaw);
	if (!Number.isInteger(limit) || limit < 1 || limit > 200)
		throw invalid('/limit', 'Must be 1 to 200.');
	return limit;
}

function page<T>(items: T[], q: URLSearchParams) {
	const limit = limitOf(q);
	const cursor = q.get('cursor');
	let start = 0;
	if (cursor !== null) {
		const m = /^c(\d{1,9})$/.exec(cursor);
		if (!m) throw new HttpProblem('invalid_cursor', 'The cursor is not one this list issued.');
		start = Number(m[1]);
	}
	const data = items.slice(start, start + limit);
	const next = start + limit < items.length ? `c${start + limit}` : null;
	return { status: 200, body: { data, next_cursor: next } };
}
