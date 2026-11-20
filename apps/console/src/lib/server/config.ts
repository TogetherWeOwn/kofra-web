// Console configuration from Worker variables and secrets. Pure: the caller passes the
// environment, so tests need no Workers runtime.

export interface BillingConfig {
	/** Billing actions work only when this is true. */
	enabled: boolean;
	/** Why billing is off, for the billing page. */
	reason: string | null;
	secretKey: string | null;
	priceId: string | null;
	portalCustomer: string | null;
}

export interface ConsoleConfig {
	/** Only "demo" exists today; anything else refuses to serve. */
	mode: 'demo' | 'unconfigured';
	billing: BillingConfig;
}

type Env = Record<string, unknown>;
const str = (env: Env, name: string): string | null => {
	const v = env[name];
	return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};

/**
 * True for a Stripe test-mode secret or restricted key. The console refuses live keys
 * outright: real charges wait for real sign-in and the owner's go-ahead.
 */
export const isTestKey = (key: string) => /^(sk|rk)_test_[A-Za-z0-9]{10,}$/.test(key);

export function readConfig(env: Env): ConsoleConfig {
	const mode = str(env, 'CONSOLE_MODE') === 'demo' ? 'demo' : 'unconfigured';
	const flag = str(env, 'BILLING');
	const secretKey = str(env, 'STRIPE_SECRET_KEY');
	const priceId = str(env, 'STRIPE_PRICE_ID');
	let reason: string | null = null;
	if (flag !== 'test') reason = 'Billing is not connected yet.';
	else if (!secretKey) reason = 'Billing is switched on but has no payment key.';
	else if (!isTestKey(secretKey)) reason = 'Billing accepts test-mode keys only.';
	else if (!priceId) reason = 'Billing is switched on but has no plan price.';
	return {
		mode,
		billing: {
			enabled: reason === null,
			reason,
			secretKey: reason === null ? secretKey : null,
			priceId,
			portalCustomer: str(env, 'STRIPE_PORTAL_CUSTOMER')
		}
	};
}
