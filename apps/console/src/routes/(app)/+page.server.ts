import { loadFailed } from '#lib/server/api.js';
import { latestEvents } from '#lib/server/lists.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [usage, buckets, keys, events, countsComplete] = await Promise.all([
			locals.api.usage.get(),
			locals.api.buckets.list({ limit: 200 }),
			locals.api.keys.list({ limit: 200 }),
			locals.workspace.features.events ? latestEvents(locals.api, 6) : [],
			locals.countsComplete()
		]);
		return {
			usage,
			countsComplete,
			largest: [...buckets.data].sort((a, b) => b.stored_bytes - a.stored_bytes).slice(0, 5),
			bucketCount: buckets.data.length,
			moreBuckets: buckets.next_cursor !== null,
			keyCount: keys.data.length,
			recent: events,
			crumbs: [{ label: 'Overview' }]
		};
	} catch (err) {
		loadFailed(err);
	}
};
