// POST /early-access/join: the waitlist form. 404 unless the waitlist is fully configured.
// SvelteKit rejects cross-origin form posts before this runs (CSRF origin check).
import { error, redirect } from '@sveltejs/kit';
import { env, waitUntil } from 'cloudflare:workers';
import { join, normaliseEmail, verifyTurnstile } from '#lib/server/waitlist.js';
import { waitlistRuntime, type WaitlistEnv } from '#lib/server/waitlist-env.js';

export const prerender = false;
const MAX_BODY = 8 * 1024;

export async function POST({ request, url }) {
	const rt = waitlistRuntime(env as WaitlistEnv);
	if (!rt) error(404, 'Not found');
	const ip = request.headers.get('cf-connecting-ip');
	const { success } = await rt.rate.limit({ key: `join:${ip ?? 'unknown'}` });
	if (!success) redirect(303, '/early-access/try-again');
	if (Number(request.headers.get('content-length') ?? MAX_BODY + 1) > MAX_BODY) {
		redirect(303, '/early-access/try-again');
	}
	const form = await request.formData().catch(() => null);
	if (!form) redirect(303, '/early-access/try-again');
	const human = await verifyTurnstile(form.get('cf-turnstile-response'), {
		secret: rt.turnstileSecret,
		ip,
		hostname: url.hostname
	});
	if (!human) redirect(303, '/early-access/try-again');
	// Only the shape of the address decides between the two answers. Whether it is new, pending or
	// already confirmed, and whether storing or sending works, must not show in the response or in
	// how long it takes: the work runs after the redirect has been sent.
	const email = normaliseEmail(form.get('email'));
	if (!email) redirect(303, '/early-access/try-again');
	waitUntil(
		join(email, `${url.origin}/early-access/confirm`, rt.deps).then(
			() => undefined,
			// No error detail: a provider message could contain the address.
			() => console.error('waitlist: sign-up could not be stored or sent')
		)
	);
	redirect(303, '/early-access/sent');
}
