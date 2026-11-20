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
		return { bucket, plan, blocked: null, crumbs };
	} catch (err) {
		if (err instanceof KofraError && err.code === 'bucket_not_empty')
			return { bucket, plan: null, blocked: describe(err), crumbs };
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
			return actionFailed(err);
		}
		redirect(303, `/buckets?deleted=${encodeURIComponent(params.bucket)}`);
	}
};
