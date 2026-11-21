import { error, json } from '@sveltejs/kit';
import { validKey } from '#lib/paths.js';
import { DEMO_MAX_UPLOAD } from '#lib/server/demo.js';
import type { RequestHandler } from './$types';

// The demo's stand-in for the S3 endpoint: presigned downloads land here and get a short
// placeholder file; presigned uploads land here and are counted, then discarded. Only the
// visitor's own demo state changes, so the addresses carry an expiry but no signature.

function checkExpiry(url: URL) {
	const expires = Number(url.searchParams.get('expires'));
	if (!Number.isSafeInteger(expires) || expires * 1000 < Date.now())
		error(403, { message: 'This link has expired.', hint: 'Go back to the bucket and try again.' });
}

export const GET: RequestHandler = ({ locals, params, url }) => {
	checkExpiry(url);
	const file = locals.demo?.file(params.bucket, params.key);
	if (!file) error(404, { message: 'There is no such file.' });
	const body = [
		'This is a demo file.',
		'',
		`In a real workspace, this link downloads ${file.key} from the bucket ${params.bucket}`,
		`(${file.size.toLocaleString('en-US')} bytes, ${file.type}).`,
		''
	].join('\n');
	const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'content-disposition': `attachment; filename="${safeName}.demo.txt"`
		}
	});
};

export const PUT: RequestHandler = async ({ locals, params, request, url }) => {
	if (!locals.demo) error(404, { message: 'There is no such file.' });
	checkExpiry(url);
	if (!validKey(params.key)) error(400, { message: 'That file name or path is not allowed.' });
	const declared = Number(request.headers.get('content-length') ?? '0');
	if (declared > DEMO_MAX_UPLOAD) error(413, { message: 'The demo accepts files up to 25 MB.' });
	let size = 0;
	if (request.body) {
		const reader = request.body.getReader();
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > DEMO_MAX_UPLOAD) {
				await reader.cancel();
				error(413, { message: 'The demo accepts files up to 25 MB.' });
			}
		}
	}
	const type = (request.headers.get('content-type') ?? '').split(';')[0]!.trim();
	const refused = locals.demo.recordUpload(params.bucket, params.key, size, type);
	if (refused === 'bucket_not_found')
		error(404, { message: `There is no bucket "${params.bucket}".` });
	if (refused === 'invalid_key') error(400, { message: 'That file name or path is not allowed.' });
	if (refused === 'demo_full')
		error(409, {
			message: 'The demo has no room for more files.',
			hint: 'Reset the demo in Settings to start over.'
		});
	return json({ key: params.key, size });
};
