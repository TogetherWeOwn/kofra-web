// Demo mode: every visitor gets their own sample workspace, kept in one cookie. The console
// talks to it through the real SDK; only the transport differs (see @kofra/api/demo).
import { Kofra } from '@kofra/api';
import { DemoApi, DEMO_TOKEN, decodeState, encodeState } from '@kofra/api/demo';

/** The cookie holds sample data only: no identity, no secret. */
export const demoCookieName = (url: URL) =>
	url.protocol === 'https:' ? '__Host-kofra-demo' : 'kofra-demo';

/** Largest file the demo accepts; the bytes are counted and thrown away. */
export const DEMO_MAX_UPLOAD = 25_000_000;

/** The demo keeps a visitor's changes for a week after their last change. */
const MAX_AGE = 7 * 24 * 3600;

/** Downloads in the demo point here: a short placeholder file served by the console. */
export const demoFilePath = (bucket: string, key: string) =>
	`/demo-files/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;

export function openDemo(url: URL, cookie: string | undefined) {
	const demo = new DemoApi(decodeState(cookie), {
		endpoint: 'https://s3.kofra.io',
		downloadUrl: (bucket, key, expiresAt) =>
			`${url.origin}${demoFilePath(bucket, key)}?expires=${Math.floor(expiresAt.getTime() / 1000)}`,
		confirmDeletionUrl: `${url.origin}/settings`
	});
	// No retries: nothing crosses a network, and a retried demo write would only repeat it.
	const api = new Kofra({
		token: DEMO_TOKEN,
		baseUrl: 'https://api.kofra.app',
		fetch: demo.fetch,
		maxRetries: 0
	});
	return { demo, api };
}

/** The Set-Cookie value that saves the visitor's demo state. */
export function demoSetCookie(url: URL, demo: DemoApi): string {
	const secure = url.protocol === 'https:';
	return [
		`${demoCookieName(url)}=${encodeState(demo.state)}`,
		'Path=/',
		`Max-Age=${MAX_AGE}`,
		'HttpOnly',
		'SameSite=Lax',
		...(secure ? ['Secure'] : [])
	].join('; ');
}
