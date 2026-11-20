// Hosted Stripe Checkout and Customer Portal sessions, in test mode only (config.ts refuses
// live keys). Card data never reaches the console: both pages are hosted by Stripe.
//
// TODO(billing): the customer and subscription records belong to the workspace once real
// sign-in exists. Until then Checkout creates a new test customer each time, and the portal
// opens the one test customer named by STRIPE_PORTAL_CUSTOMER.
import { isTestKey } from './config.js';

const API = 'https://api.stripe.com/v1';

export class StripeError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'StripeError';
	}
}

interface Call {
	key: string;
	fetch?: typeof fetch;
	/** Stripe retries a request with the same key safely. */
	idempotencyKey?: string;
}

async function post(
	path: string,
	form: Record<string, string>,
	call: Call
): Promise<{ url: string }> {
	if (!isTestKey(call.key)) throw new StripeError('Only test-mode keys are accepted.', 0);
	const headers: Record<string, string> = {
		authorization: `Bearer ${call.key}`,
		'content-type': 'application/x-www-form-urlencoded'
	};
	if (call.idempotencyKey) headers['idempotency-key'] = call.idempotencyKey;
	let res: Response;
	try {
		res = await (call.fetch ?? fetch)(`${API}${path}`, {
			method: 'POST',
			headers,
			body: new URLSearchParams(form).toString(),
			redirect: 'manual',
			signal: AbortSignal.timeout(10_000)
		});
	} catch {
		throw new StripeError('The payment provider did not answer.', 0);
	}
	const body = (await res.json().catch(() => null)) as {
		url?: unknown;
		livemode?: unknown;
		error?: { message?: unknown };
	} | null;
	if (!res.ok) {
		// Stripe's message can name parameters but never holds the key; keep it short anyway.
		const msg =
			typeof body?.error?.message === 'string'
				? body.error.message.slice(0, 200)
				: `HTTP ${res.status}`;
		throw new StripeError(msg, res.status);
	}
	if (body?.livemode !== false)
		throw new StripeError('Stripe answered outside test mode.', res.status);
	if (
		typeof body.url !== 'string' ||
		!/^https:\/\/(checkout|billing)\.stripe\.com\//.test(body.url)
	)
		throw new StripeError('Stripe answered without a hosted page address.', res.status);
	return { url: body.url };
}

/** A hosted Checkout page for the plan's price (a subscription). */
export function createCheckoutSession(
	args: { priceId: string; successUrl: string; cancelUrl: string; clientReference?: string },
	call: Call
) {
	const form: Record<string, string> = {
		mode: 'subscription',
		'line_items[0][price]': args.priceId,
		'line_items[0][quantity]': '1',
		success_url: args.successUrl,
		cancel_url: args.cancelUrl
	};
	if (args.clientReference) form.client_reference_id = args.clientReference;
	return post('/checkout/sessions', form, call);
}

/** A Customer Portal session: payment methods, invoices, cancellation. */
export function createPortalSession(args: { customer: string; returnUrl: string }, call: Call) {
	return post(
		'/billing_portal/sessions',
		{ customer: args.customer, return_url: args.returnUrl },
		call
	);
}
