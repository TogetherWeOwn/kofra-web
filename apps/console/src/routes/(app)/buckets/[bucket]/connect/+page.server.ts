import { resolve } from '$app/paths';
import { error, fail, redirect } from '@sveltejs/kit';
import { bucketHref } from '#lib/links.js';
import { FileError, type ConsoleAccess } from '#lib/server/files.js';
import type { Actions, PageServerLoad } from './$types';

/**
 * Lets the console open a bucket of this workspace it has no access to yet, or widen
 * read-only access. Access is only ever widened, never narrowed.
 */
export const load: PageServerLoad = async ({ locals, params }) => {
	const files = locals.files;
	if (!files.otherBuckets || !files.connect) error(404, { message: 'Not found.' });
	try {
		const [current, others] = await Promise.all([
			files.access(params.bucket),
			files.otherBuckets()
		]);
		const other = others.find((b) => b.name === params.bucket) ?? null;
		if (current === 'read_write') redirect(303, bucketHref(params.bucket));
		// A bucket the counters do not list yet (empty) can still be opened; the action finds
		// out whether it exists.
		if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(params.bucket))
			error(404, { message: 'There is no such bucket.' });
		return {
			name: params.bucket,
			current,
			other,
			crumbs: [
				{ label: 'Buckets', href: resolve('/(app)/buckets') },
				{ label: `Open ${params.bucket}` }
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
		if (!files.connect) error(404, { message: 'Not found.' });
		const form = await request.formData();
		const access = form.get('access');
		if (access !== 'read' && access !== 'read_write') return fail(400, { unchosen: true });
		try {
			await files.connect(params.bucket, access as ConsoleAccess);
		} catch (err) {
			if (err instanceof FileError)
				return fail(err.status, { problem: { message: err.message, hint: err.hint } });
			throw err;
		}
		redirect(303, bucketHref(params.bucket));
	}
};
