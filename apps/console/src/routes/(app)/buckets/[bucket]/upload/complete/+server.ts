import { answer, readJson, tenantFiles } from '#lib/server/uploads.js';
import type { RequestHandler } from './$types';

/** Finishes a multipart upload: `{ token, parts: [{ part, etag }] }`, parts in order. */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	const files = tenantFiles(locals);
	const body = await readJson(request);
	return answer(async () => {
		const g = await files.uploadGrant(
			params.bucket,
			typeof body.token === 'string' ? body.token : null,
			'multipart'
		);
		const parts = Array.isArray(body.parts)
			? body.parts.map((p) => ({
					part: Number((p as { part?: unknown })?.part),
					etag: String((p as { etag?: unknown })?.etag ?? '')
				}))
			: [];
		await files.complete(g, parts);
		return { key: g.k, size: g.s };
	});
};
