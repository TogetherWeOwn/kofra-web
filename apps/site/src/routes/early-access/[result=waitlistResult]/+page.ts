import { RESULTS, type WaitlistResult } from '#lib/pages/waitlist.js';

export const prerender = true;
export const entries = () =>
	(Object.keys(RESULTS) as WaitlistResult[]).map((result) => ({ result }));

export function load({ params }) {
	return { result: params.result as WaitlistResult };
}
