import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { actionFailed, loadFailed } from '#lib/server/api.js';
import type { Actions, PageServerLoad } from './$types';

const goneName = (name: string | null, present: string[]) =>
	name && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name) && !present.includes(name) ? name : null;

export const load: PageServerLoad = async ({ locals, url }) => {
	const cursor = url.searchParams.get('cursor') ?? undefined;
	try {
		const [page, others] = await Promise.all([
			locals.api.buckets.list({ limit: 100, cursor }),
			// Buckets of this workspace the console cannot open yet (tenant0 only).
			cursor === undefined && locals.files.otherBuckets ? locals.files.otherBuckets() : []
		]);
		return {
			others,
			protectedBuckets: locals.workspace.protectedBuckets,
			buckets: page.data,
			next: page.next_cursor,
			paged: cursor !== undefined,
			// Shown only for a well-formed name that is really gone, so a crafted link cannot
			// announce a deletion that did not happen.
			deleted: goneName(
				url.searchParams.get('deleted'),
				page.data.map((b) => b.name)
			),
			// The create form opens by URL (/buckets?create), so docs and buttons can link to it,
			// and no route name can collide with a bucket name.
			create: url.searchParams.has('create'),
			crumbs: [{ label: 'Buckets' }]
		};
	} catch (err) {
		loadFailed(err);
	}
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		let created: string;
		try {
			created = (await locals.api.buckets.create({ body: { name } })).name;
		} catch (err) {
			return actionFailed(err, { name });
		}
		redirect(303, `${resolve('/(app)/buckets/[bucket]', { bucket: created })}?created=1`);
	}
};
