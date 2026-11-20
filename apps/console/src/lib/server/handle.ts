import type { Handle } from '@sveltejs/kit/hooks';
import type { ConsoleConfig } from './config.js';
import { demoCookieName, demoSetCookie, openDemo } from './demo.js';
import { applyHeaders } from './headers.js';

/**
 * The console's request hook. Real sign-in does not exist yet, so it serves nothing but demo
 * data: any mode other than "demo" refuses every request rather than show a workspace
 * without authentication. In demo mode it opens the visitor's demo from its cookie, runs
 * the SDK over it, and saves the cookie when a request changed the demo.
 */
export function makeHandle(getConfig: () => ConsoleConfig): Handle {
	return async ({ event, resolve }) => {
		const cfg = getConfig();
		if (cfg.mode !== 'demo')
			return applyHeaders(
				new Response('This console is not configured.', {
					status: 503,
					headers: { 'content-type': 'text/plain' }
				})
			);
		const { demo, api } = openDemo(event.url, event.cookies.get(demoCookieName(event.url)));
		event.locals.demo = demo;
		event.locals.api = api;
		event.locals.billing = cfg.billing;
		const response = await resolve(event);
		if (demo.dirty && !event.locals.demoReset)
			response.headers.append('set-cookie', demoSetCookie(event.url, demo));
		return applyHeaders(response);
	};
}
