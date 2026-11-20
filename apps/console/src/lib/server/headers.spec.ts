import { describe, expect, it } from 'vitest';
import { applyHeaders, catchAllHeaders, CONSOLE_HEADERS } from './headers.js';

describe('console headers', () => {
	it('reads the catch-all rule of _headers', () => {
		expect(catchAllHeaders('# c\n/*\n  A: 1\n  B: two: three\n/x\n  C: 3\n')).toEqual([
			['A', '1'],
			['B', 'two: three']
		]);
		expect(Object.fromEntries(CONSOLE_HEADERS)['X-Robots-Tag']).toBe('noindex');
	});

	it('marks rendered pages noindex and uncacheable, keeping a route’s own cache rule', () => {
		const r = applyHeaders(new Response('ok', { headers: { 'X-Robots-Tag': 'all' } }));
		expect(r.headers.get('x-robots-tag')).toBe('noindex');
		expect(r.headers.get('cache-control')).toBe('private, no-store');
		expect(r.headers.get('x-content-type-options')).toBe('nosniff');
		const kept = applyHeaders(new Response('ok', { headers: { 'cache-control': 'no-cache' } }));
		expect(kept.headers.get('cache-control')).toBe('no-cache');
	});
});
