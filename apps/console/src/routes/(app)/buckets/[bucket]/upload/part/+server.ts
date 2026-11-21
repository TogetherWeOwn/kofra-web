import { answer, declaredLength, tenantFiles } from '#lib/server/uploads.js';
import type { RequestHandler } from './$types';

/** One part of a multipart upload (`n` from 1), under the upload's token. */
export const PUT: RequestHandler = async ({ locals, params, request, url }) => {
	const files = tenantFiles(locals);
	const length = declaredLength(request);
	const n = url.searchParams.get('n') ?? '';
	return answer(async () => {
		const g = await files.uploadGrant(params.bucket, url.searchParams.get('t'), 'multipart');
		const part = /^[0-9]{1,5}$/.test(n) ? Number(n) : 0;
		const r = await files.putPart(g, part, request.body, length);
		return { part, etag: r?.etag ?? '' };
	});
};
