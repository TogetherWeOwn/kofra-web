import { KofraError } from '@kofra/api';
import { DemoLimit } from '@kofra/api/demo';
import { error, fail } from '@sveltejs/kit';

import type { ShownProblem } from '#lib/types.js';

export function describe(err: unknown): ShownProblem {
	if (err instanceof KofraError)
		return {
			message: err.problem.detail,
			hint: err.hint,
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
