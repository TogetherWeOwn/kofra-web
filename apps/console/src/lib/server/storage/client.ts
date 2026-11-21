// Calls to the storage service: its S3 API, signed with the console's own key, and its admin
// API, with the admin bearer token. Both secrets stay inside this module's closure: nothing
// here returns them, logs them or puts them in an error.
import type { Tenant0Config } from '../config.js';
import {
	EMPTY_SHA256,
	UNSIGNED_PAYLOAD,
	encodeKey,
	presignQuery,
	queryString,
	sha256Base64,
	sha256Hex,
	signHeaders,
	type Query
} from './sigv4.js';
import { blocks, escapeXml, strip, text } from './xml.js';

/** A refusal or failure from the storage service: its status and code, never a secret. */
export class StorageError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message = ''
	) {
		super(message || code);
		this.name = 'StorageError';
	}
}

export type Perm = 'ro' | 'rw';

export interface KeySummary {
	access_key_id: string;
	status: string;
	created_at: number;
	grants: { bucket: string; perm: Perm }[];
}

export interface BucketCount {
	bucket_id: string;
	name: string;
	live_objects: number;
	live_bytes: number;
}

export interface Listing {
	folders: string[];
	files: { key: string; size: number; modified: string; etag: string }[];
	next: string | null;
}

export interface Head {
	size: number;
	etag: string;
	contentType: string;
	modified: string;
}

/** Calls that change nothing get this long; uploads stream for as long as they take. */
const CALL_TIMEOUT_MS = 20_000;
/** Bound on pages read for one admin listing, so a broken cursor cannot loop forever. */
const MAX_PAGES = 20;

async function failure(res: Response): Promise<StorageError> {
	let body = '';
	try {
		body = await res.text();
	} catch {
		/* no body */
	}
	let code = text(body, 'Code');
	let message = text(body, 'Message');
	if (!code) {
		try {
			const j = JSON.parse(body) as { error?: unknown; message?: unknown };
			if (typeof j.error === 'string') code = j.error;
			if (typeof j.message === 'string') message = j.message;
		} catch {
			/* not JSON */
		}
	}
	return new StorageError(res.status, code ?? `HTTP${res.status}`, message ?? '');
}

const urlDecode = (s: string | undefined, encoded: boolean) => {
	if (s === undefined || !encoded) return s ?? '';
	try {
		return decodeURIComponent(s.replace(/\+/g, '%20'));
	} catch {
		return s;
	}
};

/** An access key id as a path segment; anything else never reaches the service. */
function keyPath(id: string): string {
	if (!/^[A-Z0-9]{16,128}$/.test(id)) throw new StorageError(404, 'NoSuchAccessKey');
	return id;
}

/** A stream body with a declared length, so the service gets Content-Length. */
function sized(body: ReadableStream<Uint8Array>, length: number): ReadableStream<Uint8Array> {
	const Fixed = (globalThis as { FixedLengthStream?: new (n: number) => TransformStream })
		.FixedLengthStream;
	if (!Fixed) return body;
	const fixed = new Fixed(length);
	void body.pipeTo(fixed.writable).catch(() => {});
	return fixed.readable as ReadableStream<Uint8Array>;
}

export type StorageClient = ReturnType<typeof createStorageClient>;

export function createStorageClient(cfg: Tenant0Config['storage'], now: () => number = Date.now) {
	const creds = { accessKeyId: cfg.keyId, secretAccessKey: cfg.secret, region: cfg.region };
	const base = cfg.origin ?? `https://${cfg.host}`;
	const publicBase = cfg.origin ? `http://${cfg.host}` : `https://${cfg.host}`;

	function target(bucket?: string, key?: string): string {
		let path = '/';
		// A name that could not be a bucket never reaches the service.
		if (bucket !== undefined && !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))
			throw new StorageError(404, 'NoSuchBucket');
		if (bucket) path += bucket;
		if (key !== undefined) path += '/' + encodeKey(key);
		return path;
	}

	/**
	 * The URL parser must not change the path (dot segments, for one), or the request would go
	 * somewhere other than what was checked and signed.
	 */
	function checkedUrl(root: string, path: string, query: Query): string {
		const url = `${root}${path}${queryString(query)}`;
		if (new URL(url).pathname !== path)
			throw new StorageError(400, 'InvalidKey', 'The name does not map to a path.');
		return url;
	}

	async function s3(args: {
		method: string;
		bucket?: string;
		key?: string;
		query?: Query;
		headers?: Record<string, string>;
		body?: BodyInit;
		payloadHash?: string;
		stream?: boolean;
	}): Promise<Response> {
		const { method, bucket, key, query = [], headers = {}, body } = args;
		const path = target(bucket, key);
		const url = checkedUrl(base, path, query);
		const payloadHash = args.payloadHash ?? (body === undefined ? EMPTY_SHA256 : UNSIGNED_PAYLOAD);
		const signed = await signHeaders(creds, {
			method,
			host: cfg.host,
			path,
			query,
			headers,
			payloadHash,
			now: now()
		});
		const init: RequestInit & { duplex?: string } = { method, headers: signed };
		if (body !== undefined) {
			init.body = body;
			if (body instanceof ReadableStream) init.duplex = 'half';
		}
		if (!args.stream) init.signal = AbortSignal.timeout(CALL_TIMEOUT_MS);
		return cfg.upstream.fetch(new Request(url, init));
	}

	async function ok(res: Response): Promise<Response> {
		if (!res.ok) throw await failure(res);
		return res;
	}

	async function admin<T>(
		method: string,
		path: string,
		json?: unknown,
		query: Query = []
	): Promise<T | null> {
		const headers: Record<string, string> = {
			authorization: `Bearer ${cfg.adminToken}`,
			host: cfg.host
		};
		let body: string | undefined;
		if (json !== undefined) {
			body = JSON.stringify(json);
			headers['content-type'] = 'application/json';
		}
		const url = checkedUrl(base, `/_admin${path}`, query);
		const res = await cfg.upstream.fetch(
			new Request(url, { method, headers, body, signal: AbortSignal.timeout(CALL_TIMEOUT_MS) })
		);
		if (!res.ok) throw await failure(res);
		return res.status === 204 ? null : ((await res.json()) as T);
	}

	async function xmlBody(xml: string) {
		const bytes = new TextEncoder().encode(xml);
		return {
			body: bytes,
			payloadHash: await sha256Hex(bytes),
			checksum: await sha256Base64(bytes)
		};
	}

	return {
		// ---- S3, with the console's key -------------------------------------------------

		async listBuckets(): Promise<{ name: string; created: string }[]> {
			const xml = await (await ok(await s3({ method: 'GET' }))).text();
			return blocks(xml, 'Bucket').map((b) => ({
				name: text(b, 'Name') ?? '',
				created: text(b, 'CreationDate') ?? ''
			}));
		},

		async list(
			bucket: string,
			opts: { prefix?: string; delimiter?: string; token?: string; maxKeys?: number } = {}
		): Promise<Listing> {
			const query: Query = [
				['list-type', '2'],
				['encoding-type', 'url'],
				['max-keys', String(opts.maxKeys ?? 200)],
				['prefix', opts.prefix ?? '']
			];
			if (opts.delimiter !== '') query.push(['delimiter', opts.delimiter ?? '/']);
			if (opts.token) query.push(['continuation-token', opts.token]);
			const xml = await (await ok(await s3({ method: 'GET', bucket, query }))).text();
			const encoded = text(xml, 'EncodingType') === 'url';
			const folders = blocks(xml, 'CommonPrefixes').map((b) =>
				urlDecode(text(b, 'Prefix'), encoded)
			);
			const files = blocks(xml, 'Contents').map((b) => ({
				key: urlDecode(text(b, 'Key'), encoded),
				size: Number(text(b, 'Size') ?? 0),
				modified: text(b, 'LastModified') ?? '',
				etag: text(b, 'ETag') ?? ''
			}));
			const top = strip(strip(xml, 'Contents'), 'CommonPrefixes');
			const truncated = text(top, 'IsTruncated') === 'true';
			return {
				folders,
				files,
				next: truncated ? (text(top, 'NextContinuationToken') ?? null) : null
			};
		},

		/** The object's details, or null when there is no such object. */
		async head(bucket: string, key: string): Promise<Head | null> {
			const res = await s3({ method: 'HEAD', bucket, key });
			if (res.status === 404) return null;
			if (!res.ok) throw new StorageError(res.status, `HTTP${res.status}`);
			const h = res.headers;
			return {
				size: Number(h.get('content-length') ?? 0),
				etag: h.get('etag') ?? '',
				contentType: h.get('content-type') ?? '',
				modified: h.get('last-modified') ?? ''
			};
		},

		/** A new object; never replaces one (`If-None-Match: *`). */
		async putNew(
			bucket: string,
			key: string,
			body: ReadableStream<Uint8Array>,
			length: number,
			contentType: string
		) {
			const headers: Record<string, string> = { 'content-type': contentType, 'if-none-match': '*' };
			const res = await ok(
				await s3({ method: 'PUT', bucket, key, headers, body: sized(body, length), stream: true })
			);
			return { etag: res.headers.get('etag') ?? '' };
		},

		async createUpload(bucket: string, key: string, contentType: string): Promise<string> {
			const res = await ok(
				await s3({
					method: 'POST',
					bucket,
					key,
					query: [['uploads', '']],
					headers: { 'content-type': contentType }
				})
			);
			const id = text(await res.text(), 'UploadId');
			if (!id) throw new StorageError(502, 'NoUploadId');
			return id;
		},

		async uploadPart(
			bucket: string,
			key: string,
			uploadId: string,
			part: number,
			body: ReadableStream<Uint8Array>,
			length: number
		) {
			const query: Query = [
				['partNumber', String(part)],
				['uploadId', uploadId]
			];
			const res = await ok(
				await s3({ method: 'PUT', bucket, key, query, body: sized(body, length), stream: true })
			);
			return { etag: res.headers.get('etag') ?? '' };
		},

		/** Completes an upload into a new object; never replaces one. */
		async completeUpload(
			bucket: string,
			key: string,
			uploadId: string,
			parts: { part: number; etag: string }[]
		) {
			const xml =
				'<CompleteMultipartUpload>' +
				parts
					.map(
						(p) =>
							`<Part><PartNumber>${p.part}</PartNumber><ETag>${escapeXml(p.etag)}</ETag></Part>`
					)
					.join('') +
				'</CompleteMultipartUpload>';
			const b = await xmlBody(xml);
			const res = await ok(
				await s3({
					method: 'POST',
					bucket,
					key,
					query: [['uploadId', uploadId]],
					headers: { 'content-type': 'application/xml', 'if-none-match': '*' },
					body: b.body,
					payloadHash: b.payloadHash,
					stream: true
				})
			);
			// A completion can fail inside a 200 answer.
			const out = await res.text();
			if (blocks(out, 'Error').length)
				throw new StorageError(500, text(out, 'Code') ?? 'InternalError', text(out, 'Message'));
			return { etag: text(out, 'ETag') ?? '' };
		},

		async abortUpload(bucket: string, key: string, uploadId: string) {
			await ok(await s3({ method: 'DELETE', bucket, key, query: [['uploadId', uploadId]] }));
		},

		/** True when the bucket has at least one unfinished multipart upload. */
		/** The first page (up to 1,000) of unfinished multipart uploads in the bucket. */
		async openUploads(bucket: string): Promise<{ key: string; uploadId: string }[]> {
			const xml = await (
				await ok(
					await s3({
						method: 'GET',
						bucket,
						query: [
							['max-uploads', '1000'],
							['uploads', '']
						]
					})
				)
			).text();
			return blocks(xml, 'Upload')
				.map((b) => ({ key: text(b, 'Key') ?? '', uploadId: text(b, 'UploadId') ?? '' }))
				.filter((u) => u.key && u.uploadId);
		},

		async hasOpenUploads(bucket: string): Promise<boolean> {
			const xml = await (
				await ok(
					await s3({
						method: 'GET',
						bucket,
						query: [
							['max-uploads', '1'],
							['uploads', '']
						]
					})
				)
			).text();
			return blocks(xml, 'Upload').length > 0;
		},

		/** Deletes exactly the version with this ETag (412 when the object changed). */
		async deleteObject(bucket: string, key: string, ifMatch: string) {
			await ok(await s3({ method: 'DELETE', bucket, key, headers: { 'if-match': ifMatch } }));
		},

		/** A presigned GET on the public host. */
		async presignGet(bucket: string, key: string, expiresIn: number): Promise<string> {
			const path = target(bucket, key);
			const q = await presignQuery(creds, {
				method: 'GET',
				host: cfg.host,
				path,
				expiresIn,
				now: now()
			});
			return checkedUrl(publicBase, path, q);
		},

		// ---- admin API, with the admin token ---------------------------------------------

		async listKeys(): Promise<KeySummary[]> {
			const out: KeySummary[] = [];
			let after = '';
			for (let i = 0; i < MAX_PAGES; i++) {
				const page = await admin<{ keys: KeySummary[]; next: string | null }>(
					'GET',
					'/keys',
					undefined,
					after ? [['after', after]] : []
				);
				out.push(...(page?.keys ?? []));
				if (!page?.next || page.next === after) break;
				after = page.next;
			}
			return out;
		},

		async createKey(buckets: string[], perm: Perm) {
			const r = await admin<{ access_key_id: string; secret: string; perm: Perm }>(
				'POST',
				'/keys',
				{ buckets, perm }
			);
			if (!r) throw new StorageError(502, 'NoKey');
			return r;
		},

		async grant(keyId: string, bucket: string, perm: Perm) {
			await admin('POST', `/keys/${keyPath(keyId)}/grants`, { bucket, perm });
		},

		async revokeKey(keyId: string) {
			await admin('DELETE', `/keys/${keyPath(keyId)}`);
		},

		async createBucket(name: string) {
			// Created as real data: the console never makes a bucket that may be cleaned up.
			return admin<{ name: string; created_at: number }>('POST', '/buckets', {
				name,
				disposable: false
			});
		},

		/** S3 DeleteBucket, which the service accepts only with the admin token. */
		async deleteBucket(name: string) {
			const path = target(name);
			const res = await cfg.upstream.fetch(
				new Request(checkedUrl(base, path, []), {
					method: 'DELETE',
					headers: { authorization: `Bearer ${cfg.adminToken}`, host: cfg.host },
					signal: AbortSignal.timeout(CALL_TIMEOUT_MS)
				})
			);
			if (!res.ok) throw await failure(res);
		},

		/** Live files and bytes per bucket, and whether the counters are complete. */
		async usage(): Promise<{ seeded: boolean; buckets: BucketCount[] }> {
			const buckets: BucketCount[] = [];
			let seeded = true;
			let after = '';
			for (let i = 0; i < MAX_PAGES; i++) {
				const page = await admin<{
					seeded: boolean;
					buckets: BucketCount[];
					next_after: string | null;
				}>('GET', '/usage/buckets', undefined, after ? [['after', after]] : []);
				if (!page) break;
				seeded = seeded && page.seeded === true;
				buckets.push(...page.buckets);
				if (!page.next_after || page.next_after === after) break;
				after = page.next_after;
			}
			return { seeded, buckets };
		}
	};
}
