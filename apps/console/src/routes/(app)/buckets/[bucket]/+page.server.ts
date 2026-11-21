import { resolve } from '$app/paths';
import { bucketHref } from '#lib/links.js';
import { error } from '@sveltejs/kit';
import { loadFailed } from '#lib/server/api.js';
import { FileError, MAX_DELETE } from '#lib/server/files.js';
import type { ConsoleAccess, FileListing } from '#lib/server/files.js';
import { folderCrumbs, validPrefix } from '#lib/paths.js';
import type { PageServerLoad } from './$types';

const count = (v: string | null) => (v && /^[0-9]{1,4}$/.test(v) ? Number(v) : 0);

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const prefix = url.searchParams.get('prefix') ?? '';
	const cursor = url.searchParams.get('cursor') ?? undefined;
	if (!validPrefix(prefix)) error(400, { message: 'That folder path is not valid.' });
	let bucket;
	try {
		bucket = await locals.api.buckets.get({ bucket: params.bucket });
	} catch (err) {
		loadFailed(err);
	}
	// A customer workspace has no file browser yet: files are reached with an access key.
	const filesUnavailable = locals.mode === 'live';
	let listing: FileListing, access: ConsoleAccess | null, countsComplete: boolean;
	try {
		// File listing is not part of the management API yet: it comes from the file store.
		[listing, access, countsComplete] = filesUnavailable
			? [{ folders: [], files: [], next: null }, 'read', await locals.countsComplete()]
			: await Promise.all([
					locals.files.list(bucket.name, prefix, cursor),
					locals.files.access(bucket.name),
					locals.countsComplete()
				]);
	} catch (err) {
		if (err instanceof FileError) error(err.status, { message: err.message, hint: err.hint });
		throw err;
	}
	const features = locals.workspace.features;
	return {
		bucket,
		prefix,
		listing,
		cursor: cursor ?? null,
		access,
		canWrite: access === 'read_write',
		canDelete: features.deleteFiles && access === 'read_write',
		maxDelete: MAX_DELETE,
		isProtected: locals.workspace.protectedBuckets.includes(bucket.name),
		sample: features.sample,
		filesUnavailable,
		connect: features.connect,
		countsComplete,
		folders: folderCrumbs(prefix),
		created: url.searchParams.get('created') === '1',
		removed: {
			deleted: count(url.searchParams.get('deleted')),
			skipped: count(url.searchParams.get('skipped')),
			failed: count(url.searchParams.get('failed'))
		},
		crumbs: [
			{ label: 'Buckets', href: resolve('/(app)/buckets') },
			{ label: bucket.name, href: prefix ? bucketHref(bucket.name) : undefined },
			...folderCrumbs(prefix).map((f, i, all) => ({
				label: f.name,
				href: i < all.length - 1 ? bucketHref(bucket.name, f.prefix) : undefined
			}))
		]
	};
};
