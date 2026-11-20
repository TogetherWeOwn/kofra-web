import { loadFailed } from '#lib/server/api.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [usage, buckets, keys, events] = await Promise.all([
			locals.api.usage.get(),
			locals.api.buckets.list({ limit: 200 }),
			locals.api.keys.list({ limit: 200 }),
			locals.api.events.list({ limit: 200 })
		]);
		return {
			usage,
			bucketCount: buckets.data.length,
			moreBuckets: buckets.next_cursor !== null,
			keyCount: keys.data.length,
			// The feed is oldest first; the overview shows the latest few.
			recent: events.data.slice(-6).reverse(),
			crumbs: [{ label: 'Overview' }]
		};
	} catch (err) {
		loadFailed(err);
	}
};
