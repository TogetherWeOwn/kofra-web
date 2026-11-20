import { loadFailed } from '#lib/server/api.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [usage, days, buckets] = await Promise.all([
			locals.api.usage.get(),
			locals.api.usage.days({ limit: 31 }),
			locals.api.usage.buckets({ limit: 200 })
		]);
		return { usage, days: days.data, buckets: buckets.data, crumbs: [{ label: 'Usage' }] };
	} catch (err) {
		loadFailed(err);
	}
};
