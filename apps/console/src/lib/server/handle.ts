import { Kofra } from '@kofra/api';
import type { Handle } from '@sveltejs/kit/hooks';
import { AccountClient, AccountProblem } from './account/client.js';
import { mintAssertion } from './account/assertion.js';
import { checkCsrf } from './account/csrf.js';
import { clearSession, loopback, nextPath, SESSION_COOKIE } from './account/session.js';
import type { ConsoleConfig } from './config.js';
import { demoCookieName, demoSetCookie, openDemo } from './demo.js';
import { applyHeaders } from './headers.js';

const publicPages = new Set(['/sign-in', '/signup', '/verify', '/reset', '/reset/new']);
const publicPasskey = new Set(['/sign-in/passkey/begin', '/sign-in/passkey/finish']);
const stagePages = {
	second_step: [
		'/two-factor',
		'/two-factor/passkey/begin',
		'/two-factor/passkey/finish',
		'/sign-out'
	],
	verify_email: ['/verify', '/sign-out'],
	workspace: [
		'/welcome',
		'/verify',
		'/account',
		'/account/passkey/begin',
		'/account/passkey/finish'
	]
};

export function makeHandle(getConfig: () => ConsoleConfig): Handle {
	return async ({ event, resolve }) => {
		const cfg = getConfig();
		const { url, locals, cookies } = event;
		const pathname = url.pathname.replace(/\/$/, '') || '/';
		const routePath = event.route?.id?.replace(/^\/\((?:app|auth)\)/, '');
		const path = routePath && !routePath.includes('[') ? routePath : pathname;
		const passkey = /\/passkey\/(?:begin|finish)$/.test(path);
		const accountPage = path === '/account' || path.startsWith('/account/passkey/');
		const publicRoute = publicPages.has(path) || publicPasskey.has(path);
		let expiredCookie: string | undefined;
		const sensitive =
			event.route?.id?.startsWith('/(auth)') ||
			accountPage ||
			path === '/tokens/new' ||
			path === '/__fake/last-token';
		const finish = (response: Response, resolved = false) => {
			// Redirects and service binding responses may have immutable headers.
			const out = new Response(response.body, response);
			if (sensitive && cfg.mode !== 'demo') out.headers.set('cache-control', 'no-store');
			if (expiredCookie && !resolved) out.headers.append('set-cookie', expiredCookie);
			applyHeaders(out);
			if (cfg.mode !== 'demo' && event.route?.id?.startsWith('/(auth)'))
				out.headers.set('referrer-policy', 'strict-origin');
			return out;
		};
		const unavailable = () =>
			finish(
				new Response('This console is not configured.', {
					status: 503,
					headers: { 'content-type': 'text/plain' }
				})
			);
		if (cfg.mode === 'unconfigured' || (cfg.mode === 'live-fake' && !loopback(url)))
			return unavailable();

		locals.mode = cfg.mode;
		locals.billing = cfg.billing;
		locals.account = null;
		locals.me = null;
		locals.workspace = null;
		locals.demo = null;

		if (cfg.mode !== 'demo') {
			if (path === '/__fake/last-token') {
				if (cfg.mode !== 'live-fake' || event.request.method !== 'GET')
					return finish(new Response(null, { status: 404 }));
				return finish(
					await cfg.account!.fetch(new Request(`https://account.internal${path}${url.search}`))
				);
			}
			const cookie = cookies.get(SESSION_COOKIE);
			const account = new AccountClient(cfg.account!, event, cookie);
			locals.account = account;
			if (cookie) {
				try {
					locals.me = await account.resolve();
				} catch (err) {
					if (err instanceof AccountProblem && err.code === 'session_invalid') {
						expiredCookie = clearSession(cookies);
						locals.account = new AccountClient(cfg.account!, event);
					} else if (err instanceof AccountProblem)
						return finish(
							new Response('Try again in a minute.', {
								status: 503,
								headers: err.retryAfter ? { 'Retry-After': err.retryAfter } : undefined
							})
						);
					else throw err;
				}
			}

			const me = locals.me;
			const redirect = (to: string) =>
				finish(new Response(null, { status: 303, headers: { location: to } }));
			const read = ['GET', 'HEAD'].includes(event.request.method);
			if (!read && (!publicRoute || (passkey && me))) {
				if (!me) return finish(new Response('This request was refused.', { status: 403 }));
				const type = event.request.headers.get('content-type') ?? '';
				let csrf: FormDataEntryValue | null = event.request.headers.get('x-kofra-csrf');
				if (
					!passkey &&
					csrf === null &&
					/^(application\/x-www-form-urlencoded|multipart\/form-data)\b/i.test(type)
				)
					csrf =
						(
							await event.request
								.clone()
								.formData()
								.catch(() => null)
						)?.get('_csrf') ?? null;
				if (!checkCsrf(me.csrf, csrf))
					return finish(new Response('This request was refused.', { status: 403 }));
			}
			// An account action can require fresh sign-in before a workspace exists.
			const confirmingAccount =
				me?.needs === 'workspace' &&
				(path === '/confirm-identity' || path.startsWith('/confirm-identity/passkey/')) &&
				url.searchParams.get('next') === '/account';
			if (me?.needs && !stagePages[me.needs].includes(path) && !confirmingAccount) {
				const params = new URLSearchParams({
					next: nextPath(url.searchParams.get('next') ?? pathname + url.search)
				});
				if (me.needs === 'second_step') return redirect(`/two-factor?${params}`);
				if (me.needs === 'verify_email')
					return redirect(`/verify?${new URLSearchParams({ email: me.user.email })}`);
				return redirect('/welcome');
			}
			if (!me && !publicRoute && event.route.id)
				return redirect(
					`/sign-in?${new URLSearchParams({ next: nextPath(pathname + url.search) })}`
				);

			const selected = cookies.get('kofra_ws');
			locals.workspace =
				me?.workspaces.find((ws) => ws.id === selected) ??
				me?.workspaces.find((ws) => ws.state === 'active') ??
				me?.workspaces[0] ??
				null;
			if (
				locals.workspace?.state === 'setting_up' &&
				event.route.id?.startsWith('/(app)/') &&
				!accountPage
			)
				return redirect('/');
		}

		if (cfg.mode === 'live') {
			const me = locals.me;
			const workspace = locals.workspace;
			locals.api = new Kofra({
				// Replace the SDK's static credential inside its transport, including each retry.
				token: 'console',
				baseUrl: 'https://api.kofra.app',
				fetch: async (input, init) => {
					if (!workspace || workspace.state !== 'active' || !me)
						throw new Error('An active workspace is required.');
					const request = new Request(input, init);
					const assertion = await mintAssertion(
						cfg.assertionKey!,
						workspace.id,
						me.user.id,
						me.session.id,
						Math.floor(Date.now() / 1000)
					);
					request.headers.set('Authorization', `Bearer ${assertion}`);
					return cfg.api!.fetch(request);
				}
			});
		} else {
			const { demo, api } = openDemo(url, cookies.get(demoCookieName(url)));
			locals.demo = demo;
			locals.api = api;
		}

		const response = finish(await resolve(event), true);
		if (locals.demo?.dirty && !locals.demoReset)
			response.headers.append('set-cookie', demoSetCookie(url, locals.demo));
		return response;
	};
}
