import { error, redirect } from '@sveltejs/kit';
import { bucketDeleteHref } from '#lib/links.js';
import { FileError } from '#lib/server/files.js';
import type { Actions, PageServerLoad } from './$types';

// Stops the bucket's unfinished multipart uploads, from the delete page's form. There is no
// page of its own: a visit goes back to the delete page.
export const load: PageServerLoad = ({ params }) => {
	redirect(303, bucketDeleteHref(params.bucket));
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const files = locals.files;
		if (!files.stopOpenUploads) error(404, { message: 'Not found.' });
		const form = await request.formData();
		// Checked here too, not only by the browser.
		if (form.get('confirm') !== 'yes')
			error(400, { message: 'Tick the box to confirm.', hint: 'Go back to the delete page.' });
		try {
			const r = await files.stopOpenUploads(params.bucket, String(form.get('token') ?? ''));
			if (r.failed)
				error(502, {
					message: `${r.stopped} unfinished upload${r.stopped === 1 ? ' was' : 's were'} stopped; ${r.failed} could not be.`,
					hint: 'Try again in a minute.'
				});
		} catch (err) {
			if (err instanceof FileError) error(err.status, { message: err.message, hint: err.hint });
			throw err;
		}
		redirect(303, bucketDeleteHref(params.bucket));
	}
};
