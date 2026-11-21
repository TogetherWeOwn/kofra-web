import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { mintAssertion } from './account/assertion.js';
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

it('refuses live-fake requests from a non-loopback hostname even for public paths', async () => {
	const handle = makeHandle(() => readConfig({ CONSOLE_MODE: 'live-fake' }));
	const res = await handle({
		event: { ...event(), url: new URL('https://localhost.example/sign-in') },
		resolve: async () => {
			throw new Error('The request should be refused before routing.');
		}
	});
	expect(res.status).toBe(503);
	expect(await res.text()).toBe('This console is not configured.');
	expect(res.headers.get('x-robots-tag')).toBe('noindex');
});

it('signs each live API call for the selected member workspace', async () => {
	const now = vi.spyOn(Date, 'now').mockReturnValue(1763546410_000);
	const key = Uint8Array.from({ length: 32 }, (_, i) => i);
	const ws = (id: string) => ({ id, name: id, role: 'member', state: 'active' }) as const;
	const headers: (string | null)[] = [];
	const me = {
		user: { id: 'usr_example' },
		session: { id: 'ses_example' },
		workspaces: [ws('ws_first'), ws('ws_selected')],
		csrf: 'csrf_test',
		needs: null
	};
	const handle = makeHandle(() => ({
		...readConfig({ CONSOLE_MODE: 'demo' }),
		mode: 'live',
		account: {
			async fetch(req) {
				expect(req.headers.get('Kofra-Session')).toBe('test-session');
				expect(req.url).toBe('https://account.internal/account/v1/session/resolve');
				return Response.json(me);
			}
		},
		api: {
			async fetch(req) {
				headers.push(req.headers.get('authorization'));
				expect(req.url).toBe('https://api.kofra.app/v1/account');
				return Response.json({});
			}
		},
		assertionKey: key
	}));
	try {
		const request = new Request('https://console.example/');
		const status = await handle({
			event: {
				...event(),
				url: new URL(request.url),
				request,
				route: { id: '/(app)' },
				getClientAddress: () => '192.0.2.1',
				cookies: {
					get: (name: string) => (name === 'kofra_ws' ? 'ws_selected' : 'test-session')
				} as RequestEvent['cookies']
			},
			resolve: async ({ locals }) => {
				await locals.api.account.get();
				now.mockReturnValue(1763546411_000);
				await locals.api.account.get();
				return new Response('ok');
			}
		});
		expect(status.status).toBe(200);
		expect(headers).toEqual(
			await Promise.all(
				[1763546410, 1763546411].map(
					async (secs) =>
						`Bearer ${await mintAssertion(key, 'ws_selected', me.user.id, me.session.id, secs)}`
				)
			)
		);
	} finally {
		now.mockRestore();
	}
});

describe('live-fake stage gating', () => {
	const handle = makeHandle(() => readConfig({ CONSOLE_MODE: 'live-fake' }));
	const run = (path: string, init: RequestInit = {}) =>
		handle({
			event: {
				...event(),
				url: new URL(`http://localhost${path}`),
				request: new Request(`http://localhost${path}`, init),
				getClientAddress: () => '127.0.0.1',
				cookies: { get: () => undefined, set: () => {}, delete: () => {}, serialize: () => '' },
				route: {
					id: path.startsWith('/account')
						? '/(app)/account'
						: path.startsWith('/sign-in')
							? '/(auth)/sign-in'
							: null
				}
			},
			resolve: async () => new Response('page')
		} as never);

	it('refuses a POST to an account route without a session', async () => {
		const res = await run('/account?/profile', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: 'name=x'
		});
		expect(res.status).toBe(403);
	});

	it('refuses an oversized body on a sign-in route before parsing it', async () => {
		const res = await run('/sign-in', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'content-length': String(65 * 1024) },
			body: '{}'
		});
		expect(res.status).toBe(413);
	});

	it('serves the fake mail endpoint only in live-fake, and only for GET', async () => {
		const res = await run('/__fake/last-token?email=x', { method: 'POST' });
		expect(res.status).toBe(404);
	});
});
