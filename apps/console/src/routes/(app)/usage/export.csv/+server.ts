import { error } from '@sveltejs/kit';
import { loadFailed } from '#lib/server/api.js';
import { allDays } from '#lib/server/lists.js';
import { usageCsv } from '#lib/csv.js';
import type { RequestHandler } from './$types';

/** The daily figures the usage page shows, as CSV. */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.workspace.features.traffic)
		error(404, { message: 'There is no daily usage to export.' });
	let days;
	try {
		days = await allDays(locals.api);
	} catch (err) {
		loadFailed(err);
	}
	return new Response(usageCsv(days), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="kofra-usage.csv"'
		}
	});
};
