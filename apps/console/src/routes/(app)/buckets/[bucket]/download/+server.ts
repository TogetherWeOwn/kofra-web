import { error, redirect } from '@sveltejs/kit';
import { KofraError } from '@kofra/api';
import { validKey } from '#lib/paths.js';
import { describe } from '#lib/server/api.js';
import type { RequestHandler } from './$types';

/** Signs a short-lived download URL through the API and sends the browser to it. */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const key = url.searchParams.get('key') ?? '';
	if (!validKey(key)) error(400, { message: 'That file name is not valid.' });
	let target: string;
	try {
		const p = await locals.api.objects.presign({
			body: { bucket: params.bucket, key, method: 'GET', expires_in_seconds: 300 }
		});
		target = p.url;
	} catch (err) {
		if (err instanceof KofraError) error(err.status, describe(err));
		throw err;
	}
	redirect(303, target);
};
