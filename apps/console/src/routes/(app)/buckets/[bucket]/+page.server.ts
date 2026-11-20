import { resolve } from '$app/paths';
import { bucketHref } from '#lib/links.js';
import { error } from '@sveltejs/kit';
import { loadFailed } from '#lib/server/api.js';
import { folderCrumbs, validPrefix } from '#lib/paths.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const prefix = url.searchParams.get('prefix') ?? '';
	if (!validPrefix(prefix)) error(400, { message: 'That folder path is not valid.' });
	let bucket;
	try {
		bucket = await locals.api.buckets.get({ bucket: params.bucket });
	} catch (err) {
		loadFailed(err);
	}
	// File listing is not part of the management API: in a real workspace it comes from the
	// S3 endpoint. The demo lists its sample files.
	const listing = locals.demo.listFiles(bucket.name, prefix) ?? { folders: [], files: [] };
	return {
		bucket,
		prefix,
		listing,
		folders: folderCrumbs(prefix),
		created: url.searchParams.get('created') === '1',
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
