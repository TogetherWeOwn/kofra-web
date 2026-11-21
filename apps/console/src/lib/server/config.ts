import { fakeAccount } from './account/fake.js';
import type { Upstream } from './account/types.js';

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
	mode: 'demo' | 'live' | 'live-fake' | 'unconfigured';
	problem: string | null;
	account: Upstream | null;
	api: Upstream | null;
	assertionKey: Uint8Array | null;
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

const binding = (value: unknown): value is Upstream =>
	typeof value === 'object' &&
	value !== null &&
	'fetch' in value &&
	typeof value.fetch === 'function';

export function readConfig(env: Env): ConsoleConfig {
	const requested = str(env, 'CONSOLE_MODE');
	let mode: ConsoleConfig['mode'] = 'unconfigured';
	let problem: string | null = null;
	let account: Upstream | null = null;
	let api: Upstream | null = null;
	let assertionKey: Uint8Array | null = null;
	if (requested === 'demo' || requested === 'live-fake') {
		mode = requested;
		if (mode === 'live-fake') account = fakeAccount;
	} else if (requested === 'live') {
		const key = env.ASSERTION_KEY;
		if (!binding(env.ACCOUNT)) problem = 'ACCOUNT';
		else if (!binding(env.API)) problem = 'API';
		else if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key) || key.length !== 64)
			problem = 'ASSERTION_KEY';
		else {
			mode = 'live';
			account = env.ACCOUNT;
			api = env.API;
			assertionKey = Uint8Array.from(key.match(/../g)!, (pair) => Number.parseInt(pair, 16));
		}
	}
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
		problem,
		account,
		api,
		assertionKey,
		billing: {
			enabled: reason === null,
			reason,
			secretKey: reason === null ? secretKey : null,
			priceId,
			portalCustomer: str(env, 'STRIPE_PORTAL_CUSTOMER')
		}
	};
}
