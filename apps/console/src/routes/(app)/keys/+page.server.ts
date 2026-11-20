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
			// Shown only for a well-formed key ID that is really gone.
			revoked: ((id) =>
				id && /^[A-Z0-9]{16,128}$/.test(id) && !keys.data.some((k) => k.id === id) ? id : null)(
				url.searchParams.get('revoked')
			),
			crumbs: [{ label: 'Access keys' }]
		};
	} catch (err) {
		loadFailed(err);
	}
};
