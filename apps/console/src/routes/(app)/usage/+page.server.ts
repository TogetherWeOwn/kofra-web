import { loadFailed } from '#lib/server/api.js';
import { recentDays } from '#lib/server/lists.js';
import { paginate } from '@kofra/api';
import type { PageServerLoad } from './$types';

/** Every bucket the console can open, across pages. */
async function openNames(locals: App.Locals): Promise<string[]> {
	const names: string[] = [];
	const list = (a: { limit?: number; cursor?: string }) => locals.api.buckets.list(a);
	for await (const b of paginate(list, { limit: 200 })) names.push(b.name);
	return names;
}

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [usage, days, buckets, countsComplete, open] = await Promise.all([
			locals.api.usage.get(),
			recentDays(locals.api, 30),
			locals.api.usage.buckets({ limit: 200 }),
			locals.countsComplete(),
			// Best effort: without it the rows link to the file browser as before.
			locals.workspace.features.connect ? openNames(locals).catch(() => null) : null
		]);
		return {
			usage,
			days,
			buckets: buckets.data,
			// Buckets the console can open link to their files; the others to their Open page.
			open,
			countsComplete,
			crumbs: [{ label: 'Usage' }]
		};
	} catch (err) {
		loadFailed(err);
	}
};
