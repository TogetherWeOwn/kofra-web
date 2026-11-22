import { redirect } from '@sveltejs/kit';
import { account, field, refused } from '#lib/server/account/actions.js';
import { nextPath, setSession } from '#lib/server/account/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
	reset: url.searchParams.get('reset') === '1',
	verified: url.searchParams.get('verified') === '1'
});

export const actions: Actions = {
	default: async (event) => {
		const client = account(event);
		const form = await event.request.formData();
		const email = field(form, 'email').trim();
		const next = nextPath(event.url.searchParams.get('next'));
		try {
			const answer = await client.loginPassword(email, field(form, 'password'));
			setSession(event.cookies, answer.session);
			if (answer.state === 'second_step')
				redirect(303, `/two-factor?${new URLSearchParams({ next })}`);
		} catch (err) {
			return refused(err, '/sign-in', { email }, { invalid_email: 'email' });
		}
		redirect(303, next);
	}
};
