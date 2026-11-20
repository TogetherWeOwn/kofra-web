import { resolve } from '$app/paths';
import { fail, redirect } from '@sveltejs/kit';
import { demoCookieName } from '#lib/server/demo.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	crumbs: [{ label: 'Settings', href: resolve('/(app)/settings') }, { label: 'Reset demo data' }]
});

export const actions: Actions = {
	default: async ({ cookies, locals, request, url }) => {
		const form = await request.formData();
		if (form.get('confirm') !== 'yes') return fail(400, { unconfirmed: true });
		locals.demoReset = true;
		cookies.delete(demoCookieName(url), {
			path: '/',
			secure: url.protocol === 'https:',
			httpOnly: true,
			sameSite: 'lax'
		});
		redirect(303, '/settings?done=demo-reset');
	}
};
