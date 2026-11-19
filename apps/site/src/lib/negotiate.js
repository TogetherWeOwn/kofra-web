// Content negotiation for Markdown twins. A request that prefers text/markdown over text/html
// (by its Accept header) gets the page's .md twin at the same URL; browsers get HTML.
// Used by the Worker entry that scripts/postbuild.mjs puts in front of SvelteKit's Worker.

// Plain JavaScript (types in JSDoc): scripts/postbuild.mjs copies this file next to the Worker
// entry, because wrangler does not re-bundle the adapter output.

/**
 * q-value of each media range in an Accept header ("text/html;q=0.9" -> 0.9).
 * @param {string | null} accept
 * @returns {Map<string, number>}
 */
export function acceptQ(accept) {
	/** @type {Map<string, number>} */
	const out = new Map();
	for (const part of (accept ?? '').split(',')) {
		const [range, ...params] = part.trim().toLowerCase().split(';');
		if (!range) continue;
		let q = 1;
		for (const p of params) {
			const [k, v] = p.trim().split('=');
			if (k === 'q' && v !== undefined) q = Math.max(0, Math.min(1, Number(v) || 0));
		}
		out.set(range.trim(), Math.max(q, out.get(range.trim()) ?? 0));
	}
	return out;
}

/**
 * True when the client asks for Markdown explicitly and ranks it at least as high as HTML.
 * "*\/*" alone means "anything", which is HTML.
 */
/** @param {string | null} accept */
export function prefersMarkdown(accept) {
	const q = acceptQ(accept);
	const md = Math.max(q.get('text/markdown') ?? 0, q.get('text/x-markdown') ?? 0);
	if (md <= 0) return false;
	const html = Math.max(q.get('text/html') ?? 0, q.get('application/xhtml+xml') ?? 0);
	return md >= html;
}

/**
 * "/" -> "/index.md", "/docs/" -> "/docs.md"; null for asset and dotted paths.
 * @param {string} pathname
 * @returns {string | null}
 */
export function twinFor(pathname) {
	if (pathname.startsWith('/_app/')) return null;
	const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	if (p === '/' || p === '') return '/index.md';
	if (/\.[a-z0-9]+$/i.test(p)) return null;
	return `${p}.md`;
}

/**
 * @typedef {{ fetch(request: Request): Promise<Response> }} Fetcher
 * @typedef {{ ASSETS: Fetcher }} Env
 * @typedef {{ fetch(request: Request, env: Env, ctx: unknown): Promise<Response> }} Handler
 */

/**
 * Wraps a Worker so pages with a Markdown twin honour `Accept: text/markdown`.
 * @param {Handler} app
 * @param {Set<string>} twins
 * @returns {Handler}
 */
export function withMarkdown(app, twins) {
	return {
		async fetch(request, env, ctx) {
			const url = new URL(request.url);
			const twin =
				request.method === 'GET' || request.method === 'HEAD' ? twinFor(url.pathname) : null;
			if (!twin || !twins.has(twin)) return app.fetch(request, env, ctx);
			if (prefersMarkdown(request.headers.get('accept'))) {
				const asset = await env.ASSETS.fetch(new Request(new URL(twin, url), request));
				const res = new Response(asset.body, asset);
				res.headers.set('content-type', 'text/markdown; charset=utf-8');
				res.headers.set('content-location', twin);
				res.headers.append('vary', 'Accept');
				return res;
			}
			const page = await app.fetch(request, env, ctx);
			const res = new Response(page.body, page);
			res.headers.append('vary', 'Accept');
			res.headers.set('link', `<${twin}>; rel="alternate"; type="text/markdown"`);
			return res;
		}
	};
}
