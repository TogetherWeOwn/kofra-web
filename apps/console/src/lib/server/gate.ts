// The Worker's own check of every request in tenant0 mode. Cloudflare Access guards the host
// at the edge; the Worker verifies Access's signed token itself, so a request that reaches it
// any other way is refused before any page code runs or any call leaves the Worker.
import { AccessDenied, type AccessVerifier } from './access.js';
import type { Tenant0Config } from './config.js';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const LOOPBACK_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):[0-9]{1,5}$/;

export type GateResult = { ok: true; email: string } | { ok: false; reason: string };

/**
 * `DEV_AUTH=local` lets local tests run without Access, and only when every one of these
 * holds: the request names a loopback host, the storage service is a loopback fake reached
 * over http, and no service binding is configured (config.ts refuses an origin next to a
 * binding). A deployed Worker has a real host and a binding, so the flag cannot open it.
 */
export function devBypass(url: URL, cfg: Tenant0Config): boolean {
	return (
		cfg.devAuth &&
		LOOPBACK_HOSTS.has(url.hostname) &&
		cfg.storage.origin !== null &&
		LOOPBACK_ORIGIN.test(cfg.storage.origin)
	);
}

export async function checkRequest(
	request: Request,
	cfg: Tenant0Config,
	verify: AccessVerifier
): Promise<GateResult> {
	const url = new URL(request.url);
	if (devBypass(url, cfg)) return { ok: true, email: 'local-test' };
	try {
		const claims = await verify(request.headers.get('cf-access-jwt-assertion'));
		return { ok: true, email: claims.email.toLowerCase() };
	} catch (e) {
		return { ok: false, reason: e instanceof AccessDenied ? e.reason : 'error' };
	}
}

/**
 * Requests that change something must come from the console's own pages: an `Origin` equal
 * to the console's origin. SvelteKit checks form posts itself; this also covers JSON posts
 * and the upload PUTs, which it does not.
 */
export function sameOrigin(request: Request, url: URL): boolean {
	const m = request.method;
	if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true;
	return request.headers.get('origin') === url.origin;
}

export function forbidden(): Response {
	return new Response('Forbidden\n', {
		status: 403,
		headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
	});
}
