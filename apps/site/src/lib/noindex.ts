import type { Handle } from '@sveltejs/kit/hooks';

/** Header value that keeps every page out of search indexes until launch. */
export const ROBOTS_HEADER_VALUE = 'noindex';

/** Server hook that adds `X-Robots-Tag: noindex` to every rendered response. */
export const noindex: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Robots-Tag', ROBOTS_HEADER_VALUE);
	return response;
};
