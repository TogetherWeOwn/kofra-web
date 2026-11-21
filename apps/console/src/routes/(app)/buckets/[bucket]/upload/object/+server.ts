import { answer, declaredLength, tenantFiles } from '#lib/server/uploads.js';
import type { RequestHandler } from './$types';

/** One whole file, under a token from the upload route; streamed on to storage. */
export const PUT: RequestHandler = async ({ locals, params, request, url }) => {
	const files = tenantFiles(locals);
	const length = declaredLength(request);
	return answer(async () => {
		const g = await files.uploadGrant(params.bucket, url.searchParams.get('t'), 'put');
		const r = await files.putObject(g, request.body, length);
		return { key: g.k, size: g.s, etag: r?.etag ?? '' };
	});
};
