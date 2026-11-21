import { error, json } from '@sveltejs/kit';
import { validKey } from '#lib/paths.js';
import { FileError } from '#lib/server/files.js';
import type { RequestHandler } from './$types';

/**
 * Where to send one file: a single PUT address, or a multipart plan, both on this console
 * (the file store decides; see FileStore.startUpload). The address carries a signed token
 * that binds the bucket, name and size.
 */
export const POST: RequestHandler = async ({ locals, params, request, url }) => {
	if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
		error(415, { message: 'Send JSON.' });
	const body = (await request.json().catch(() => null)) as {
		key?: unknown;
		size?: unknown;
		type?: unknown;
	} | null;
	const key = body?.key;
	const size = body?.size;
	const type = typeof body?.type === 'string' ? body.type : '';
	if (typeof key !== 'string' || !validKey(key))
		error(400, { message: 'That file name or path is not allowed.' });
	if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0)
		error(400, { message: 'The size is missing.' });
	try {
		return json(await locals.files.startUpload(params.bucket, key, size, type, url.origin));
	} catch (err) {
		if (err instanceof FileError) error(err.status, { message: err.message, hint: err.hint });
		throw err;
	}
};
