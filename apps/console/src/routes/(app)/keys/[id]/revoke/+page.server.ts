import { resolve } from '$app/paths';
import { fail, redirect } from '@sveltejs/kit';
import type { Plan } from '@kofra/api';
import { actionFailed, loadFailed } from '#lib/server/api.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	try {
		const plan = (await locals.api.keys.revoke({ key_id: params.id, dry_run: true })) as Plan;
		const keys = await locals.api.keys.list({ limit: 200 });
		const key = keys.data.find((k) => k.id === params.id) ?? null;
		return {
			id: params.id,
			name: key?.name ?? null,
			plan,
			crumbs: [
				{ label: 'Access keys', href: resolve('/(app)/keys') },
				{ label: `Revoke ${key?.name ?? params.id}` }
			]
		};
	} catch (err) {
		loadFailed(err);
	}
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const form = await request.formData();
		if (form.get('confirm') !== 'yes') return fail(400, { unconfirmed: true });
		try {
			await locals.api.keys.revoke({ key_id: params.id });
		} catch (err) {
			return actionFailed(err);
		}
		redirect(303, `/keys?revoked=${encodeURIComponent(params.id)}`);
	}
};
