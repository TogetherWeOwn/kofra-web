// Console configuration from Worker variables, secrets and bindings. Pure: the caller passes
// the environment, so tests need no Workers runtime.
import { parseEmails } from './access.js';
import { fakeAccount } from './account/fake.js';

export interface BillingConfig {
	/** Billing actions work only when this is true. */
	enabled: boolean;
	/** Why billing is off, for the billing page. */
	reason: string | null;
	secretKey: string | null;
	priceId: string | null;
	portalCustomer: string | null;
}

/** Something that answers requests: a service binding, or `fetch` itself in local tests. */
export interface Upstream {
	fetch(request: Request): Promise<Response>;
}

/** Everything `tenant0` needs. Holds secrets: never put any of it in a page or a log. */
export interface Tenant0Config {
	access: { teamDomain: string; aud: string; allowedEmails: string[] };
	storage: {
		upstream: Upstream;
		/** Set only for a loopback fake in local tests; requests then go there over http. */
		origin: string | null;
		/** The public S3 host, signed into every request and presigned URL. */
		host: string;
		region: string;
		keyId: string;
		secret: string;
		adminToken: string;
	};
	workspaceName: string;
	/** Buckets the console never deletes; always holds "files". */
	protectedBuckets: string[];
	/** `DEV_AUTH=local`; the gate honours it only for a loopback fake (see gate.ts). */
	devAuth: boolean;
}

export interface ConsoleConfig {
	/**
	 * "demo": sample data per visitor. "tenant0": the operator's own storage account, behind
	 * Cloudflare Access. "unconfigured": every request is refused.
	 */
	mode: 'demo' | 'tenant0' | 'live' | 'live-fake' | 'unconfigured';
	/** For "unconfigured": the name of the first missing or invalid setting, never a value. */
	problem: string | null;
	billing: BillingConfig;
	tenant0: Tenant0Config | null;
	/**
	 * "live": customer sign-in through the account service (`ACCOUNT` binding), workspace
	 * calls over the `API` binding signed with `ASSERTION_KEY`. "live-fake": the same pages on
	 * an in-memory account service, for tests on loopback only.
	 */
	account: Upstream | null;
	api: Upstream | null;
	assertionKey: Uint8Array | null;
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

/** The bucket that holds the owner's synced files: never deleted from the console. */
export const ALWAYS_PROTECTED = 'files';

const TEAM_DOMAIN = /^[a-z0-9][a-z0-9-]{0,62}\.cloudflareaccess\.com$/;
const AUD = /^[0-9a-f]{64}$/;
const HOST =
	/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*(:[0-9]{1,5})?$/;
const KEY_ID = /^[A-Z0-9]{16,128}$/;
const BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const LOOPBACK_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):[0-9]{1,5}$/;

function readBilling(env: Env, allowed: boolean): BillingConfig {
	const flag = str(env, 'BILLING');
	const secretKey = str(env, 'STRIPE_SECRET_KEY');
	const priceId = str(env, 'STRIPE_PRICE_ID');
	let reason: string | null = null;
	if (!allowed || flag !== 'test') reason = 'Billing is not connected yet.';
	else if (!secretKey) reason = 'Billing is switched on but has no payment key.';
	else if (!isTestKey(secretKey)) reason = 'Billing accepts test-mode keys only.';
	else if (!priceId) reason = 'Billing is switched on but has no plan price.';
	return {
		enabled: reason === null,
		reason,
		secretKey: reason === null ? secretKey : null,
		priceId,
		portalCustomer: str(env, 'STRIPE_PORTAL_CUSTOMER')
	};
}

const isUpstream = (v: unknown): v is Upstream =>
	typeof v === 'object' && v !== null && typeof (v as Upstream).fetch === 'function';

/** The `tenant0` settings, or the name of the first one that is missing or invalid. */
export function readTenant0(env: Env): Tenant0Config | string {
	const teamDomain = str(env, 'ACCESS_TEAM_DOMAIN');
	if (!teamDomain || !TEAM_DOMAIN.test(teamDomain)) return 'ACCESS_TEAM_DOMAIN';
	const aud = str(env, 'ACCESS_AUD');
	if (!aud || !AUD.test(aud)) return 'ACCESS_AUD';
	const allowedEmails = parseEmails(str(env, 'ALLOWED_EMAILS'));
	if (allowedEmails.length === 0 || allowedEmails.some((e) => !/^[^\s@,]+@[^\s@,]+$/.test(e)))
		return 'ALLOWED_EMAILS';

	// Exactly one way to reach the storage service: the binding when deployed, a loopback
	// origin in local tests. Both, or neither, is a configuration error.
	const binding = env.STORAGE;
	const origin = str(env, 'STORAGE_ORIGIN');
	let upstream: Upstream;
	if (binding !== undefined && binding !== null) {
		if (!isUpstream(binding)) return 'STORAGE';
		if (origin) return 'STORAGE_ORIGIN';
		upstream = binding;
	} else {
		if (!origin || !LOOPBACK_ORIGIN.test(origin)) return 'STORAGE';
		upstream = { fetch: (request) => fetch(request) };
	}
	const host = str(env, 'STORAGE_HOST')?.toLowerCase() ?? null;
	if (!host || !HOST.test(host)) return 'STORAGE_HOST';
	const region = str(env, 'STORAGE_REGION') ?? 'auto';
	if (!/^[a-z0-9-]{1,32}$/.test(region)) return 'STORAGE_REGION';
	const keyId = str(env, 'STORAGE_KEY_ID');
	if (!keyId || !KEY_ID.test(keyId)) return 'STORAGE_KEY_ID';
	const secret = str(env, 'STORAGE_SECRET');
	if (!secret || secret.length < 16) return 'STORAGE_SECRET';
	const adminToken = str(env, 'STORAGE_ADMIN_TOKEN');
	if (!adminToken || adminToken.length < 16) return 'STORAGE_ADMIN_TOKEN';

	const extra = (str(env, 'PROTECTED_BUCKETS') ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	if (extra.some((b) => !BUCKET.test(b))) return 'PROTECTED_BUCKETS';
	const name = str(env, 'WORKSPACE_NAME') ?? 'Your workspace';
	if (name.length > 64) return 'WORKSPACE_NAME';

	return {
		access: { teamDomain, aud, allowedEmails },
		storage: { upstream, origin, host, region, keyId, secret, adminToken },
		workspaceName: name,
		protectedBuckets: [...new Set([ALWAYS_PROTECTED, ...extra])],
		devAuth: str(env, 'DEV_AUTH') === 'local'
	};
}

const none = { account: null, api: null, assertionKey: null } as const;

export function readConfig(env: Env): ConsoleConfig {
	// CONSOLE_DATA picks the data source. Without it, the older CONSOLE_MODE still works.
	const legacy = str(env, 'CONSOLE_MODE');
	const data =
		str(env, 'CONSOLE_DATA') ??
		(legacy === 'demo' || legacy === 'live' || legacy === 'live-fake' ? legacy : null);
	if (data === 'demo')
		return { mode: 'demo', problem: null, billing: readBilling(env, true), tenant0: null, ...none };
	if (data === 'live-fake')
		return {
			mode: 'live-fake',
			problem: null,
			billing: readBilling(env, true),
			tenant0: null,
			...none,
			account: fakeAccount
		};
	if (data === 'live') {
		const billing = readBilling(env, true);
		const key = env.ASSERTION_KEY;
		const problem = !isUpstream(env.ACCOUNT)
			? 'ACCOUNT'
			: !isUpstream(env.API)
				? 'API'
				: typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)
					? 'ASSERTION_KEY'
					: null;
		if (problem) return { mode: 'unconfigured', problem, billing, tenant0: null, ...none };
		return {
			mode: 'live',
			problem: null,
			billing,
			tenant0: null,
			account: env.ACCOUNT as Upstream,
			api: env.API as Upstream,
			assertionKey: Uint8Array.from((key as string).match(/../g)!, (p) => Number.parseInt(p, 16))
		};
	}
	// Nothing is served while unconfigured; the billing reading is kept for its own tests.
	if (data !== 'tenant0')
		return {
			mode: 'unconfigured',
			problem: 'CONSOLE_DATA',
			billing: readBilling(env, true),
			tenant0: null,
			...none
		};
	// No billing for the operator's own workspace.
	const off = readBilling(env, false);
	const t = readTenant0(env);
	if (typeof t === 'string')
		return { mode: 'unconfigured', problem: t, billing: off, tenant0: null, ...none };
	return { mode: 'tenant0', problem: null, billing: off, tenant0: t, ...none };
}
