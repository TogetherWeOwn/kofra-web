import { redirect } from '@sveltejs/kit';
import { account, refused } from '#lib/server/account/actions.js';
import { AccountProblem } from '#lib/server/account/client.js';
import { clearSession } from '#lib/server/account/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	account(event);
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const client = account(event);
		try {
			await client.logout();
		} catch (err) {
			if (!(err instanceof AccountProblem && err.code === 'session_invalid'))
				return refused(err, '/sign-out', {});
		}
		clearSession(event.cookies);
		redirect(303, '/sign-in');
	}
};
