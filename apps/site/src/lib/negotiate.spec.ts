import { describe, expect, it } from 'vitest';
import { acceptQ, prefersMarkdown, twinFor, withMarkdown } from './negotiate';

describe('prefersMarkdown', () => {
	it('serves HTML to browsers and to clients that accept anything', () => {
		expect(prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')).toBe(
			false
		);
		expect(prefersMarkdown('*/*')).toBe(false);
		expect(prefersMarkdown(null)).toBe(false);
		expect(prefersMarkdown('text/markdown;q=0.5, text/html')).toBe(false);
	});

	it('serves Markdown when it is asked for and ranked at least as high as HTML', () => {
		expect(prefersMarkdown('text/markdown')).toBe(true);
		expect(prefersMarkdown('text/markdown, text/html;q=0.9')).toBe(true);
		expect(prefersMarkdown('text/x-markdown, */*;q=0.1')).toBe(true);
		expect(prefersMarkdown('text/markdown;q=0')).toBe(false);
		expect(prefersMarkdown('text/markdown, */*')).toBe(true);
	});

	it('lets a wildcard outrank a low-priority Markdown range', () => {
		expect(prefersMarkdown('text/markdown;q=0.1, */*')).toBe(false);
		expect(prefersMarkdown('text/markdown;q=0.5, text/*;q=0.9')).toBe(false);
	});

	it('parses q-values defensively', () => {
		expect(acceptQ('text/markdown;q=abc, TEXT/HTML;q=2').get('text/html')).toBe(1);
		expect(acceptQ('text/markdown;q=abc').get('text/markdown')).toBe(0);
	});
});

describe('twinFor', () => {
	it('maps page paths to their twin and ignores assets', () => {
		expect(twinFor('/')).toBe('/index.md');
		expect(twinFor('/docs')).toBe('/docs.md');
		expect(twinFor('/docs/')).toBeNull(); // the framework redirects it first
		expect(twinFor('/legal/terms')).toBe('/legal/terms.md');
		expect(twinFor('/_app/immutable/x.js')).toBeNull();
		expect(twinFor('/og.png')).toBeNull();
	});
});

describe('withMarkdown', () => {
	const twins = new Set(['/index.md', '/docs.md']);
	const app = {
		fetch: async () => new Response('<h1>Home</h1>', { headers: { 'content-type': 'text/html' } })
	};
	const env = {
		ASSETS: {
			fetch: async (r: Request) =>
				new Response(`# from ${new URL(r.url).pathname}`, { headers: { etag: '"1"' } })
		}
	};
	const get = (path: string, accept?: string, method = 'GET') =>
		withMarkdown(app, twins, 'https://kofra.app').fetch(
			new Request(`https://kofra.test${path}`, { method, headers: accept ? { accept } : {} }),
			env,
			{}
		);

	it('returns the twin, typed as Markdown and varying on Accept', async () => {
		const res = await get('/', 'text/markdown');
		expect(await res.text()).toBe('# from /index.md');
		expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
		expect(res.headers.get('vary')).toContain('Accept');
		expect(res.headers.get('content-location')).toBe('/index.md');
		expect(res.headers.get('link')).toBe('<https://kofra.app/>; rel="canonical"');
	});

	it('points a directly requested twin at its canonical page', async () => {
		const res = await get('/docs.md');
		expect(res.headers.get('link')).toBe('<https://kofra.app/docs>; rel="canonical"');
	});

	it('returns HTML otherwise, still varying on Accept and linking the twin', async () => {
		const res = await get('/', 'text/html');
		expect(await res.text()).toBe('<h1>Home</h1>');
		expect(res.headers.get('vary')).toContain('Accept');
		expect(res.headers.get('link')).toBe('</index.md>; rel="alternate"; type="text/markdown"');
	});

	it('leaves error pages undecorated', async () => {
		const missing = withMarkdown(
			{ fetch: async () => new Response('gone', { status: 404 }) },
			twins,
			'https://kofra.app'
		);
		const res = await missing.fetch(new Request('https://kofra.test/docs'), env, {});
		expect(res.status).toBe(404);
		expect(res.headers.get('vary')).toBeNull();
		expect(res.headers.get('link')).toBeNull();
	});

	it('keeps Vary: Accept on a 304 revalidation', async () => {
		const cached = withMarkdown(
			{ fetch: async () => new Response(null, { status: 304 }) },
			twins,
			'https://kofra.app'
		);
		const res = await cached.fetch(new Request('https://kofra.test/docs'), env, {});
		expect(res.status).toBe(304);
		expect(res.headers.get('vary')).toContain('Accept');
	});

	it('does not treat /index as the home page twin', async () => {
		const res = await get('/index', 'text/markdown');
		expect(await res.text()).toBe('<h1>Home</h1>');
		expect(res.headers.get('content-location')).toBeNull();
	});

	it('passes through paths without a twin and non-GET methods untouched', async () => {
		expect((await get('/nope', 'text/markdown')).headers.get('vary')).toBeNull();
		expect(await (await get('/', 'text/markdown', 'POST')).text()).toBe('<h1>Home</h1>');
	});
});
