import { loadFailed } from '#lib/server/api.js';
import { latestEvents } from '#lib/server/lists.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.workspace?.state === 'setting_up')
		return { settingUp: true as const, crumbs: [{ label: 'Overview' }] };
	try {
		const [usage, buckets, keys, events] = await Promise.all([
			locals.api.usage.get(),
			locals.api.buckets.list({ limit: 200 }),
			locals.api.keys.list({ limit: 200 }),
			latestEvents(locals.api, 6)
		]);
		return {
			settingUp: false as const,
			usage,
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
