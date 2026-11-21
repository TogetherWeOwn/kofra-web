import { resolve } from '$app/paths';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Plan } from '@kofra/api';
import { actionFailed, loadFailed } from '#lib/server/api.js';
import type { Actions, PageServerLoad } from './$types';

const unavailable = () =>
	error(404, { message: 'This workspace cannot be deleted from the console.' });

export const load: PageServerLoad = async ({ locals, parent }) => {
	if (!locals.workspace.features.workspaceDeletion) unavailable();
	const { account } = await parent();
	if (account.deletion) redirect(303, '/settings');
	try {
		const plan = (await locals.api.account.delete({ dry_run: true })) as Plan;
		return {
			plan,
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
		if (!locals.workspace.features.workspaceDeletion) unavailable();
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
