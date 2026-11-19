import type { Handle } from '@sveltejs/kit/hooks';

/** Header value that keeps every page out of search indexes until launch. */
export const ROBOTS_HEADER_VALUE = 'noindex';

/**
 * Server hook that adds `X-Robots-Tag: noindex` to every response that
 * passes through `handle`. Static assets and prerendered pages get the same
 * header from the root `_headers` file. Two responses carry neither: the
 * framework's `/_app/env.js` script and `304 Not Modified` revalidations,
 * which SvelteKit produces outside `handle`. Neither is indexable content,
 * and a 304 keeps the header of the 200 it revalidates (RFC 9111 §4.3.4).
 */
export const noindex: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('X-Robots-Tag', ROBOTS_HEADER_VALUE);
	return response;
};
