// The confirmation link opens this page; a button POST confirms. A GET never changes anything,
// so mail scanners that fetch links cannot confirm an address on the owner's behalf.
import { error, redirect } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import { clientKey, confirm } from '#lib/server/waitlist.js';
import { waitlistRuntime, type WaitlistEnv } from '#lib/server/waitlist-env.js';

export const prerender = false;

export function load({ url, setHeaders }) {
	if (!waitlistRuntime(env as WaitlistEnv)) error(404, 'Not found');
	// The token is in the URL: never cache the page. The site-wide Referrer-Policy
	// (strict-origin-when-cross-origin) already keeps the path and query from other origins. Do not
	// tighten it to no-referrer here: browsers then send "Origin: null" with the form post, and
	// the cross-site check rejects the confirmation.
	setHeaders({ 'cache-control': 'no-store' });
	return { token: (url.searchParams.get('token') ?? '').slice(0, 64) };
}

export const actions = {
	default: async ({ request }) => {
		const rt = waitlistRuntime(env as WaitlistEnv);
		if (!rt) error(404, 'Not found');
		const ip = request.headers.get('cf-connecting-ip');
		const { success } = await rt.rate.limit({ key: `confirm:${clientKey(ip)}` });
		if (!success) redirect(303, '/early-access/try-again');
		const form = await request.formData().catch(() => null);
		const result = await confirm(form?.get('token'), rt.deps);
		redirect(
			303,
			result === 'confirmed' ? '/early-access/confirmed' : '/early-access/link-expired'
		);
	}
};
