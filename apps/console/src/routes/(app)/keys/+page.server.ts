import { loadFailed } from '#lib/server/api.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	try {
		const [keys, account] = await Promise.all([
			locals.api.keys.list({ limit: 200 }),
			locals.api.account.get()
		]);
		return {
			keys: keys.data,
			limit: account.limits.active_keys,
			endpoint: account.s3_endpoint,
			revoked: url.searchParams.get('revoked'),
			crumbs: [{ label: 'Access keys' }]
		};
	} catch (err) {
		loadFailed(err);
	}
};
