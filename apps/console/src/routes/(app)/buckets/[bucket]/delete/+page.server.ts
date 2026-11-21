import { resolve } from '$app/paths';
import { bucketHref } from '#lib/links.js';
import { fail, redirect } from '@sveltejs/kit';
import { KofraError, type Plan } from '@kofra/api';
import { actionFailed, describe, loadFailed } from '#lib/server/api.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	let bucket;
	try {
		bucket = await locals.api.buckets.get({ bucket: params.bucket });
	} catch (err) {
		loadFailed(err);
	}
	const crumbs = [
		{ label: 'Buckets', href: resolve('/(app)/buckets') },
		{ label: bucket.name, href: bucketHref(bucket.name) },
		{ label: 'Delete' }
	];
	// Ask the API what the delete would do before offering it. A bucket that still holds files
	// cannot be deleted, and the page says so instead of showing the form.
	try {
		const plan = (await locals.api.buckets.delete({ bucket: bucket.name, dry_run: true })) as Plan;
		return {
			bucket,
			plan,
			blocked: null,
			blockedTitle: null,
			uploads: 0,
			recentUploads: 0,
			unreachableUploads: 0,
			uploadsToken: null,
			crumbs
		};
	} catch (err) {
		if (err instanceof KofraError && err.code === 'bucket_not_empty') {
			// Unfinished uploads also keep a bucket. When no file is left, the page says so, and
			// stale ones (older than any console upload can run) can be stopped from here, with
			// write access only.
			const open = locals.files.openUploads
				? await locals.files.openUploads(bucket.name).catch(() => null)
				: null;
			const onlyUploads =
				open !== null && open.empty && open.stale + open.unreachable + open.recent > 0;
			const canStop =
				onlyUploads &&
				open.stale > 0 &&
				(await locals.files.access(bucket.name).catch(() => null)) === 'read_write';
			const shown = describe(err);
			return {
				bucket,
				plan: null,
				blocked: onlyUploads ? { ...shown, hint: undefined } : shown,
				blockedTitle: onlyUploads
					? 'This bucket has unfinished uploads'
					: 'This bucket still holds files',
				uploads: canStop ? open.stale : 0,
				recentUploads: onlyUploads ? open.recent : 0,
				unreachableUploads: onlyUploads ? open.unreachable : 0,
				uploadsToken: canStop ? open.token : null,
				crumbs
			};
		}
		if (err instanceof KofraError && err.code === 'role_forbidden')
			return {
				bucket,
				plan: null,
				blocked: describe(err),
				blockedTitle: 'This bucket is protected',
				uploads: 0,
				recentUploads: 0,
				unreachableUploads: 0,
				uploadsToken: null,
				crumbs
			};
		loadFailed(err);
	}
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const form = await request.formData();
		// The confirmation is checked here, not only in the browser.
		if (String(form.get('confirm') ?? '') !== params.bucket) return fail(400, { mismatch: true });
		try {
			await locals.api.buckets.delete({ bucket: params.bucket });
		} catch (err) {
			// Empty at the dry run but refused now: the bucket held files once and is kept. The
			// usual hint (delete every file first) would not help, so only the reason is shown.
			if (err instanceof KofraError && err.code === 'bucket_not_empty')
				return fail(409, { problem: { message: err.problem.detail, requestId: err.requestId } });
			return actionFailed(err);
		}
		redirect(303, `/buckets?deleted=${encodeURIComponent(params.bucket)}`);
	}
};
