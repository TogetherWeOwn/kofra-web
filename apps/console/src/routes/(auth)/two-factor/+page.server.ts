import { redirect } from '@sveltejs/kit';
import { account, field, refused } from '#lib/server/account/actions.js';
import { nextPath, setSession } from '#lib/server/account/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	account(event);
	if (event.locals.me?.needs !== 'second_step') redirect(303, '/');
	return {
		passkeys: event.locals.me.user.passkeys,
		totp: event.locals.me.user.totp,
		recovery: !event.locals.me.user.totp || event.url.searchParams.get('recovery') === '1',
		next: nextPath(event.url.searchParams.get('next'))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const client = account(event);
		const form = await event.request.formData();
		const recovery = event.url.searchParams.get('recovery') === '1';
		const code = field(form, 'code').trim();
		try {
			const answer = await (recovery ? client.loginRecovery(code) : client.loginTotp(code));
			setSession(event.cookies, answer.session);
		} catch (err) {
			return refused(err, '/two-factor', {}, { code_invalid: 'code' });
		}
		redirect(303, nextPath(event.url.searchParams.get('next')));
	}
};
