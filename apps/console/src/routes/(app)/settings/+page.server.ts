import { redirect } from '@sveltejs/kit';
import { actionFailed } from '#lib/server/api.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
	notice: url.searchParams.get('done'),
	crumbs: [{ label: 'Settings' }]
});

export const actions: Actions = {
	// Not destructive (it stops a pending deletion), so it needs no confirmation step.
	cancelDeletion: async ({ locals }) => {
		try {
			await locals.api.account.cancelDeletion();
		} catch (err) {
			return actionFailed(err);
		}
		redirect(303, '/settings?done=deletion-cancelled');
	}
};
