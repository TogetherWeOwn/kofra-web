import { resolve } from '$app/paths';
import { fail } from '@sveltejs/kit';
import { field, requireIdentity } from '#lib/server/account/actions.js';
import { freshStep } from '#lib/server/account/session.js';
import { tokensPort } from '#lib/server/tokens.js';
import { scopeGroups } from '#lib/token-scopes.js';
import type { Actions, PageServerLoad } from './$types';

const scopeNames = new Set(scopeGroups.flatMap(({ scopes }) => Object.keys(scopes)));
const expiries = ['30', '90', '365', 'never'];

function checkFresh(locals: App.Locals) {
	if (locals.me && !freshStep(locals.me.session.step_at)) requireIdentity('/tokens/new');
}

export const load: PageServerLoad = (event) => {
	checkFresh(event.locals);
	tokensPort(event);
	return {
		crumbs: [{ label: 'API tokens', href: resolve('/(app)/tokens') }, { label: 'Create token' }]
	};
};

export const actions: Actions = {
	default: async (event) => {
		checkFresh(event.locals);
		const port = tokensPort(event);
		const form = await event.request.formData();
		const name = field(form, 'name').trim();
		const scopes = [...new Set(form.getAll('scopes').map(String))];
		const buckets = field(form, 'buckets');
		const addresses = field(form, 'addresses');
		const expiry = field(form, 'expiry');
		const input = { name, scopes, buckets, addresses, expiry };
		if (!name) return fail(422, { input, field: 'name', problem: { message: 'Enter a name.' } });
		if (!scopes.length || scopes.some((scope) => !scopeNames.has(scope)))
			return fail(422, {
				input,
				field: 'scopes',
				problem: { message: 'Choose at least one listed scope.' }
			});
		if (!expiries.includes(expiry))
			return fail(422, {
				input,
				field: 'expiry',
				problem: { message: 'Choose when the token expires.' }
			});
		const bucketList = buckets
			.split(',')
			.map((bucket) => bucket.trim())
			.filter(Boolean);
		const ipList = addresses
			.split(/\r?\n/)
			.map((address) => address.trim())
			.filter(Boolean);
		const created = await port.create({
			name,
			scopes,
			buckets: bucketList.length ? bucketList : undefined,
			allowed_ips: ipList.length ? ipList : undefined,
			expires_in_days: expiry === 'never' ? undefined : Number(expiry)
		});
		return { created };
	}
};
