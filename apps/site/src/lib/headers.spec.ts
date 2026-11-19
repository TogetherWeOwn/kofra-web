import { readFileSync } from 'node:fs';
import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { catchAllHeaders, headersHook, siteHeaderList } from './headers';

const file = readFileSync(new URL('../../_headers', import.meta.url), 'utf8');
const event = {} as RequestEvent;

describe('_headers', () => {
	it('keeps every page out of search indexes and sets a strict CSP', () => {
		const h = new Map(catchAllHeaders(file));
		expect(h.get('X-Robots-Tag')).toBe('noindex');
		const csp = h.get('Content-Security-Policy') ?? '';
		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("script-src 'self';");
		expect(csp).toContain("style-src 'self';");
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
		expect(h.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('reads only the catch-all rule and rejects lines it cannot apply', () => {
		const text = '# c\n/docs/*\n  A: 1\n/*\n  B: 2\n  C: x: y\n';
		expect(catchAllHeaders(text)).toEqual([
			['B', '2'],
			['C', 'x: y']
		]);
		expect(() => catchAllHeaders('/*\n  ! B\n')).toThrow(/detach/);
		expect(() => catchAllHeaders('/*\n  nonsense\n')).toThrow(/not a header/);
	});
});

describe('siteHeaderList', () => {
	const robots = (list: [string, string][]) =>
		list.filter(([n]) => n.toLowerCase() === 'x-robots-tag').map(([, v]) => v);

	it('keeps noindex on Worker-rendered responses until the site is indexable', () => {
		expect(robots(siteHeaderList(false))).toEqual(['noindex']);
	});

	it('drops only X-Robots-Tag in the indexable build', () => {
		const staging = siteHeaderList(false);
		const live = siteHeaderList(true);
		expect(robots(live)).toEqual([]);
		expect(live).toHaveLength(staging.length - 1);
	});
});

describe('siteHeaders hook', () => {
	it('adds the headers to rendered responses and overrides weaker ones', async () => {
		const response = await headersHook(false)({
			event,
			resolve: async () => new Response('ok', { headers: { 'X-Robots-Tag': 'all' } })
		});
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
		expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
		expect(await response.text()).toBe('ok');
	});

	it('leaves the CSP out in development, where styles are inlined', async () => {
		const response = await headersHook(true)({
			event,
			resolve: async () => new Response('ok')
		});
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
		expect(response.headers.get('Content-Security-Policy')).toBeNull();
	});
});
