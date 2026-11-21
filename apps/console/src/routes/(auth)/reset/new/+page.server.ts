import { redirect } from '@sveltejs/kit';
import { account, field, passwordFields, refused } from '#lib/server/account/actions.js';
import { AccountProblem } from '#lib/server/account/client.js';
import { clearSession } from '#lib/server/account/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const client = account(event);
	const token = event.url.searchParams.get('token') ?? '';
	try {
		const answer = await client.checkReset(token);
		return { ready: true, secondFactor: answer.second_factor };
	} catch (err) {
		if (!(err instanceof AccountProblem)) throw err;
		return {
			ready: false,
			secondFactor: false,
			problem: {
				message:
					err.code === 'token_invalid'
						? 'This link has expired or was already used.'
						: 'Try again in a minute.'
			}
		};
	}
};

export const actions: Actions = {
	default: async (event) => {
		const client = account(event);
		const form = await event.request.formData();
		try {
			await client.resetPassword(
				event.url.searchParams.get('token') ?? '',
				field(form, 'password'),
				field(form, 'code').trim() || undefined
			);
			clearSession(event.cookies);
		} catch (err) {
			return refused(err, '/reset/new', {}, { ...passwordFields, code_invalid: 'code' });
		}
		redirect(303, '/sign-in?reset=1');
	}
};
