import { loadFailed } from '#lib/server/api.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const cursor = url.searchParams.get('cursor') ?? undefined;
	try {
		const page = await locals.api.buckets.list({ limit: 100, cursor });
		return {
			buckets: page.data,
			next: page.next_cursor,
			paged: cursor !== undefined,
			deleted: url.searchParams.get('deleted'),
			crumbs: [{ label: 'Buckets' }]
		};
	} catch (err) {
		loadFailed(err);
	}
};
