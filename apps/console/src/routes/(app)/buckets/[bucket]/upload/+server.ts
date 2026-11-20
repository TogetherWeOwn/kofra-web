import { error, json } from '@sveltejs/kit';
import { validKey } from '#lib/paths.js';
import { DEMO_MAX_UPLOAD, demoFilePath } from '#lib/server/demo.js';
import type { RequestHandler } from './$types';

const TTL_SECONDS = 900;

/**
 * An upload address for one file, in the shape of the API's presigned URLs
 * ({ method, url, expires_at }). The API contract offers presigned downloads only today;
 * until it adds uploads, the demo hands out an address on the console itself.
 */
export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
		error(415, { message: 'Send JSON.' });
	const body = (await request.json().catch(() => null)) as { key?: unknown; size?: unknown } | null;
	const key = body?.key;
	const size = body?.size;
	if (typeof key !== 'string' || !validKey(key))
		error(400, { message: 'That file name or path is not allowed.' });
	if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0)
		error(400, { message: 'The size is missing.' });
	if (size > DEMO_MAX_UPLOAD)
		error(413, {
			message: 'The demo accepts files up to 25 MB.',
			hint: 'A real workspace has no per-file limit here.'
		});
	try {
		await locals.api.buckets.get({ bucket: params.bucket });
	} catch {
		error(404, { message: `There is no bucket "${params.bucket}".` });
	}
	const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
	return json({
		method: 'PUT',
		url: `${url.origin}${demoFilePath(params.bucket, key)}?expires=${expires}`,
		expires_at: new Date(expires * 1000).toISOString().replace('.000Z', 'Z')
	});
};
