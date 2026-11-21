// A local fake of the storage service the tenant0 console talks to: the admin API it uses and
// the S3 operations it signs, with the same refusals. Tests only. It checks SigV4 with its
// own code (not the console's), the admin bearer token, and each key's grants.
//
// In unit tests: `new FakeStorage().fetch` is the console's upstream. For Playwright:
// `node e2e/fake-storage.ts <port>` serves it over http, with test-only routes under /__test.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

export const FAKE = {
	host: '127.0.0.1:4178',
	region: 'auto',
	adminToken: 'fake-admin-token-0123456789',
	consoleKeyId: 'AKVLCONSOLE0000000001',
	consoleSecret: 'fake-console-secret-0123456789abcdef',
	ownerKeyId: 'AKVLOWNERKEY00000002',
	appKeyId: 'AKVLAPPKEY0000000003'
} as const;

type Perm = 'ro' | 'rw';
interface Obj {
	body: Uint8Array;
	type: string;
	etag: string;
	modified: number;
}
interface Upload {
	key: string;
	type: string;
	parts: Map<number, { body: Uint8Array; etag: string }>;
}
interface Bucket {
	name: string;
	id: string;
	created: number;
	objects: Map<string, Obj>;
	uploads: Map<string, Upload>;
	/** Set once anything was written: such a bucket is never deleted (as the service does). */
	held: boolean;
}
interface Key {
	id: string;
	secret: string;
	created: number;
	grants: Map<string, Perm>;
}

const md5 = (b: Uint8Array) => createHash('md5').update(b).digest('hex');
const sha256 = (b: string | Uint8Array) => createHash('sha256').update(b).digest('hex');
const hmac = (k: string | Buffer, d: string) => createHmac('sha256', k).update(d).digest();
const xmlEsc = (s: string) =>
	s.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!
	);
const enc3986 = (s: string) =>
	encodeURIComponent(s).replace(
		/[!'()*]/g,
		(c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
	);

function s3Error(status: number, code: string, message = code): Response {
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${xmlEsc(message)}</Message></Error>`,
		{ status, headers: { 'content-type': 'application/xml' } }
	);
}
const adminError = (status: number, error: string, message = error) =>
	Response.json({ error, message }, { status });
const xml = (body: string, headers: Record<string, string> = {}) =>
	new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
		headers: { 'content-type': 'application/xml', ...headers }
	});

/** Raw query pairs, decoded, in order. */
function queryPairs(raw: string): [string, string][] {
	if (!raw) return [];
	return raw.split('&').map((p) => {
		const i = p.indexOf('=');
		const k = i < 0 ? p : p.slice(0, i);
		const v = i < 0 ? '' : p.slice(i + 1);
		return [decodeURIComponent(k), decodeURIComponent(v.replace(/\+/g, '%20'))];
	});
}

function canonicalQuery(pairs: [string, string][]): string {
	return pairs
		.map(([k, v]) => [enc3986(k), enc3986(v)] as const)
		.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
		.map(([k, v]) => `${k}=${v}`)
		.join('&');
}

function signingKey(secret: string, day: string, region: string) {
	return hmac(hmac(hmac(hmac(`AWS4${secret}`, day), region), 's3'), 'aws4_request');
}

const same = (a: string, b: string) =>
	a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export class FakeStorage {
	buckets = new Map<string, Bucket>();
	keys = new Map<string, Key>();
	/** Every request as "METHOD path", for tests that check what the console called. */
	calls: string[] = [];
	seeded = true;
	now: () => number = () => Date.now();
	#ids = 0;

	constructor() {
		this.reset();
	}

	reset() {
		this.buckets.clear();
		this.keys.clear();
		this.calls = [];
		this.seeded = true;
		const t = Date.UTC(2026, 10, 13, 12);
		const add = (name: string, created: number) => {
			const b: Bucket = {
				name,
				id: `b_${name}`,
				created,
				objects: new Map(),
				uploads: new Map(),
				held: false
			};
			this.buckets.set(name, b);
			return b;
		};
		const files = add('files', t);
		const put = (b: Bucket, key: string, text: string, type = 'text/plain') => {
			const body = new TextEncoder().encode(text);
			b.objects.set(key, { body, type, etag: `"${md5(body)}"`, modified: t + 3600_000 });
			b.held = true;
		};
		put(files, 'docs/readme.txt', 'Read me first.\n');
		put(files, 'docs/plans/2027.txt', 'Plans.\n');
		put(files, 'photos/beach.jpg', 'not really a photo', 'image/jpeg');
		put(files, 'notes.txt', 'Top-level notes.\n');
		for (let i = 0; i < 230; i++)
			put(files, `many/file-${String(i).padStart(3, '0')}.txt`, `file ${i}\n`);
		const nntune = add('nntune', t + 86_400_000);
		put(nntune, 'library/track.flac', 'fake audio', 'audio/flac');
		add('scratch', t + 2 * 86_400_000);
		this.keys.set(FAKE.consoleKeyId, {
			id: FAKE.consoleKeyId,
			secret: FAKE.consoleSecret,
			created: t,
			grants: new Map([
				['files', 'rw'],
				['scratch', 'rw']
			])
		});
		this.keys.set(FAKE.ownerKeyId, {
			id: FAKE.ownerKeyId,
			secret: `owner-${'o'.repeat(30)}`,
			created: t + 1000,
			grants: new Map([['files', 'rw']])
		});
		this.keys.set(FAKE.appKeyId, {
			id: FAKE.appKeyId,
			secret: `app-${'p'.repeat(30)}`,
			created: t + 2000,
			grants: new Map([['nntune', 'rw']])
		});
	}

	fetch = async (request: Request): Promise<Response> => {
		const url = new URL(request.url);
		const rawQuery = url.search.slice(1);
		this.calls.push(`${request.method} ${url.pathname}`);
		try {
			if (url.pathname === '/_admin' || url.pathname.startsWith('/_admin/'))
				return await this.#admin(request, url);
			return await this.#s3(request, url, rawQuery);
		} catch (err) {
			return s3Error(500, 'InternalError', err instanceof Error ? err.message : 'error');
		}
	};

	#bearer(request: Request) {
		const auth = request.headers.get('authorization') ?? '';
		return auth.startsWith('Bearer ') && same(auth.slice(7), FAKE.adminToken);
	}

	async #admin(request: Request, url: URL): Promise<Response> {
		if (!this.#bearer(request)) return adminError(403, 'AccessDenied');
		const path = url.pathname.slice('/_admin'.length);
		const m = request.method;
		const body = async () => JSON.parse(await request.text()) as Record<string, unknown>;
		if (path === '/status')
			return adminError(500, 'NeverCallStatus', 'The console must not call this route.');
		if (path === '/keys' && m === 'GET') {
			const keys = [...this.keys.values()]
				.sort((a, b) => a.id.localeCompare(b.id))
				.map((k) => ({
					access_key_id: k.id,
					status: 'active',
					created_at: k.created,
					grants: [...k.grants].map(([bucket, perm]) => ({ bucket, perm }))
				}));
			return Response.json({ keys, next: null });
		}
		if (path === '/keys' && m === 'POST') {
			const b = await body();
			const perm = b.perm;
			const names = b.buckets;
			if (perm !== 'ro' && perm !== 'rw') return adminError(400, 'InvalidArgument');
			if (!Array.isArray(names) || names.length < 1 || names.length > 32)
				return adminError(400, 'InvalidArgument');
			for (const n of names)
				if (!this.buckets.has(String(n))) return adminError(404, 'NoSuchBucket');
			const id = `AKVLNEW${String(++this.#ids).padStart(13, '0')}`;
			const secret = `secret${String(this.#ids).padStart(34, 'x')}`;
			this.keys.set(id, {
				id,
				secret,
				created: this.now(),
				grants: new Map(names.map((n) => [String(n), perm]))
			});
			return Response.json({ access_key_id: id, secret, perm });
		}
		const grant = /^\/keys\/([A-Z0-9]+)\/grants$/.exec(path);
		if (grant && m === 'POST') {
			const key = this.keys.get(grant[1]!);
			const b = await body();
			if (b.perm !== 'ro' && b.perm !== 'rw') return adminError(400, 'InvalidArgument');
			if (!this.buckets.has(String(b.bucket))) return adminError(404, 'NoSuchBucket');
			if (!key) return adminError(404, 'NoSuchAccessKey');
			if (String(b.bucket) === 'fail-grant') return adminError(500, 'InternalError');
			const had = key.grants.get(String(b.bucket));
			if (had === 'rw' && b.perm === 'ro') return adminError(409, 'GrantNarrowingRefused');
			key.grants.set(String(b.bucket), b.perm);
			return Response.json({ access_key_id: key.id, bucket: b.bucket, perm: b.perm });
		}
		const revoke = /^\/keys\/([A-Z0-9]+)$/.exec(path);
		if (revoke && m === 'DELETE') {
			if (!this.keys.delete(revoke[1]!)) return adminError(404, 'NoSuchAccessKey');
			return new Response(null, { status: 204 });
		}
		if (path === '/buckets' && m === 'POST') {
			const b = await body();
			const name = String(b.name);
			if (typeof b.disposable !== 'boolean') return adminError(400, 'InvalidArgument');
			if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name))
				return adminError(400, 'InvalidBucketName');
			if (this.buckets.has(name)) return adminError(409, 'BucketAlreadyExists');
			this.buckets.set(name, {
				name,
				id: `b_${name}`,
				created: this.now(),
				objects: new Map(),
				uploads: new Map(),
				held: false
			});
			return Response.json({ name, disposable: b.disposable, created_at: this.now() });
		}
		if (path === '/usage/buckets' && m === 'GET') {
			// Buckets that never held a file have no counter row yet, as in the service.
			const buckets = [...this.buckets.values()]
				.filter((b) => b.held)
				.sort((a, b) => a.id.localeCompare(b.id))
				.map((b) => ({
					bucket_id: b.id,
					name: b.name,
					live_objects: b.objects.size,
					live_bytes: [...b.objects.values()].reduce((n, o) => n + o.body.length, 0)
				}));
			return Response.json({ seeded: this.seeded, buckets, next_after: null });
		}
		return adminError(404, 'NotFound');
	}

	/** The key a SigV4 request was signed with, or a refusal. */
	async #auth(request: Request, url: URL, rawQuery: string): Promise<Key | Response> {
		const host = request.headers.get('host') ?? url.host;
		const pairs = queryPairs(rawQuery);
		const auth = request.headers.get('authorization');
		let keyId: string,
			scope: string,
			signed: string[],
			signature: string,
			date: string,
			payload: string;
		let canonicalPairs = pairs;
		if (auth) {
			const m =
				/^AWS4-HMAC-SHA256 Credential=([^/]+)\/([^,]+), SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/.exec(
					auth
				);
			if (!m) return s3Error(403, 'AccessDenied', 'bad authorization');
			[, keyId, scope, , signature] = m as unknown as [string, string, string, string, string];
			signed = m[3]!.split(';');
			date = request.headers.get('x-amz-date') ?? '';
			payload = request.headers.get('x-amz-content-sha256') ?? '';
		} else {
			const q = new Map(pairs);
			const cred = q.get('X-Amz-Credential') ?? '';
			const i = cred.indexOf('/');
			if (i < 0) return s3Error(403, 'AccessDenied', 'no credentials');
			keyId = cred.slice(0, i);
			scope = cred.slice(i + 1);
			signed = (q.get('X-Amz-SignedHeaders') ?? '').split(';');
			signature = q.get('X-Amz-Signature') ?? '';
			date = q.get('X-Amz-Date') ?? '';
			payload = 'UNSIGNED-PAYLOAD';
			const expires = Number(q.get('X-Amz-Expires'));
			const t = Date.UTC(
				+date.slice(0, 4),
				+date.slice(4, 6) - 1,
				+date.slice(6, 8),
				+date.slice(9, 11),
				+date.slice(11, 13),
				+date.slice(13, 15)
			);
			if (!(expires >= 1 && expires <= 604800) || this.now() > t + expires * 1000)
				return s3Error(403, 'AccessDenied', 'expired');
			canonicalPairs = pairs.filter(([k]) => k !== 'X-Amz-Signature');
		}
		const key = this.keys.get(keyId);
		if (!key) return s3Error(403, 'InvalidAccessKeyId');
		const headerValue = (n: string) =>
			n === 'host' ? host : (request.headers.get(n) ?? '').trim().replace(/\s+/g, ' ');
		const canonical = [
			request.method,
			url.pathname,
			canonicalQuery(canonicalPairs),
			signed.map((n) => `${n}:${headerValue(n)}\n`).join(''),
			signed.join(';'),
			payload
		].join('\n');
		const [day, region] = scope.split('/');
		const toSign = ['AWS4-HMAC-SHA256', date, scope, sha256(canonical)].join('\n');
		const expected = hmac(signingKey(key.secret, day!, region!), toSign).toString('hex');
		if (!same(expected, signature)) return s3Error(403, 'SignatureDoesNotMatch');
		if (!signed.includes('host')) return s3Error(403, 'AccessDenied', 'host not signed');
		return key;
	}

	async #s3(request: Request, url: URL, rawQuery: string): Promise<Response> {
		const parts = url.pathname.split('/');
		const bucketName = decodeURIComponent(parts[1] ?? '');
		const key = parts.length > 2 ? parts.slice(2).map(decodeURIComponent).join('/') : undefined;
		const q = new Map(queryPairs(rawQuery));
		const m = request.method;

		// DeleteBucket takes the admin token, as in the service.
		if (m === 'DELETE' && bucketName && key === undefined && this.#bearer(request)) {
			const b = this.buckets.get(bucketName);
			if (!b) return s3Error(404, 'NoSuchBucket');
			if (b.objects.size || b.uploads.size || b.held) return s3Error(409, 'BucketNotEmpty');
			this.buckets.delete(bucketName);
			for (const k of this.keys.values()) k.grants.delete(bucketName);
			return new Response(null, { status: 204 });
		}

		const who = await this.#auth(request, url, rawQuery);
		if (who instanceof Response) return who;

		if (!bucketName) {
			if (m !== 'GET') return s3Error(405, 'MethodNotAllowed');
			const list = [...who.grants.keys()]
				.map((n) => this.buckets.get(n))
				.filter((b): b is Bucket => !!b)
				.sort((a, b) => a.name.localeCompare(b.name));
			return xml(
				`<ListAllMyBucketsResult><Buckets>${list
					.map(
						(b) =>
							`<Bucket><Name>${b.name}</Name><CreationDate>${new Date(b.created).toISOString()}</CreationDate></Bucket>`
					)
					.join('')}</Buckets></ListAllMyBucketsResult>`
			);
		}
		const b = this.buckets.get(bucketName);
		if (!b) return s3Error(404, 'NoSuchBucket');
		const perm = who.grants.get(bucketName);
		const write = !(m === 'GET' || m === 'HEAD');
		if (!perm || (write && perm !== 'rw')) return s3Error(403, 'AccessDenied');

		if (key === undefined || key === '') {
			if (m === 'GET' && q.has('uploads')) {
				const max = Number(q.get('max-uploads') ?? 1000);
				const ups = [...b.uploads].slice(0, max);
				return xml(
					`<ListMultipartUploadsResult><Bucket>${b.name}</Bucket><IsTruncated>${b.uploads.size > max}</IsTruncated>${ups
						.map(
							([id, u]) => `<Upload><Key>${xmlEsc(u.key)}</Key><UploadId>${id}</UploadId></Upload>`
						)
						.join('')}</ListMultipartUploadsResult>`
				);
			}
			if (m === 'GET' && q.get('list-type') === '2') return this.#list(b, q);
			return s3Error(400, 'InvalidRequest');
		}

		const obj = b.objects.get(key);
		if (m === 'HEAD' || (m === 'GET' && !q.has('uploadId'))) {
			if (!obj)
				return m === 'HEAD' ? new Response(null, { status: 404 }) : s3Error(404, 'NoSuchKey');
			const headers = {
				'content-type': obj.type,
				'content-length': String(obj.body.length),
				etag: obj.etag,
				'last-modified': new Date(obj.modified).toUTCString()
			};
			return new Response(m === 'HEAD' ? null : (obj.body as Uint8Array<ArrayBuffer>), { headers });
		}
		if (m === 'PUT' && !q.has('uploadId')) {
			if (request.headers.get('if-none-match') === '*' && obj)
				return s3Error(412, 'PreconditionFailed');
			const body = new Uint8Array(await request.arrayBuffer());
			const declared = request.headers.get('content-length');
			if (declared !== null && Number(declared) !== body.length)
				return s3Error(400, 'IncompleteBody');
			b.objects.set(key, {
				body,
				type: request.headers.get('content-type') ?? 'application/octet-stream',
				etag: `"${md5(body)}"`,
				modified: this.now()
			});
			b.held = true;
			return new Response(null, { headers: { etag: `"${md5(body)}"` } });
		}
		if (m === 'POST' && q.has('uploads')) {
			const id = `up${++this.#ids}`;
			b.uploads.set(id, {
				key,
				type: request.headers.get('content-type') ?? 'application/octet-stream',
				parts: new Map()
			});
			b.held = true;
			return xml(
				`<InitiateMultipartUploadResult><Bucket>${b.name}</Bucket><Key>${xmlEsc(key)}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`
			);
		}
		const up = b.uploads.get(q.get('uploadId') ?? '');
		if (q.has('uploadId') && (!up || up.key !== key)) return s3Error(404, 'NoSuchUpload');
		if (m === 'PUT' && up) {
			const n = Number(q.get('partNumber'));
			const body = new Uint8Array(await request.arrayBuffer());
			const etag = `"${md5(body)}"`;
			up.parts.set(n, { body, etag });
			return new Response(null, { headers: { etag } });
		}
		if (m === 'POST' && up) {
			if (request.headers.get('if-none-match') === '*' && obj)
				return s3Error(412, 'PreconditionFailed');
			const text = await request.text();
			const listed = [
				...text.matchAll(/<PartNumber>(\d+)<\/PartNumber><ETag>([^<]*)<\/ETag>/g)
			].map((x) => ({
				n: Number(x[1]),
				etag: x[2]!.replace(/&quot;/g, '"')
			}));
			const chunks: Uint8Array[] = [];
			for (const p of listed) {
				const have = up.parts.get(p.n);
				if (!have || have.etag !== p.etag) return s3Error(400, 'InvalidPart');
				chunks.push(have.body);
			}
			const total = chunks.reduce((n, c) => n + c.length, 0);
			const body = new Uint8Array(total);
			let at = 0;
			for (const c of chunks) {
				body.set(c, at);
				at += c.length;
			}
			const etag = `"${md5(body)}-${listed.length}"`;
			b.objects.set(key, { body, type: up.type, etag, modified: this.now() });
			b.uploads.delete(q.get('uploadId')!);
			return xml(
				`<CompleteMultipartUploadResult><Key>${xmlEsc(key)}</Key><ETag>${xmlEsc(etag)}</ETag></CompleteMultipartUploadResult>`
			);
		}
		if (m === 'DELETE' && up) {
			b.uploads.delete(q.get('uploadId')!);
			return new Response(null, { status: 204 });
		}
		if (m === 'DELETE') {
			if (!obj) return new Response(null, { status: 204 });
			const ifMatch = request.headers.get('if-match');
			if (ifMatch && ifMatch !== obj.etag) return s3Error(412, 'PreconditionFailed');
			b.objects.delete(key);
			return new Response(null, { status: 204 });
		}
		return s3Error(400, 'InvalidRequest');
	}

	#list(b: Bucket, q: Map<string, string>): Response {
		const prefix = q.get('prefix') ?? '';
		const delimiter = q.get('delimiter') ?? '';
		const max = Math.min(1000, Number(q.get('max-keys') ?? 1000));
		const after = q.get('continuation-token') ?? '';
		const entries: { kind: 'file' | 'folder'; name: string }[] = [];
		const folders = new Set<string>();
		for (const k of [...b.objects.keys()].sort()) {
			if (!k.startsWith(prefix)) continue;
			const rest = k.slice(prefix.length);
			const cut = delimiter ? rest.indexOf(delimiter) : -1;
			if (cut >= 0) {
				const f = prefix + rest.slice(0, cut + delimiter.length);
				if (!folders.has(f)) {
					folders.add(f);
					entries.push({ kind: 'folder', name: f });
				}
			} else entries.push({ kind: 'file', name: k });
		}
		entries.sort((x, y) => x.name.localeCompare(y.name));
		const start = after ? entries.findIndex((e) => e.name > after) : 0;
		const pageEntries = start < 0 ? [] : entries.slice(start, start + max);
		const truncated = start >= 0 && start + max < entries.length;
		const e = (s: string) =>
			q.get('encoding-type') === 'url' ? enc3986(s).replace(/%2F/g, '/') : xmlEsc(s);
		const body = pageEntries
			.map((x) => {
				if (x.kind === 'folder')
					return `<CommonPrefixes><Prefix>${e(x.name)}</Prefix></CommonPrefixes>`;
				const o = b.objects.get(x.name)!;
				return `<Contents><Key>${e(x.name)}</Key><LastModified>${new Date(o.modified).toISOString()}</LastModified><ETag>${xmlEsc(o.etag)}</ETag><Size>${o.body.length}</Size></Contents>`;
			})
			.join('');
		const next = truncated
			? `<NextContinuationToken>${xmlEsc(pageEntries.at(-1)!.name)}</NextContinuationToken>`
			: '';
		return xml(
			`<ListBucketResult><Name>${b.name}</Name>${q.get('encoding-type') === 'url' ? '<EncodingType>url</EncodingType>' : ''}<Prefix>${e(prefix)}</Prefix><KeyCount>${pageEntries.length}</KeyCount><MaxKeys>${max}</MaxKeys><IsTruncated>${truncated}</IsTruncated>${next}${body}</ListBucketResult>`
		);
	}
}

/** Serves a FakeStorage over http, with /__test/reset and /__test/calls for the tests. */
export function serve(port: number) {
	const fake = new FakeStorage();
	const server = createServer(async (req, res) => {
		const url = `http://${req.headers.host ?? `127.0.0.1:${port}`}${req.url ?? '/'}`;
		if (req.url === '/__test/reset' && req.method === 'POST') {
			fake.reset();
			res.writeHead(204).end();
			return;
		}
		if (req.url === '/__test/uploads') {
			const open = [...fake.buckets.values()].reduce((n, b) => n + b.uploads.size, 0);
			res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ open }));
			return;
		}
		if (req.url === '/__test/calls') {
			res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(fake.calls));
			return;
		}
		const headers = new Headers();
		for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
		const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
		const request = new Request(url, {
			method: req.method,
			headers,
			body: hasBody ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined,
			duplex: 'half'
		} as RequestInit);
		const answer = await fake.fetch(request);
		res.writeHead(answer.status, Object.fromEntries(answer.headers));
		res.end(Buffer.from(await answer.arrayBuffer()));
	});
	server.listen(port, '127.0.0.1');
	return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const port = Number(process.argv[2] ?? 4178);
	serve(port);
	console.log(`fake storage on http://127.0.0.1:${port}`);
}
