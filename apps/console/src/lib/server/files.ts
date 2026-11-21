// The file browser's operations, which the API contract does not cover yet: listing,
// uploads, deletes and connecting a bucket. Each data source implements `FileStore`; pages
// use only this interface, so the future API client replaces an implementation, not a page.
import type { DemoApi } from '@kofra/api/demo';
import { DEMO_MAX_UPLOAD, demoFilePath } from './demo.js';

export type ConsoleAccess = 'read' | 'read_write';

export interface FileEntry {
	key: string;
	/** The last path segment. */
	name: string;
	size: number;
	/** Media type when the listing has it, else "". */
	type: string;
	modified: string;
	/** Opaque version tag when the source has one, else "". */
	etag: string;
}

export interface FileListing {
	folders: { prefix: string; name: string }[];
	files: FileEntry[];
	/** Cursor of the next page of this folder, or null. */
	next: string | null;
}

/** A single PUT of the whole file. */
export interface PutTarget {
	method: 'PUT';
	url: string;
	expires_at: string;
}

/** A multipart upload: PUT each part to `part_url` + `&n=<part>`, then POST to `complete_url`. */
export interface MultipartTarget {
	method: 'MULTIPART';
	part_url: string;
	complete_url: string;
	abort_url: string;
	token: string;
	part_size: number;
	part_count: number;
	expires_at: string;
}

/** A bucket the console cannot open yet, in a workspace where it can be connected. */
export interface OtherBucket {
	name: string;
	stored_bytes: number;
	object_count: number;
}

/** A file on a delete confirmation page, with the version it was shown at. */
export interface DeleteItem {
	key: string;
	size: number;
	modified: string;
	etag: string;
}

export interface DeleteConfirmation {
	items: DeleteItem[];
	/** Keys asked for that do not exist (nothing to delete). */
	missing: string[];
	/** Binds the list to this confirmation; the delete action checks it. */
	token: string;
}

export interface DeleteResult {
	deleted: string[];
	/** Changed or gone since the confirmation: kept, or nothing to delete. */
	skipped: string[];
	failed: string[];
}

/** A refusal with a status and words for the person using the console. */
export class FileError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly hint?: string
	) {
		super(message);
		this.name = 'FileError';
	}
}

export interface FileStore {
	/** What the console may do in the bucket; null when it cannot open it. */
	access(bucket: string): Promise<ConsoleAccess | null>;
	list(bucket: string, prefix: string, cursor?: string): Promise<FileListing>;
	startUpload(
		bucket: string,
		key: string,
		size: number,
		type: string,
		origin: string
	): Promise<PutTarget | MultipartTarget>;
	/** Present only where files can be deleted. */
	confirmDelete?(bucket: string, keys: string[]): Promise<DeleteConfirmation>;
	deleteFiles?(bucket: string, items: DeleteItem[], token: string): Promise<DeleteResult>;
	/** Unfinished multipart uploads (they keep a bucket from being deleted), and stopping them. */
	/** `token` binds exactly the uploads counted; stopping refuses if the set changed since. */
	openUploads?(bucket: string): Promise<{ count: number; token: string }>;
	stopOpenUploads?(bucket: string, token: string): Promise<number>;
	/** Present only where buckets can be connected. */
	otherBuckets?(): Promise<OtherBucket[]>;
	connect?(bucket: string, access: ConsoleAccess): Promise<void>;
}

/** Most files one delete confirmation may list. */
export const MAX_DELETE = 50;

const TTL_SECONDS = 900;
const isoSeconds = (s: number) => new Date(s * 1000).toISOString().replace('.000Z', 'Z');

/** The demo's files: sample listings, uploads counted and discarded. */
export function demoFiles(demo: DemoApi): FileStore {
	return {
		async access(bucket) {
			return demo.listFiles(bucket, '') ? 'read_write' : null;
		},
		async list(bucket, prefix) {
			const l = demo.listFiles(bucket, prefix);
			if (!l) throw new FileError(404, `There is no bucket "${bucket}".`);
			return {
				folders: l.folders,
				files: l.files.map((f) => ({ ...f, etag: '' })),
				next: null
			};
		},
		async startUpload(bucket, key, size, _type, origin) {
			if (size > DEMO_MAX_UPLOAD)
				throw new FileError(
					413,
					'The demo accepts files up to 25 MB.',
					'A real workspace has no per-file limit here.'
				);
			if (!demo.listFiles(bucket, '')) throw new FileError(404, `There is no bucket "${bucket}".`);
			const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
			return {
				method: 'PUT',
				url: `${origin}${demoFilePath(bucket, key)}?expires=${expires}`,
				expires_at: isoSeconds(expires)
			};
		}
	};
}
