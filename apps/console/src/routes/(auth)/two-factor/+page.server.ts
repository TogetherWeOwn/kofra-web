import { redirect } from '@sveltejs/kit';
import { account, field, refused } from '#lib/server/account/actions.js';
import { nextPath, setSession } from '#lib/server/account/session.js';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/** One rule for the page and its action: no authenticator app means recovery codes. */
const recoveryMode = (event: RequestEvent) =>
	!event.locals.me?.user.totp || event.url.searchParams.get('recovery') === '1';

export const load: PageServerLoad = (event) => {
	account(event);
	if (event.locals.me?.needs !== 'second_step') redirect(303, '/');
	return {
		passkeys: event.locals.me.user.passkeys,
		totp: event.locals.me.user.totp,
		recovery: recoveryMode(event),
		next: nextPath(event.url.searchParams.get('next'))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const client = account(event);
		const form = await event.request.formData();
		const recovery = recoveryMode(event);
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
