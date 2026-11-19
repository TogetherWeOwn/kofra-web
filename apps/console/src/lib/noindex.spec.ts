import { describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { noindex, ROBOTS_HEADER_VALUE } from './noindex';

const event = {} as RequestEvent;

describe('noindex hook', () => {
	it('adds X-Robots-Tag: noindex to the response', async () => {
		const response = await noindex({ event, resolve: async () => new Response('ok') });
		expect(response.headers.get('X-Robots-Tag')).toBe(ROBOTS_HEADER_VALUE);
		expect(await response.text()).toBe('ok');
	});

	it('overrides a weaker robots header set by a route', async () => {
		const response = await noindex({
			event,
			resolve: async () => new Response('ok', { headers: { 'X-Robots-Tag': 'all' } })
		});
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
	});
});
