import { redirect } from '@sveltejs/kit';
import { account, field, refused } from '#lib/server/account/actions.js';
import { nextPath } from '#lib/server/account/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	account(event);
	return {
		totp: event.locals.me?.user.totp ?? false,
		passkeys: event.locals.me?.user.passkeys ?? 0
	};
};

export const actions: Actions = {
	default: async (event) => {
		const client = account(event);
		const form = await event.request.formData();
		try {
			await client.reauth(field(form, 'password'), field(form, 'code').trim() || undefined);
		} catch (err) {
			return refused(
				err,
				'/account',
				{},
				{ invalid_credentials: 'password', code_invalid: 'code' }
			);
		}
		redirect(303, nextPath(event.url.searchParams.get('next')));
	}
};
