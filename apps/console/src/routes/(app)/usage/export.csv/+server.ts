import { loadFailed } from '#lib/server/api.js';
import { usageCsv } from '#lib/csv.js';
import type { RequestHandler } from './$types';

/** The daily figures the usage page shows, as CSV. */
export const GET: RequestHandler = async ({ locals }) => {
	let days;
	try {
		days = (await locals.api.usage.days({ limit: 200 })).data;
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
