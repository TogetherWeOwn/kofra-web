import type { Handle } from '@sveltejs/kit/hooks';
import raw from '../../_headers?raw';
import { INDEXABLE } from '#lib/site.js';

/**
 * Headers of the catch-all `/*` rule in a Cloudflare `_headers` file. Comments and other
 * path rules are ignored; a `! Name` line (detach) is not supported and is rejected.
 */
export function catchAllHeaders(text: string): [string, string][] {
	const out: [string, string][] = [];
	let inCatchAll = false;
	for (const line of text.split('\n')) {
		if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
		if (!/^\s/.test(line)) {
			inCatchAll = line.trim() === '/*';
			continue;
		}
		if (!inCatchAll) continue;
		const t = line.trim();
		if (t.startsWith('!')) throw new Error(`_headers: detach lines are not supported: ${t}`);
		const at = t.indexOf(':');
		if (at < 1) throw new Error(`_headers: not a header line: ${t}`);
		out.push([t.slice(0, at).trim(), t.slice(at + 1).trim()]);
	}
	return out;
}

/**
 * The site-wide headers, from the same `_headers` file that static assets use. An indexable
 * (production) build drops X-Robots-Tag here and in the built `_headers` (scripts/postbuild.mjs).
 */
export const siteHeaderList = (indexable: boolean) =>
	catchAllHeaders(raw).filter(([name]) => !indexable || name.toLowerCase() !== 'x-robots-tag');

export const SITE_HEADERS = siteHeaderList(INDEXABLE);

/**
 * Server hook (built with `headersHook(dev)`): responses the Worker renders (404 pages, any dynamic route) get the same
 * headers as static assets and prerendered pages, including `X-Robots-Tag: noindex`.
 * Two framework responses bypass `handle`: `/_app/env.js` and `304 Not Modified`
 * revalidations; neither is indexable content (RFC 9111 §4.3.4 keeps the 200's headers).
 */
export function headersHook(dev: boolean): Handle {
	// `vite dev` inlines CSS as <style> elements, which the production CSP blocks.
	const headers = dev
		? SITE_HEADERS.filter(([name]) => name.toLowerCase() !== 'content-security-policy')
		: SITE_HEADERS;
	return async ({ event, resolve }) => {
		const response = await resolve(event);
		for (const [name, value] of headers) response.headers.set(name, value);
		return response;
	};
}

export const siteHeaders = headersHook(import.meta.env.DEV);
