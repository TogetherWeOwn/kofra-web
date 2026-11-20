import { describe, expect, it } from 'vitest';
import { createCheckoutSession, createPortalSession, StripeError } from './stripe.js';

const KEY = 'sk_test_' + 'a1B2c3D4e5F6g7H8';

function fakeFetch(answer: unknown, status = 200) {
	const calls: { url: string; init: RequestInit }[] = [];
	const f = (async (url: string, init: RequestInit) => {
		calls.push({ url, init });
		return new Response(JSON.stringify(answer), { status });
	}) as unknown as typeof fetch;
	return { f, calls };
}

describe('Stripe sessions', () => {
	it('creates a subscription Checkout session with form-encoded fields', async () => {
		const { f, calls } = fakeFetch({
			url: 'https://checkout.stripe.com/c/pay/cs_test_1',
			livemode: false
		});
		const out = await createCheckoutSession(
			{
				priceId: 'price_1',
				successUrl: 'https://c.example/billing?checkout=done',
				cancelUrl: 'https://c.example/billing'
			},
			{ key: KEY, fetch: f, idempotencyKey: 'k1' }
		);
		expect(out.url).toBe('https://checkout.stripe.com/c/pay/cs_test_1');
		expect(calls[0]!.url).toBe('https://api.stripe.com/v1/checkout/sessions');
		const body = new URLSearchParams(calls[0]!.init.body as string);
		expect(body.get('mode')).toBe('subscription');
		expect(body.get('line_items[0][price]')).toBe('price_1');
		const headers = calls[0]!.init.headers as Record<string, string>;
		expect(headers['idempotency-key']).toBe('k1');
		expect(headers.authorization).toBe(`Bearer ${KEY}`);
	});

	it('creates a portal session', async () => {
		const { f, calls } = fakeFetch({
			url: 'https://billing.stripe.com/p/session/test_1',
			livemode: false
		});
		const out = await createPortalSession(
			{ customer: 'cus_1', returnUrl: 'https://c.example/billing' },
			{ key: KEY, fetch: f }
		);
		expect(out.url).toContain('billing.stripe.com');
		expect(new URLSearchParams(calls[0]!.init.body as string).get('customer')).toBe('cus_1');
	});

	it('refuses live keys before any request', async () => {
		const { f, calls } = fakeFetch({});
		await expect(
			createPortalSession(
				{ customer: 'c', returnUrl: 'r' },
				{ key: 'sk_live_' + 'a1B2c3D4e5F6', fetch: f }
			)
		).rejects.toBeInstanceOf(StripeError);
		expect(calls).toHaveLength(0);
	});

	it('refuses answers that are live, error or point elsewhere', async () => {
		const args = { customer: 'c', returnUrl: 'r' };
		await expect(
			createPortalSession(args, {
				key: KEY,
				fetch: fakeFetch({ url: 'https://billing.stripe.com/x', livemode: true }).f
			})
		).rejects.toThrow('outside test mode');
		await expect(
			createPortalSession(args, {
				key: KEY,
				fetch: fakeFetch({ url: 'https://evil.example/x', livemode: false }).f
			})
		).rejects.toThrow('hosted page');
		await expect(
			createPortalSession(args, {
				key: KEY,
				fetch: fakeFetch({ error: { message: 'No such customer' } }, 400).f
			})
		).rejects.toThrow('No such customer');
	});
});
