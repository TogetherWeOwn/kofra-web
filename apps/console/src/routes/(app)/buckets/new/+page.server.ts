import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import { actionFailed } from '#lib/server/api.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	crumbs: [{ label: 'Buckets', href: resolve('/(app)/buckets') }, { label: 'Create bucket' }]
});

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		let created: string;
		try {
			created = (await locals.api.buckets.create({ body: { name } })).name;
		} catch (err) {
			return actionFailed(err, { name });
		}
		redirect(303, `/buckets/${encodeURIComponent(created)}?created=1`);
	}
};
