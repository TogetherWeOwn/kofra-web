import { resolve } from '$app/paths';
import { fail, redirect } from '@sveltejs/kit';
import type { Plan } from '@kofra/api';
import { requireFreshStep } from '#lib/server/account/actions.js';
import { actionFailed, loadFailed } from '#lib/server/api.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	requireFreshStep(locals, '/settings/delete-workspace');
	const { account } = await parent();
	if (!account || account.deletion) redirect(303, '/settings');
	try {
		const plan = (await locals.api.account.delete({ dry_run: true })) as Plan;
		return {
			plan,
			id: account.id,
			crumbs: [
				{ label: 'Settings', href: resolve('/(app)/settings') },
				{ label: 'Delete workspace' }
			]
		};
	} catch (err) {
		loadFailed(err);
	}
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		requireFreshStep(locals, '/settings/delete-workspace');
		const form = await request.formData();
		let id: string;
		try {
			id = (await locals.api.account.get()).id;
		} catch (err) {
			return actionFailed(err);
		}
		if (String(form.get('confirm') ?? '').trim() !== id) return fail(400, { mismatch: true });
		try {
			await locals.api.account.delete();
		} catch (err) {
			return actionFailed(err);
		}
		redirect(303, '/settings?done=deletion-requested');
	}
};
