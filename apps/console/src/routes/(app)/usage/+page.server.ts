import { loadFailed } from '#lib/server/api.js';
import { recentDays } from '#lib/server/lists.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [usage, days, buckets] = await Promise.all([
			locals.api.usage.get(),
			recentDays(locals.api, 30),
			locals.api.usage.buckets({ limit: 200 })
		]);
		return { usage, days, buckets: buckets.data, crumbs: [{ label: 'Usage' }] };
	} catch (err) {
		loadFailed(err);
	}
};
