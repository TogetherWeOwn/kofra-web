import type { Handle } from '@sveltejs/kit/hooks';
import { openDemo, demoCookieName, demoSetCookie } from '#lib/server/demo.js';
import { config } from '#lib/server/env.js';
import { applyHeaders } from '#lib/server/headers.js';

export const handle: Handle = async ({ event, resolve }) => {
	const cfg = config();
	// Real sign-in does not exist yet, so the console serves nothing but demo data. Any other
	// mode refuses every request rather than show a workspace without authentication.
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
