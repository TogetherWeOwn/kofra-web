// The tenant0 file browser: listing, uploads through the console, deletes behind a
// confirmation, and connecting a bucket the console's key cannot open yet.
import { validKey, validPrefix } from '#lib/paths.js';
import {
	FileError,
	MAX_DELETE,
	type ConsoleAccess,
	type DeleteConfirmation,
	type DeleteItem,
	type DeleteResult,
	type FileListing,
	type FileStore,
	type MultipartTarget,
	type OtherBucket,
	type PutTarget
} from '../files.js';
import { StorageError, type StorageClient } from '../storage/client.js';
import { open, seal, type TokenKey } from '../tokens.js';
import type { Tenant0Api } from './api.js';

/** Files of this size or more go up in parts of this size. */
export const PART_SIZE = 16 * 1024 * 1024;
/** The S3 limit on parts. */
const MAX_PARTS = 10_000;
export const MAX_UPLOAD = PART_SIZE * MAX_PARTS;
const PUT_TTL_S = 15 * 60;
const MULTIPART_TTL_S = 12 * 3600;
const CONFIRM_TTL_S = 30 * 60;
const PAGE = 200;

const BUCKET_NAME = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const isoSeconds = (s: number) => new Date(s * 1000).toISOString().replace('.000Z', 'Z');
/** A date the service wrote (RFC 1123 or ISO) as ISO, or "" when it is not a date. */
const isoOrEmpty = (v: string) => {
	const t = Date.parse(v);
	return Number.isFinite(t) ? new Date(t).toISOString() : '';
};
const lastSegment = (key: string) => key.slice(key.lastIndexOf('/', key.length - 2) + 1);

/** What an upload token binds. */
export interface UploadGrant extends Record<string, unknown> {
	b: string;
	k: string;
	s: number;
	t: string;
	/** Multipart upload id; absent for a single PUT. */
	u?: string;
}

export function partCount(size: number): number {
	return Math.max(1, Math.ceil(size / PART_SIZE));
}

/** The exact length part `n` (from 1) of a file of `size` bytes must have. */
export function partLength(size: number, n: number): number {
	return n < partCount(size) ? PART_SIZE : size - PART_SIZE * (partCount(size) - 1);
}

function storageFailure(err: unknown): never {
	if (err instanceof FileError) throw err;
	if (err instanceof StorageError) {
		if (err.status === 412 || err.code === 'PreconditionFailed')
			throw new FileError(
				409,
				'A file with this name already exists.',
				'Rename the file, or delete the old one first.'
			);
		if (err.code === 'NoSuchBucket') throw new FileError(404, 'There is no such bucket.');
		if (err.code === 'NoSuchUpload')
			throw new FileError(409, 'This upload has ended. Start it again.');
		if (err.code === 'AccessDenied')
			throw new FileError(403, 'The console is not allowed to do that in this bucket.');
		if (err.status === 503 || err.status === 429)
			throw new FileError(503, 'Storage is busy. Try again in a minute.');
		if (err.status === 400) throw new FileError(400, 'Storage refused the request.');
	}
	if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError'))
		throw new FileError(503, 'Storage did not answer in time. Try again in a minute.');
	throw new FileError(502, 'Something went wrong.');
}

export class Tenant0Files implements FileStore {
	readonly #api: Tenant0Api;
	readonly #storage: StorageClient;
	readonly #key: Promise<TokenKey>;
	readonly #now: () => number;

	constructor(
		api: Tenant0Api,
		storage: StorageClient,
		key: Promise<TokenKey>,
		now: () => number = Date.now
	) {
		this.#api = api;
		this.#storage = storage;
		this.#key = key;
		this.#now = now;
	}

	#nowS() {
		return Math.floor(this.#now() / 1000);
	}

	async access(bucket: string): Promise<ConsoleAccess | null> {
		if (!BUCKET_NAME.test(bucket)) return null;
		const perm = (await this.#api.consoleAccess()).get(bucket);
		return perm === 'rw' ? 'read_write' : perm === 'ro' ? 'read' : null;
	}

	async #need(bucket: string, write: boolean) {
		const a = await this.access(bucket);
		if (!a) throw new FileError(404, `There is no bucket "${bucket}" the console can open.`);
		if (write && a !== 'read_write')
			throw new FileError(
				403,
				'The console has read-only access to this bucket.',
				'Allow uploads and deletes on the bucket list.'
			);
	}

	async list(bucket: string, prefix: string, cursor?: string): Promise<FileListing> {
		if (!validPrefix(prefix)) throw new FileError(400, 'That folder path is not valid.');
		if (
			cursor !== undefined &&
			(cursor.length > 1024 ||
				[...cursor].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f))
		)
			throw new FileError(400, 'That page link is not valid.');
		await this.#need(bucket, false);
		let page;
		try {
			page = await this.#storage.list(bucket, {
				prefix,
				delimiter: '/',
				token: cursor,
				maxKeys: PAGE
			});
		} catch (err) {
			storageFailure(err);
		}
		return {
			folders: page.folders
				.filter((p) => p.startsWith(prefix) && p.length > prefix.length && validPrefix(p))
				.map((p) => ({ prefix: p, name: p.slice(prefix.length, -1) })),
			files: page.files
				// A folder marker ("photos/") is the folder itself, not a file in it.
				.filter((f) => f.key.startsWith(prefix) && f.key !== prefix)
				.map((f) => ({
					key: f.key,
					name: lastSegment(f.key),
					size: f.size,
					type: '',
					modified: isoOrEmpty(f.modified),
					etag: f.etag
				})),
			next: page.next
		};
	}

	async startUpload(
		bucket: string,
		key: string,
		size: number,
		type: string,
		origin: string
	): Promise<PutTarget | MultipartTarget> {
		if (!validKey(key)) throw new FileError(400, 'That file name or path is not allowed.');
		if (!Number.isSafeInteger(size) || size < 0) throw new FileError(400, 'The size is missing.');
		if (size > MAX_UPLOAD)
			throw new FileError(
				413,
				'Files up to 156 GiB can be uploaded here.',
				'Use an S3 tool for larger files.'
			);
		const contentType = /^[\w.+-]{1,64}\/[\w.+-]{1,128}$/.test(type)
			? type
			: 'application/octet-stream';
		await this.#need(bucket, true);
		let existing;
		try {
			existing = await this.#storage.head(bucket, key);
		} catch (err) {
			storageFailure(err);
		}
		if (existing)
			throw new FileError(
				409,
				`"${key}" already exists.`,
				'Rename the file, or delete the old one first.'
			);
		const key_ = await this.#key;
		const base = `${origin}/buckets/${bucket}/upload`;
		if (size < PART_SIZE) {
			const exp = this.#nowS() + PUT_TTL_S;
			const token = await seal(key_, 'put', exp, {
				b: bucket,
				k: key,
				s: size,
				t: contentType
			} satisfies UploadGrant);
			return {
				method: 'PUT',
				url: `${base}/object?t=${encodeURIComponent(token)}`,
				expires_at: isoSeconds(exp)
			};
		}
		let uploadId: string;
		try {
			uploadId = await this.#storage.createUpload(bucket, key, contentType);
		} catch (err) {
			storageFailure(err);
		}
		const exp = this.#nowS() + MULTIPART_TTL_S;
		const token = await seal(key_, 'multipart', exp, {
			b: bucket,
			k: key,
			s: size,
			t: contentType,
			u: uploadId
		} satisfies UploadGrant);
		const t = encodeURIComponent(token);
		return {
			method: 'MULTIPART',
			part_url: `${base}/part?t=${t}`,
			complete_url: `${base}/complete`,
			abort_url: `${base}/abort`,
			token,
			part_size: PART_SIZE,
			part_count: partCount(size),
			expires_at: isoSeconds(exp)
		};
	}

	/** The grant in an upload token for this bucket, or a refusal. */
	async uploadGrant(
		bucket: string,
		token: string | null,
		purpose: 'put' | 'multipart'
	): Promise<UploadGrant> {
		const g = await open<UploadGrant>(await this.#key, purpose, token, this.#nowS());
		if (
			!g ||
			g.b !== bucket ||
			typeof g.k !== 'string' ||
			typeof g.s !== 'number' ||
			typeof g.t !== 'string'
		)
			throw new FileError(
				403,
				'This upload link is not valid or has expired.',
				'Start the upload again.'
			);
		if (purpose === 'multipart' && typeof g.u !== 'string')
			throw new FileError(403, 'This upload link is not valid.');
		return g;
	}

	async putObject(g: UploadGrant, body: ReadableStream<Uint8Array> | null, length: number) {
		if (!body || length !== g.s)
			throw new FileError(400, 'The file size does not match the upload.');
		await this.#need(g.b, true);
		try {
			return await this.#storage.putNew(g.b, g.k, body, length, g.t);
		} catch (err) {
			storageFailure(err);
		}
	}

	async putPart(
		g: UploadGrant,
		part: number,
		body: ReadableStream<Uint8Array> | null,
		length: number
	) {
		if (!Number.isInteger(part) || part < 1 || part > partCount(g.s))
			throw new FileError(400, 'There is no such part.');
		if (!body || length !== partLength(g.s, part))
			throw new FileError(400, 'The part size does not match the upload.');
		try {
			return await this.#storage.uploadPart(g.b, g.k, g.u!, part, body, length);
		} catch (err) {
			storageFailure(err);
		}
	}

	async complete(g: UploadGrant, parts: { part: number; etag: string }[]) {
		const n = partCount(g.s);
		if (
			parts.length !== n ||
			parts.some((p, i) => p.part !== i + 1 || typeof p.etag !== 'string' || p.etag.length > 200)
		)
			throw new FileError(400, 'The list of parts is not complete.');
		try {
			return await this.#storage.completeUpload(g.b, g.k, g.u!, parts);
		} catch (err) {
			storageFailure(err);
		}
	}

	async abort(g: UploadGrant) {
		try {
			await this.#storage.abortUpload(g.b, g.k, g.u!);
		} catch (err) {
			if (err instanceof StorageError && err.code === 'NoSuchUpload') return;
			storageFailure(err);
		}
	}

	async #heads(bucket: string, keys: string[]) {
		const out: { key: string; head: Awaited<ReturnType<StorageClient['head']>> }[] = [];
		// A few at a time: each is one small request.
		for (let i = 0; i < keys.length; i += 8) {
			const batch = keys.slice(i, i + 8);
			const heads = await Promise.all(batch.map((k) => this.#storage.head(bucket, k)));
			batch.forEach((key, j) => out.push({ key, head: heads[j]! }));
		}
		return out;
	}

	#checkKeys(keys: string[]) {
		if (keys.length === 0) throw new FileError(400, 'Choose at least one file.');
		if (keys.length > MAX_DELETE)
			throw new FileError(400, `Choose at most ${MAX_DELETE} files at a time.`);
		if (new Set(keys).size !== keys.length) throw new FileError(400, 'A file is listed twice.');
		if (keys.some((k) => !validKey(k))) throw new FileError(400, 'That file name is not valid.');
	}

	static #digest(bucket: string, items: DeleteItem[]) {
		return { b: bucket, i: items.map((x) => [x.key, x.etag]) };
	}

	async confirmDelete(bucket: string, keys: string[]): Promise<DeleteConfirmation> {
		this.#checkKeys(keys);
		await this.#need(bucket, true);
		let heads;
		try {
			heads = await this.#heads(bucket, keys);
		} catch (err) {
			storageFailure(err);
		}
		const items: DeleteItem[] = [];
		const missing: string[] = [];
		for (const { key, head } of heads) {
			if (head)
				items.push({ key, size: head.size, modified: isoOrEmpty(head.modified), etag: head.etag });
			else missing.push(key);
		}
		const token = await seal(
			await this.#key,
			'delete',
			this.#nowS() + CONFIRM_TTL_S,
			Tenant0Files.#digest(bucket, items)
		);
		return { items, missing, token };
	}

	async deleteFiles(bucket: string, items: DeleteItem[], token: string): Promise<DeleteResult> {
		this.#checkKeys(items.map((i) => i.key));
		const signed = await open<{ b: string; i: [string, string][] }>(
			await this.#key,
			'delete',
			token,
			this.#nowS()
		);
		const expected = JSON.stringify(Tenant0Files.#digest(bucket, items));
		// Only exactly the list the confirmation page showed, in its order, is deleted.
		if (!signed || JSON.stringify({ b: signed.b, i: signed.i }) !== expected)
			throw new FileError(
				403,
				'This confirmation is not valid or has expired.',
				'Go back to the bucket and choose the files again.'
			);
		await this.#need(bucket, true);
		const result: DeleteResult = { deleted: [], skipped: [], failed: [] };
		for (const item of items) {
			try {
				await this.#storage.deleteObject(bucket, item.key, item.etag);
				result.deleted.push(item.key);
			} catch (err) {
				// 412: the file changed after the page was shown, so it is kept. 404: already gone.
				if (err instanceof StorageError && (err.status === 412 || err.status === 404))
					result.skipped.push(item.key);
				else result.failed.push(item.key);
			}
		}
		this.#api.forget();
		return result;
	}

	async otherBuckets(): Promise<OtherBucket[]> {
		const [{ buckets }, access] = await Promise.all([this.#api.usage(), this.#api.consoleAccess()]);
		return buckets
			.filter((b) => BUCKET_NAME.test(b.name) && !access.has(b.name))
			.map((b) => ({
				name: b.name,
				stored_bytes: Math.max(0, b.live_bytes),
				object_count: Math.max(0, b.live_objects)
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	async connect(bucket: string, access: ConsoleAccess): Promise<void> {
		if (!BUCKET_NAME.test(bucket)) throw new FileError(404, 'There is no such bucket.');
		const current = await this.access(bucket);
		const known = current !== null || (await this.otherBuckets()).some((b) => b.name === bucket);
		if (!known) throw new FileError(404, `There is no bucket "${bucket}".`);
		if (current === 'read_write' || current === access) return;
		try {
			await this.#storage.grant(
				this.#api.consoleKeyId,
				bucket,
				access === 'read_write' ? 'rw' : 'ro'
			);
		} catch (err) {
			if (err instanceof StorageError && err.code === 'GrantNarrowingRefused') return;
			storageFailure(err);
		}
		this.#api.forget();
	}
}
