import { resolve } from '$app/paths';
import { fail } from '@sveltejs/kit';
import { field, requireFreshStep } from '#lib/server/account/actions.js';
import { tokensPort } from '#lib/server/api-tokens.js';
import { actionFailed } from '#lib/server/api.js';
import { scopeGroups } from '#lib/token-scopes.js';
import type { Actions, PageServerLoad } from './$types';

const scopeNames = new Set(scopeGroups.flatMap(({ scopes }) => Object.keys(scopes)));
// The API's longest lifetime is 1,000 days (`TokenLifetimeDays`); no token is unlimited.
const expiries = ['30', '90', '365', '1000'];

const checkFresh = (locals: App.Locals) => requireFreshStep(locals, '/tokens/new');

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
		try {
			const created = await port.create({
				name,
				scopes,
				buckets: bucketList.length ? bucketList : undefined,
				allowed_ips: ipList.length ? ipList : undefined,
				expires_in_days: Number(expiry)
			});
			return { created };
		} catch (err) {
			// A refusal from the API goes back to the form with what was entered.
			return actionFailed(err, { input });
		}
	}
};
