import { redirect } from '@sveltejs/kit';
import { account, field, passwordFields, refused } from '#lib/server/account/actions.js';
import { AccountProblem } from '#lib/server/account/client.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	account(event);
	return { invite: Boolean(event.url.searchParams.get('invite')) };
};

export const actions: Actions = {
	default: async (event) => {
		const client = account(event);
		const form = await event.request.formData();
		const email = field(form, 'email').trim();
		const name = field(form, 'name').trim();
		const invite = event.url.searchParams.get('invite');
		try {
			if (!invite) throw new AccountProblem(403, 'signup_closed', '');
			await client.signup({ invite, email, name, password: field(form, 'password') });
		} catch (err) {
			return refused(
				err,
				'/signup',
				{ email, name },
				{ ...passwordFields, invalid_email: 'email' }
			);
		}
		redirect(303, `/verify?${new URLSearchParams({ sent: '1', email })}`);
	}
};
