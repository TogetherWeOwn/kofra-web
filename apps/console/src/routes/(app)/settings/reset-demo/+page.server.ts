import { resolve } from '$app/paths';
import { error, fail, redirect } from '@sveltejs/kit';
import { demoCookieName } from '#lib/server/demo.js';
import type { Actions, PageServerLoad } from './$types';

const demoOnly = (locals: App.Locals) => {
	if (!locals.workspace.features.sample) error(404, { message: 'There is no demo data to reset.' });
};

export const load: PageServerLoad = ({ locals }) => {
	demoOnly(locals);
	return {
		crumbs: [{ label: 'Settings', href: resolve('/(app)/settings') }, { label: 'Reset demo data' }]
	};
};

export const actions: Actions = {
	default: async ({ cookies, locals, request, url }) => {
		demoOnly(locals);
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
