import { redirect } from '@sveltejs/kit';
import { account, field, refused } from '#lib/server/account/actions.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	account(event);
	const token = event.url.searchParams.get('token') ?? '';
	// Confirmation happens only on the POST of the confirm form, never on a page load:
	// link scanners and prefetch must not spend a link.
	return {
		token,
		changed: false,
		signedIn: !!event.locals.me,
		email: event.url.searchParams.get('email') ?? event.locals.me?.user.email ?? ''
	};
};

export const actions: Actions = {
	confirm: async (event) => {
		const client = account(event);
		const form = await event.request.formData();
		const token = field(form, 'token');
		try {
			const answer = await client.verifyEmail(token, field(form, 'password') || undefined);
			if (answer.what === 'email_changed') return { changed: true };
		} catch (err) {
			return refused(err, '/verify', {}, { invalid_credentials: 'password' });
		}
		redirect(303, '/sign-in?verified=1');
	},
	resend: async (event) => {
		const client = account(event);
		const email = field(await event.request.formData(), 'email').trim();
		try {
			await client.resendVerification(email);
			return { sent: true, email };
		} catch (err) {
			return refused(err, '/verify', { email, resend: true }, { invalid_email: 'email' });
		}
	}
};
