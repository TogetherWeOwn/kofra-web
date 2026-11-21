import { answer, readJson, tenantFiles } from '#lib/server/uploads.js';
import type { RequestHandler } from './$types';

/** Stops a multipart upload and drops its parts: `{ token }`. */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const files = tenantFiles(locals);
	const body = await readJson(request);
	return answer(async () => {
		const g = await files.uploadGrant(
			params.bucket,
			typeof body.token === 'string' ? body.token : null,
			'multipart'
		);
		await files.abort(g);
		return { aborted: true };
	});
};
