import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';
import { makeHandle } from './handle.js';

function event(cookie?: string) {
	return {
		url: new URL('https://console.example/buckets'),
		cookies: { get: () => cookie },
		locals: {}
	} as unknown as RequestEvent;
}

describe('console request hook', () => {
	it('refuses every request unless the console is in demo mode', async () => {
		let resolved = false;
		const handle = makeHandle(() => readConfig({ CONSOLE_MODE: 'production' }));
		const res = await handle({
			event: event(),
			resolve: async () => {
				resolved = true;
				return new Response('workspace');
			}
		});
		expect(res.status).toBe(503);
		expect(resolved).toBe(false);
		expect(res.headers.get('x-robots-tag')).toBe('noindex');
	});

	it('serves demo mode through the SDK and saves only changed state', async () => {
		const handle = makeHandle(() => readConfig({ CONSOLE_MODE: 'demo' }));
		const read = await handle({
			event: event(),
			resolve: async (e) => {
				await e.locals.api.buckets.list();
				return new Response('ok');
			}
		});
		expect(read.status).toBe(200);
		expect(read.headers.get('set-cookie')).toBeNull();
		expect(read.headers.get('cache-control')).toBe('private, no-store');
		const write = await handle({
			event: event(),
			resolve: async (e) => {
				await e.locals.api.buckets.create({ body: { name: 'saved' } });
				return new Response('ok');
			}
		});
		expect(write.headers.get('set-cookie')).toMatch(
			/^__Host-kofra-demo=.+; HttpOnly; SameSite=Lax; Secure$/
		);
	});
});
