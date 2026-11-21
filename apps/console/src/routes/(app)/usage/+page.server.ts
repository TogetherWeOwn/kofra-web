import { loadFailed } from '#lib/server/api.js';
import { recentDays } from '#lib/server/lists.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [usage, days, buckets, countsComplete, open] = await Promise.all([
			locals.api.usage.get(),
			recentDays(locals.api, 30),
			locals.api.usage.buckets({ limit: 200 }),
			locals.countsComplete(),
			locals.api.buckets.list({ limit: 200 })
		]);
		return {
			usage,
			days,
			buckets: buckets.data,
			// Buckets the console can open link to their files; the others to their Open page.
			open: open.data.map((b) => b.name),
			countsComplete,
			crumbs: [{ label: 'Usage' }]
		};
	} catch (err) {
		loadFailed(err);
	}
};
