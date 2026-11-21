import { resolve } from '$app/paths';
import { error, fail, redirect } from '@sveltejs/kit';
import { bucketHref } from '#lib/links.js';
import { validPrefix } from '#lib/paths.js';
import { loadFailed } from '#lib/server/api.js';
import { FileError, MAX_DELETE } from '#lib/server/files.js';
import type { Actions, PageServerLoad } from './$types';

const prefixOf = (v: unknown) => (typeof v === 'string' && validPrefix(v) ? v : '');

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const files = locals.files;
	if (!files.confirmDelete) error(404, { message: 'Files cannot be deleted here.' });
	let bucket;
	try {
		bucket = await locals.api.buckets.get({ bucket: params.bucket });
	} catch (err) {
		loadFailed(err);
	}
	const keys = url.searchParams.getAll('key');
	const prefix = prefixOf(url.searchParams.get('prefix'));
	if (keys.length === 0)
		error(400, {
			message: 'No files were chosen.',
			hint: 'Tick the files to delete in the list, then choose Delete.'
		});
	try {
		const confirmation = await files.confirmDelete(bucket.name, keys);
		return {
			bucket,
			prefix,
			max: MAX_DELETE,
			...confirmation,
			total: confirmation.items.reduce((n, i) => n + i.size, 0),
			back: bucketHref(bucket.name, prefix),
			crumbs: [
				{ label: 'Buckets', href: resolve('/(app)/buckets') },
				{ label: bucket.name, href: bucketHref(bucket.name, prefix) },
				{ label: 'Delete files' }
			]
		};
	} catch (err) {
		if (err instanceof FileError) error(err.status, { message: err.message, hint: err.hint });
		throw err;
	}
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const files = locals.files;
		if (!files.deleteFiles) error(404, { message: 'Files cannot be deleted here.' });
		const form = await request.formData();
		const prefix = prefixOf(form.get('prefix'));
		// The confirmation is checked here, not only in the browser.
		if (form.get('confirm') !== 'yes') return fail(400, { unconfirmed: true });
		const keys = form.getAll('key').map(String);
		const etags = form.getAll('etag').map(String);
		if (keys.length !== etags.length)
			return fail(400, { problem: { message: 'The list of files is not complete.' } });
		const items = keys.map((key, i) => ({ key, etag: etags[i]!, size: 0, modified: '' }));
		let result;
		try {
			result = await files.deleteFiles(params.bucket, items, String(form.get('token') ?? ''));
		} catch (err) {
			if (err instanceof FileError)
				return fail(err.status, { problem: { message: err.message, hint: err.hint } });
			throw err;
		}
		const q = new URLSearchParams({
			deleted: String(result.deleted.length),
			skipped: String(result.skipped.length),
			failed: String(result.failed.length)
		});
		if (prefix) q.set('prefix', prefix);
		redirect(303, `${bucketHref(params.bucket)}?${q}`);
	}
};
