import { fail, redirect } from '@sveltejs/kit';
import { loadFailed } from '#lib/server/api.js';
import { createCheckoutSession, createPortalSession, StripeError } from '#lib/server/stripe.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const b = locals.billing;
	try {
		const account = await locals.api.account.get();
		return {
			limits: account.limits,
			billing: {
				enabled: b.enabled,
				reason: b.reason,
				portal: locals.mode === 'demo' && b.enabled && b.portalCustomer !== null
			},
			checkout: url.searchParams.get('checkout'),
			crumbs: [{ label: 'Billing' }]
		};
	} catch (err) {
		loadFailed(err);
	}
};

function unavailable(message: string) {
	return fail(503, { problem: { message, hint: 'Billing opens with the first release.' } });
}

function stripeFailed(err: unknown) {
	if (!(err instanceof StripeError)) throw err;
	// Logged without the key (the error never holds it) so the cause can be found.
	console.error('billing: payment provider refused the request', err.status, err.message);
	return fail(502, {
		problem: { message: 'The payment page could not be opened.', hint: 'Try again in a minute.' }
	});
}

export const actions: Actions = {
	checkout: async ({ locals, url }) => {
		const b = locals.billing;
		if (!b.enabled || !b.secretKey || !b.priceId)
			return unavailable(b.reason ?? 'Billing is not connected yet.');
		let target: string;
		try {
			target = (
				await createCheckoutSession(
					{
						priceId: b.priceId,
						successUrl: `${url.origin}/billing?checkout=done`,
						cancelUrl: `${url.origin}/billing?checkout=cancelled`,
						clientReference: (await locals.api.account.get()).id
					},
					{ key: b.secretKey, idempotencyKey: crypto.randomUUID() }
				)
			).url;
		} catch (err) {
			return stripeFailed(err);
		}
		redirect(303, target);
	},
	portal: async ({ locals, url }) => {
		const b = locals.billing;
		// One configured test customer serves the demo only; a live workspace's billing
		// account comes with the billing integration.
		if (locals.mode !== 'demo') return unavailable('Billing is not connected yet.');
		if (!b.enabled || !b.secretKey) return unavailable(b.reason ?? 'Billing is not connected yet.');
		if (!b.portalCustomer) return unavailable('There is no billing account to manage yet.');
		let target: string;
		try {
			target = (
				await createPortalSession(
					{ customer: b.portalCustomer, returnUrl: `${url.origin}/billing` },
					{ key: b.secretKey }
				)
			).url;
		} catch (err) {
			return stripeFailed(err);
		}
		redirect(303, target);
	}
};
