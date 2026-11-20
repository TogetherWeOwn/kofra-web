import { KofraError } from '@kofra/api';
import { DemoLimit } from '@kofra/api/demo';
import { error, fail } from '@sveltejs/kit';

import type { ShownProblem } from '#lib/types.js';

/**
 * Next steps worded for the console. The API's own hints are written for programs (they
 * name endpoints and headers); a code without an entry here shows no hint.
 */
const CONSOLE_HINTS: Record<string, string> = {
	bucket_not_found: 'Check the name in the bucket list; it may have been deleted.',
	key_not_found: 'The key may already be revoked. Check the list of access keys.',
	bucket_not_empty: 'Delete every file in the bucket first, then delete the bucket.',
	bucket_already_exists: 'Choose another name.',
	invalid_bucket_name: 'Use 3 to 63 lowercase letters, digits or hyphens.',
	key_limit_reached: 'Revoke a key you no longer use, then create the new one.',
	grant_narrowing_refused: 'Create a new key with the narrower access, then revoke this one.',
	grant_limit_reached: 'Create another key for the remaining buckets.',
	deletion_already_requested: 'Cancel the pending request first if you want to start again.',
	account_read_only: 'Your workspace is read-only for now. See Billing.',
	rate_limited: 'Wait a moment, then try again.',
	service_unavailable: 'Try again in a minute.',
	internal_error: 'Try again. If it keeps happening, contact support with the request ID.'
};

export function describe(err: unknown): ShownProblem {
	if (err instanceof KofraError)
		return {
			message: err.problem.detail,
			hint: CONSOLE_HINTS[err.code],
			requestId: err.requestId,
			code: err.code
		};
	if (err instanceof DemoLimit)
		return {
			message: err.message,
			hint: 'Delete something you added, or reset the demo in Settings.',
			code: 'demo_limit'
		};
	throw err;
}

/** For load functions: a refused request becomes the error page, with the API's status. */
export function loadFailed(err: unknown): never {
	const shown = describe(err);
	const status =
		err instanceof KofraError && err.status >= 400 && err.status <= 599 ? err.status : 500;
	error(status, shown);
}

/** For form actions: a refused request goes back to the form as `problem`. */
export function actionFailed<T extends Record<string, unknown>>(err: unknown, extra: T = {} as T) {
	const shown = describe(err);
	const status =
		err instanceof KofraError && err.status >= 400 && err.status < 500 ? err.status : 400;
	return fail(status, { ...extra, problem: shown });
}
