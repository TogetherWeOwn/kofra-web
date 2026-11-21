import { resolve } from '$app/paths';
import { error, redirect } from '@sveltejs/kit';
import { tokensPort } from '#lib/server/api-tokens.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const token = (await tokensPort(event).list()).find(({ id }) => id === event.params.id);
	if (!token) error(404, { message: 'That token is no longer available.' });
	return {
		token,
		crumbs: [{ label: 'API tokens', href: resolve('/(app)/tokens') }, { label: 'Revoke token' }]
	};
};

export const actions: Actions = {
	default: async (event) => {
		await tokensPort(event).revoke(event.params.id);
		redirect(303, '/tokens');
	}
};
