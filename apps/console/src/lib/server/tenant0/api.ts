// The tenant0 transport: answers the Kofra API contract (vendor/openapi.json) for the
// operator's own storage account, from the storage service's admin API and S3 API. The
// console calls it through the real SDK, exactly as it calls the demo transport; when the
// Kofra API exists, the SDK is pointed at it and this file is deleted.
//
// Where tenant 0 differs from the API, see docs/console-owner-workspace.md, section 4.
import catalogue from '@kofra/api/errors.json';
import type { components } from '@kofra/api';
import type { Tenant0Config } from '../config.js';
import { StorageError, type KeySummary, type Perm, type StorageClient } from '../storage/client.js';

type S = components['schemas'];
type Problem = S['Problem'];

/** The token the console's SDK sends to this transport; it never leaves the Worker. */
export const LOCAL_TOKEN = 'kofra_tok_tenant0';
export const WORKSPACE_ID = 'ws_0';

const BUCKET_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const KEY_ID = /^[A-Z0-9]{16,128}$/;
const PRESIGN_MAX = 900;
const MAX_GRANTS = 32;

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

/** An answer in the contract's error shape. */
export class HttpProblem extends Error {
	constructor(
		readonly code: string,
		readonly detail: string,
		readonly fieldErrors?: S['FieldError'][],
		readonly allow?: string
	) {
		super(detail);
	}
}

const invalid = (pointer: string, detail: string) =>
	new HttpProblem('validation_failed', 'The request is not valid.', [
		{ pointer, code: 'invalid', detail }
	]);

/** RFC 3339 in UTC without fractions, as the contract writes timestamps. */
export const iso = (ms: number) =>
	new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');

const fromPerm = (p: Perm): S['Grant']['access'] => (p === 'rw' ? 'read_write' : 'read');
const toPerm = (a: string): Perm | null => (a === 'read_write' ? 'rw' : a === 'read' ? 'ro' : null);

/** Maps a storage refusal to the contract's codes. Never passes on the service's own words. */
export function mapStorage(
	err: unknown,
	subject: { bucket?: string; key?: string } = {}
): HttpProblem {
	if (err instanceof HttpProblem) return err;
	if (err instanceof StorageError) {
		switch (err.code) {
			case 'NoSuchBucket':
				return new HttpProblem('bucket_not_found', `There is no bucket "${subject.bucket ?? ''}".`);
			case 'NoSuchAccessKey':
				return new HttpProblem('key_not_found', `There is no access key "${subject.key ?? ''}".`);
			case 'BucketAlreadyExists':
				return new HttpProblem(
					'bucket_already_exists',
					`The name "${subject.bucket ?? ''}" is taken.`
				);
			case 'InvalidBucketName':
				return new HttpProblem('invalid_bucket_name', 'That is not a valid bucket name.');
			case 'BucketNotEmpty':
				return new HttpProblem(
					'bucket_not_empty',
					`The bucket "${subject.bucket ?? ''}" has held files before, so it is kept. An empty bucket costs nothing.`
				);
			case 'GrantNarrowingRefused':
				return new HttpProblem(
					'grant_narrowing_refused',
					'Access a key already has is never narrowed.'
				);
			case 'AccessDenied':
				return new HttpProblem(
					'role_forbidden',
					'The console is not allowed to do that in this bucket.'
				);
			case 'SlowDown':
			case 'ServiceUnavailable':
				return new HttpProblem('service_unavailable', 'Storage is busy. Try again in a minute.');
		}
		if (err.status === 429) return new HttpProblem('rate_limited', 'Too many requests.');
		if (err.status === 503)
			return new HttpProblem('service_unavailable', 'Storage is busy. Try again in a minute.');
		return new HttpProblem('internal_error', 'Something went wrong.');
	}
	if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError'))
		return new HttpProblem(
			'service_unavailable',
			'Storage did not answer in time. Try again in a minute.'
		);
	return new HttpProblem('internal_error', 'Something went wrong.');
}

function problemResponse(err: HttpProblem, requestId: string): Response {
	const entry = ERRORS.get(err.code) ?? ERRORS.get('internal_error')!;
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
	if (err.allow) headers.set('allow', err.allow);
	return new Response(JSON.stringify(problem), { status: entry.status, headers });
}

function only(q: URLSearchParams, allowed: string[]) {
	for (const name of q.keys())
		if (!allowed.includes(name))
			throw new HttpProblem('validation_failed', 'The request is not valid.', [
				{
					pointer: `/query/${name}`,
					code: 'unknown',
					detail: `${name} is not a parameter of this operation.`
				}
			]);
}

function limitOf(q: URLSearchParams, fallback = 100): number {
	const raw = q.get('limit');
	if (raw === null) return fallback;
	const n = Number(raw);
	if (!/^[0-9]{1,3}$/.test(raw) || n < 1 || n > 200)
		throw invalid('/query/limit', 'limit is 1 to 200.');
	return n;
}

/** One page of a list, with an offset cursor (`c<offset>`). */
function page<T>(all: T[], q: URLSearchParams) {
	const limit = limitOf(q);
	const cursor = q.get('cursor');
	let start = 0;
	if (cursor !== null) {
		const m = /^c([0-9]{1,9})$/.exec(cursor);
		if (!m) throw new HttpProblem('invalid_cursor', 'The cursor is not one this list issued.');
		start = Number(m[1]);
	}
	const data = all.slice(start, start + limit);
	const next = start + limit < all.length ? `c${start + limit}` : null;
	return { data, next_cursor: next };
}

const dryRun = (q: URLSearchParams) => {
	const v = q.get('dry_run');
	if (v === null || v === 'false') return false;
	if (v === 'true') return true;
	throw invalid('/query/dry_run', 'dry_run is true or false.');
};

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
	if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
		throw new HttpProblem('unsupported_media_type', 'Send the body as application/json.');
	const text = await request.text();
	if (text.length > 64 * 1024) throw new HttpProblem('payload_too_large', 'The body is too large.');
	try {
		const v: unknown = JSON.parse(text);
		if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('shape');
		return v as Record<string, unknown>;
	} catch {
		throw invalid('', 'The body is not a JSON object.');
	}
}

function known(body: Record<string, unknown>, fields: string[]) {
	for (const k of Object.keys(body))
		if (!fields.includes(k))
			throw new HttpProblem('unknown_field', `The field "${k}" is not part of this request.`, [
				{ pointer: `/${k}`, code: 'unknown', detail: `${k} is not a field of this request.` }
			]);
}

interface GrantInput {
	bucket: string;
	access: S['Grant']['access'];
}

function grantsOf(v: unknown, pointer = '/grants'): GrantInput[] {
	if (!Array.isArray(v) || v.length < 1 || v.length > MAX_GRANTS)
		throw invalid(pointer, `Give 1 to ${MAX_GRANTS} grants.`);
	const seen = new Set<string>();
	return v.map((g, i) => {
		const bucket = (g as { bucket?: unknown })?.bucket;
		const access = (g as { access?: unknown })?.access;
		if (typeof bucket !== 'string' || !BUCKET_NAME.test(bucket))
			throw invalid(`${pointer}/${i}/bucket`, 'Not a bucket name.');
		if (access !== 'read' && access !== 'read_write')
			throw invalid(`${pointer}/${i}/access`, 'access is read or read_write.');
		if (seen.has(bucket)) throw invalid(`${pointer}/${i}/bucket`, 'Each bucket at most once.');
		seen.add(bucket);
		return { bucket, access };
	});
}

/** Oldest bucket creation per isolate, so the layout's account read costs nothing. */
let createdCache: { at: number; value: string } | null = null;
const CREATED_TTL_MS = 10 * 60 * 1000;

export interface Tenant0Options {
	now?: () => number;
}

export class Tenant0Api {
	readonly #cfg: Tenant0Config;
	readonly #storage: StorageClient;
	readonly #now: () => number;
	// One read of each list per request: pages ask for the same lists in parallel.
	#keys: Promise<KeySummary[]> | null = null;
	#usage: Promise<{
		seeded: boolean;
		buckets: { name: string; live_objects: number; live_bytes: number }[];
	}> | null = null;
	#own: Promise<{ name: string; created: string }[]> | null = null;

	constructor(cfg: Tenant0Config, storage: StorageClient, options: Tenant0Options = {}) {
		this.#cfg = cfg;
		this.#storage = storage;
		this.#now = options.now ?? Date.now;
	}

	get consoleKeyId(): string {
		return this.#cfg.storage.keyId;
	}

	/** Every access key, read once per request. */
	keys(): Promise<KeySummary[]> {
		return (this.#keys ??= this.#storage.listKeys());
	}

	/** Live files and bytes per bucket, read once per request. */
	usage() {
		return (this.#usage ??= this.#storage.usage());
	}

	/** Buckets the console's key can open, read once per request. */
	connected() {
		return (this.#own ??= this.#storage.listBuckets());
	}

	/** Drops the per-request reads after a change, so the next read sees it. */
	forget() {
		this.#keys = null;
		this.#usage = null;
		this.#own = null;
	}

	/** The console key's access per bucket, from its grants. */
	async consoleAccess(): Promise<Map<string, Perm>> {
		const own = (await this.keys()).find((k) => k.access_key_id === this.consoleKeyId);
		return new Map((own?.grants ?? []).map((g) => [g.bucket, g.perm] as const));
	}

	/** A `fetch` for the SDK's `fetch` option. */
	fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const request = new Request(input, init);
		const requestId = `req_t0${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
		try {
			if (request.headers.get('authorization') !== `Bearer ${LOCAL_TOKEN}`)
				throw new HttpProblem('unauthenticated', 'The request has no valid API token.');
			const result = await this.#route(request);
			const headers = new Headers({ 'kofra-request-id': requestId });
			if (result.body === undefined) return new Response(null, { status: result.status, headers });
			headers.set('content-type', 'application/json');
			return new Response(JSON.stringify(result.body), { status: result.status, headers });
		} catch (err) {
			const p = mapStorage(err);
			if (p.code === 'internal_error')
				// The kind of failure only: never a message that could carry request data.
				console.log(
					JSON.stringify({
						event: 'tenant0-error',
						name: err instanceof Error ? err.name : 'unknown',
						code: err instanceof StorageError ? err.code : undefined,
						status: err instanceof StorageError ? err.status : undefined
					})
				);
			return problemResponse(p, requestId);
		}
	};

	async #route(request: Request): Promise<{ status: number; body?: unknown }> {
		const url = new URL(request.url);
		const q = url.searchParams;
		const path = url.pathname;
		const m = request.method;
		const wrong = (allow: string) =>
			new HttpProblem('method_not_allowed', 'That method is not allowed here.', undefined, allow);

		if (path === '/v1/account') {
			if (m === 'GET') return { status: 200, body: await this.#account() };
			if (m === 'DELETE')
				throw new HttpProblem(
					'role_forbidden',
					'This workspace cannot be deleted from the console.'
				);
			throw wrong('GET, DELETE');
		}
		if (path === '/v1/account/deletion/cancel') {
			if (m !== 'POST') throw wrong('POST');
			throw new HttpProblem('deletion_not_requested', 'No deletion has been requested.');
		}
		if (path === '/v1/buckets') {
			if (m === 'GET') {
				only(q, ['limit', 'cursor']);
				return { status: 200, body: page(await this.#buckets(), q) };
			}
			if (m === 'POST')
				return { status: 201, body: await this.#createBucket(await jsonBody(request)) };
			throw wrong('GET, POST');
		}
		const bucketPath = /^\/v1\/buckets\/([^/]+)$/.exec(path);
		if (bucketPath) {
			const name = decodeURIComponent(bucketPath[1]!);
			if (m === 'GET') {
				only(q, []);
				return { status: 200, body: await this.#bucket(name) };
			}
			if (m === 'DELETE') {
				only(q, ['dry_run']);
				return this.#deleteBucket(name, dryRun(q));
			}
			throw wrong('GET, DELETE');
		}
		if (path === '/v1/keys') {
			if (m === 'GET') {
				only(q, ['limit', 'cursor']);
				return { status: 200, body: page(await this.#keyList(), q) };
			}
			if (m === 'POST')
				return { status: 201, body: await this.#createKey(await jsonBody(request)) };
			throw wrong('GET, POST');
		}
		const keyPath = /^\/v1\/keys\/([^/]+)$/.exec(path);
		if (keyPath) {
			const id = decodeURIComponent(keyPath[1]!);
			if (m === 'PATCH')
				return { status: 200, body: await this.#updateKey(id, await jsonBody(request)) };
			if (m === 'DELETE') {
				only(q, ['dry_run']);
				return this.#revokeKey(id, dryRun(q));
			}
			throw wrong('PATCH, DELETE');
		}
		if (path === '/v1/usage') {
			if (m !== 'GET') throw wrong('GET');
			return { status: 200, body: await this.#usageNow() };
		}
		if (path === '/v1/usage/days') {
			if (m !== 'GET') throw wrong('GET');
			only(q, ['after', 'limit', 'cursor']);
			limitOf(q);
			// No daily history for this workspace yet.
			return { status: 200, body: { data: [], next_cursor: null } };
		}
		if (path === '/v1/usage/buckets') {
			if (m !== 'GET') throw wrong('GET');
			only(q, ['limit', 'cursor']);
			const { buckets } = await this.usage();
			const asOf = iso(this.#now());
			const all = buckets
				.map((b) => ({
					bucket: b.name,
					stored_bytes: Math.max(0, b.live_bytes),
					object_count: Math.max(0, b.live_objects),
					as_of: asOf
				}))
				.sort((a, b) => a.bucket.localeCompare(b.bucket));
			return { status: 200, body: page(all, q) };
		}
		if (path === '/v1/events') {
			if (m !== 'GET') throw wrong('GET');
			only(q, ['limit', 'cursor']);
			limitOf(q);
			// No activity feed for this workspace yet; the cursor stays where it is.
			return { status: 200, body: { data: [], next_cursor: q.get('cursor') ?? 'c0' } };
		}
		if (path === '/v1/objects/presign') {
			if (m !== 'POST') throw wrong('POST');
			return { status: 200, body: await this.#presign(await jsonBody(request)) };
		}
		throw new HttpProblem('not_found', 'There is nothing at this address.');
	}

	async #account(): Promise<S['Account']> {
		return {
			id: WORKSPACE_ID,
			state: 'active',
			access: 'full',
			s3_endpoint: `https://${this.#cfg.storage.host}`,
			limits: {
				storage_bytes: null,
				upload_24h_bytes: null,
				download_allowance_bytes: null,
				active_keys: 1000
			},
			suspension: null,
			deletion: null,
			created_at: await this.#createdAt()
		};
	}

	async #createdAt(): Promise<string> {
		const now = this.#now();
		if (createdCache && now - createdCache.at < CREATED_TTL_MS) return createdCache.value;
		let value = iso(now);
		try {
			const times = (await this.connected())
				.map((b) => Date.parse(b.created))
				.filter((t) => Number.isFinite(t));
			if (times.length) value = iso(Math.min(...times));
		} catch {
			// The account still answers; the date is only shown on the settings page.
			return value;
		}
		createdCache = { at: now, value };
		return value;
	}

	async #buckets(): Promise<S['Bucket'][]> {
		const [own, usage] = await Promise.all([this.connected(), this.usage()]);
		const counts = new Map(usage.buckets.map((b) => [b.name, b] as const));
		return own
			.filter((b) => BUCKET_NAME.test(b.name))
			.map((b) => {
				const c = counts.get(b.name);
				const t = Date.parse(b.created);
				return {
					name: b.name,
					created_at: iso(Number.isFinite(t) ? t : 0),
					stored_bytes: Math.max(0, c?.live_bytes ?? 0),
					object_count: Math.max(0, c?.live_objects ?? 0)
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	async #bucket(name: string): Promise<S['Bucket']> {
		const found = BUCKET_NAME.test(name)
			? (await this.#buckets()).find((b) => b.name === name)
			: undefined;
		if (!found) throw new HttpProblem('bucket_not_found', `There is no bucket "${name}".`);
		return found;
	}

	async #createBucket(body: Record<string, unknown>): Promise<S['Bucket']> {
		known(body, ['name']);
		const name = body.name;
		if (typeof name !== 'string' || !BUCKET_NAME.test(name))
			throw new HttpProblem(
				'invalid_bucket_name',
				'Use 3 to 63 lowercase letters, digits or hyphens.',
				[{ pointer: '/name', code: 'invalid', detail: 'Not a bucket name.' }]
			);
		try {
			await this.#storage.createBucket(name);
		} catch (err) {
			throw mapStorage(err, { bucket: name });
		}
		try {
			await this.#storage.grant(this.consoleKeyId, name, 'rw');
		} catch {
			throw new HttpProblem(
				'service_unavailable',
				`The bucket "${name}" was created, but the console could not open it yet. Connect it from the bucket list.`
			);
		}
		this.forget();
		return { name, created_at: iso(this.#now()), stored_bytes: 0, object_count: 0 };
	}

	/** Every check a bucket delete must pass, in the dry run and in the real call. */
	async #deletable(name: string): Promise<{ keys: number }> {
		if (!BUCKET_NAME.test(name))
			throw new HttpProblem('bucket_not_found', `There is no bucket "${name}".`);
		if (this.#cfg.protectedBuckets.includes(name))
			throw new HttpProblem(
				'role_forbidden',
				`The bucket "${name}" is protected: the console never deletes it.`
			);
		await this.#bucket(name);
		const notEmpty = (why: string) =>
			new HttpProblem('bucket_not_empty', `The bucket "${name}" ${why}.`);
		const counted = (await this.usage()).buckets.find((b) => b.name === name);
		if (counted && counted.live_objects > 0) throw notEmpty('still holds files');
		try {
			const first = await this.#storage.list(name, { delimiter: '', maxKeys: 1 });
			if (first.files.length > 0 || first.folders.length > 0) throw notEmpty('still holds files');
			if (await this.#storage.hasOpenUploads(name)) throw notEmpty('has an unfinished upload');
		} catch (err) {
			throw mapStorage(err, { bucket: name });
		}
		const keys = (await this.keys()).filter(
			(k) => k.access_key_id !== this.consoleKeyId && k.grants.some((g) => g.bucket === name)
		).length;
		return { keys };
	}

	async #deleteBucket(name: string, dry: boolean): Promise<{ status: number; body?: unknown }> {
		const { keys } = await this.#deletable(name);
		if (dry)
			return {
				status: 200,
				body: {
					dry_run: true,
					operation: 'buckets.delete',
					summary: `Delete the empty bucket ${name}.${keys ? ` ${keys} access key${keys === 1 ? '' : 's'} lose access to it.` : ''}`,
					reversible: false,
					effects: [{ resource: 'bucket', id: name, change: 'delete' }],
					totals: { buckets: 1, objects: 0, stored_bytes: 0, keys }
				} satisfies S['Plan']
			};
		try {
			await this.#storage.deleteBucket(name);
		} catch (err) {
			throw mapStorage(err, { bucket: name });
		}
		this.forget();
		return { status: 204 };
	}

	#toKey(k: KeySummary): S['AccessKey'] {
		return {
			id: k.access_key_id,
			// Names and last use are not recorded for this workspace.
			name: null,
			grants: k.grants
				.filter((g) => BUCKET_NAME.test(g.bucket))
				.map((g) => ({ bucket: g.bucket, access: fromPerm(g.perm) })),
			created_at: iso(k.created_at),
			last_used_at: null
		};
	}

	async #keyList(): Promise<S['AccessKey'][]> {
		return (await this.keys())
			.filter((k) => k.status === 'active' && KEY_ID.test(k.access_key_id))
			.map((k) => this.#toKey(k))
			.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
	}

	async #createKey(body: Record<string, unknown>): Promise<S['AccessKeyCreated']> {
		known(body, ['name', 'grants']);
		if (
			body.name !== undefined &&
			body.name !== null &&
			(typeof body.name !== 'string' || body.name.length > 64)
		)
			throw invalid('/name', 'name is up to 64 characters.');
		const grants = grantsOf(body.grants);
		const read = grants.filter((g) => g.access === 'read').map((g) => g.bucket);
		const write = grants.filter((g) => g.access === 'read_write').map((g) => g.bucket);
		// One permission per call: make the key with the narrower set, then widen.
		const [first, firstPerm, rest] = read.length
			? [read, 'ro' as const, write]
			: [write, 'rw' as const, []];
		let created: { access_key_id: string; secret: string };
		try {
			created = await this.#storage.createKey(first, firstPerm);
		} catch (err) {
			throw mapStorage(err, { bucket: first.length === 1 ? first[0] : first.join(', ') });
		}
		for (const bucket of rest) {
			try {
				await this.#storage.grant(created.access_key_id, bucket, 'rw');
			} catch (err) {
				// A key with only some of its grants is never handed out.
				try {
					await this.#storage.revokeKey(created.access_key_id);
				} catch {
					/* reported below either way */
				}
				throw mapStorage(err, { bucket });
			}
		}
		this.forget();
		return {
			id: created.access_key_id,
			name: null,
			grants: grants.map((g) => ({ bucket: g.bucket, access: g.access })),
			created_at: iso(this.#now()),
			last_used_at: null,
			secret_access_key: created.secret,
			s3_endpoint: `https://${this.#cfg.storage.host}`
		};
	}

	async #findKey(id: string): Promise<KeySummary> {
		const k = KEY_ID.test(id) ? (await this.keys()).find((x) => x.access_key_id === id) : undefined;
		if (!k) throw new HttpProblem('key_not_found', `There is no access key "${id}".`);
		return k;
	}

	async #updateKey(id: string, body: Record<string, unknown>): Promise<S['AccessKey']> {
		known(body, ['name', 'grants']);
		if (Object.keys(body).length === 0) throw invalid('', 'Give name or grants.');
		await this.#findKey(id);
		if (body.grants !== undefined) {
			for (const g of grantsOf(body.grants)) {
				try {
					await this.#storage.grant(id, g.bucket, toPerm(g.access)!);
				} catch (err) {
					throw mapStorage(err, { bucket: g.bucket, key: id });
				}
			}
			this.forget();
		}
		return this.#toKey(await this.#findKey(id));
	}

	async #revokeKey(id: string, dry: boolean): Promise<{ status: number; body?: unknown }> {
		if (id === this.consoleKeyId)
			throw new HttpProblem(
				'role_forbidden',
				'This is the key the console itself uses, so it cannot be revoked here.'
			);
		await this.#findKey(id);
		if (dry)
			return {
				status: 200,
				body: {
					dry_run: true,
					operation: 'keys.revoke',
					summary: `Revoke the access key ${id}. Tools that use it stop working at once.`,
					reversible: false,
					effects: [{ resource: 'key', id, change: 'revoke' }],
					totals: { buckets: 0, objects: 0, stored_bytes: 0, keys: 1 }
				} satisfies S['Plan']
			};
		try {
			await this.#storage.revokeKey(id);
		} catch (err) {
			throw mapStorage(err, { key: id });
		}
		this.forget();
		return { status: 204 };
	}

	async #usageNow(): Promise<S['Usage']> {
		const { buckets } = await this.usage();
		const now = this.#now();
		const day = new Date(now);
		const periodStart = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1);
		return {
			as_of: iso(now),
			stored_bytes: buckets.reduce((n, b) => n + Math.max(0, b.live_bytes), 0),
			object_count: buckets.reduce((n, b) => n + Math.max(0, b.live_objects), 0),
			storage_limit_bytes: null,
			over_limit: null,
			// Not measured for this workspace: the pages hide these (features.traffic).
			upload_24h: {
				limit_bytes: null,
				used_bytes: 0,
				remaining_bytes: null,
				resets_at: iso(now + 86_400_000)
			},
			downloads: {
				period_start: iso(periodStart),
				allowance_bytes: null,
				used_bytes: 0,
				over_bytes: 0
			},
			open_uploads: { count: 0, limit: 0 }
		};
	}

	async #presign(body: Record<string, unknown>): Promise<S['PresignedUrl']> {
		known(body, ['bucket', 'key', 'method', 'expires_in_seconds']);
		const { bucket, key, method } = body;
		const expires = body.expires_in_seconds ?? PRESIGN_MAX;
		if (typeof bucket !== 'string' || !BUCKET_NAME.test(bucket))
			throw invalid('/bucket', 'Not a bucket name.');
		if (typeof key !== 'string' || key.length < 1 || key.length > 1024)
			throw invalid('/key', 'key is 1 to 1024 characters.');
		if (method !== 'GET') throw invalid('/method', 'Only GET is offered.');
		if (
			typeof expires !== 'number' ||
			!Number.isInteger(expires) ||
			expires < 1 ||
			expires > PRESIGN_MAX
		)
			throw invalid('/expires_in_seconds', 'expires_in_seconds is 1 to 900.');
		await this.#bucket(bucket);
		let head;
		try {
			head = await this.#storage.head(bucket, key);
		} catch (err) {
			throw mapStorage(err, { bucket });
		}
		if (!head) throw new HttpProblem('not_found', 'There is no such file.');
		const url = await this.#storage.presignGet(bucket, key, expires);
		return { method: 'GET', url, expires_at: iso(this.#now() + expires * 1000) };
	}
}
