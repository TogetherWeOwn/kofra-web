import type { Handle } from '@sveltejs/kit/hooks';
import { Kofra } from '@kofra/api';
import { createAccessVerifier, type AccessVerifier } from './access.js';
import type { ConsoleConfig, Tenant0Config } from './config.js';
import { demoCookieName, demoSetCookie, openDemo } from './demo.js';
import { demoFiles } from './files.js';
import { checkRequest, forbidden, sameOrigin } from './gate.js';
import { applyHeaders } from './headers.js';
import { handleLive } from './live.js';
import { createStorageClient } from './storage/client.js';
import { LOCAL_TOKEN, Tenant0Api } from './tenant0/api.js';
import { Tenant0Files } from './tenant0/files.js';
import { tokenKey } from './tokens.js';
import { DEMO_WORKSPACE, tenant0Workspace } from './workspace.js';

function unavailable(): Response {
	return applyHeaders(
		new Response('This console is not configured.', {
			status: 503,
			headers: { 'content-type': 'text/plain' }
		})
	);
}

/**
 * One verifier per isolate and configuration, so the Access certs are cached between
 * requests. Tests pass their own.
 */
let cached: { key: string; verify: AccessVerifier } | null = null;
function verifierFor(cfg: Tenant0Config): AccessVerifier {
	const key = JSON.stringify(cfg.access);
	if (cached?.key !== key)
		cached = {
			key,
			verify: createAccessVerifier({
				teamDomain: cfg.access.teamDomain,
				aud: cfg.access.aud,
				allowedEmails: cfg.access.allowedEmails
			})
		};
	return cached.verify;
}

export interface HandleOptions {
	verifier?: (cfg: Tenant0Config) => AccessVerifier;
	now?: () => number;
}

/**
 * The console's request hook. "demo" serves per-visitor sample data. "tenant0" serves the
 * operator's own storage account and first checks Cloudflare Access's signed token on every
 * request (gate.ts). Any other configuration refuses every request: a build never serves a
 * workspace without its sign-in. "live" and "live-fake" sign customers in through the
 * account service (live.ts).
 */
export function makeHandle(getConfig: () => ConsoleConfig, options: HandleOptions = {}): Handle {
	return async ({ event, resolve }) => {
		const cfg = getConfig();
		if (cfg.mode === 'live' || cfg.mode === 'live-fake') return handleLive(cfg, event, resolve);
		// The modes below have no customer sign-in.
		event.locals.mode = cfg.mode;
		event.locals.account = null;
		event.locals.me = null;
		event.locals.member = null;
		if (cfg.mode === 'demo') {
			const { demo, api } = openDemo(event.url, event.cookies.get(demoCookieName(event.url)));
			event.locals.demo = demo;
			event.locals.api = api;
			event.locals.files = demoFiles(demo);
			event.locals.workspace = DEMO_WORKSPACE;
			event.locals.countsComplete = async () => true;
			event.locals.billing = cfg.billing;
			const response = await resolve(event);
			if (demo.dirty && !event.locals.demoReset)
				response.headers.append('set-cookie', demoSetCookie(event.url, demo));
			return applyHeaders(response);
		}
		if (cfg.mode !== 'tenant0' || !cfg.tenant0) {
			console.log(JSON.stringify({ event: 'console-unconfigured', setting: cfg.problem }));
			return unavailable();
		}
		const t = cfg.tenant0;
		const gate = await checkRequest(event.request, t, (options.verifier ?? verifierFor)(t));
		if (!gate.ok) {
			// The reason only: never the token or a claim.
			console.log(JSON.stringify({ event: 'access-denied', reason: gate.reason }));
			return applyHeaders(forbidden());
		}
		if (!sameOrigin(event.request, event.url)) return applyHeaders(forbidden());
		const now = options.now ?? Date.now;
		const storage = createStorageClient(t.storage, now);
		const tenant = new Tenant0Api(t, storage, { now });
		event.locals.api = new Kofra({
			token: LOCAL_TOKEN,
			baseUrl: 'https://api.kofra.app',
			fetch: tenant.fetch,
			// A retried write could repeat it; the transport answers in one go.
			maxRetries: 0
		});
		event.locals.files = new Tenant0Files(tenant, storage, tokenKey(t.storage.secret), now);
		event.locals.workspace = tenant0Workspace(t.workspaceName, t.storage.keyId, t.protectedBuckets);
		// A failed read is reported by the page's own API call (as busy storage), not here.
		event.locals.countsComplete = () =>
			tenant.usage().then(
				(u) => u.seeded,
				() => true
			);
		event.locals.billing = cfg.billing;
		return applyHeaders(await resolve(event));
	};
}
