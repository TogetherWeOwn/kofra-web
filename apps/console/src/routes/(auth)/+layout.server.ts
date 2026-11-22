import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => ({
	mode: locals.mode,
	csrf: locals.me?.csrf
});
