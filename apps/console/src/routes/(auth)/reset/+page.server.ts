import { account, field, refused } from '#lib/server/account/actions.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	account(event);
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const client = account(event);
		const email = field(await event.request.formData(), 'email').trim();
		try {
			await client.forgotPassword(email);
			return { sent: true, email };
		} catch (err) {
			return refused(err, '/reset', { email }, { invalid_email: 'email' });
		}
	}
};
