import { defineParams } from '@sveltejs/kit/params';
import { RESULTS } from './lib/pages/waitlist.ts';

export const params = defineParams({
	/** One of the four waitlist result pages (own keys only, so "toString" is not a page). */
	waitlistResult: (param) => (Object.hasOwn(RESULTS, param) ? param : undefined)
});
