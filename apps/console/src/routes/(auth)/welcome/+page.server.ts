import { redirect } from '@sveltejs/kit';
import { account, field, refused } from '#lib/server/account/actions.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	account(event);
	const me = event.locals.me!;
	if (me.workspaces.length && me.user.totp) redirect(303, '/');
	return {
		workspace: me.workspaces.length > 0,
		name: `${me.user.name.trim().split(/\s+/)[0] || 'My'}'s workspace`
	};
};

export const actions: Actions = {
	default: async (event) => {
		const client = account(event);
		const name = field(await event.request.formData(), 'name').trim();
		try {
			await client.createWorkspace(name);
		} catch (err) {
			return refused(err, '/welcome', { name });
		}
		redirect(303, event.locals.me?.user.totp ? '/' : '/welcome');
	}
};
