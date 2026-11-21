import { describe, expect, it } from 'vitest';
import { isTestKey, readConfig } from './config.js';

const TEST_KEY = 'sk_test_' + 'a1B2c3D4e5F6g7H8';
const LIVE_KEY = 'sk_live_' + 'a1B2c3D4e5F6g7H8';

describe('readConfig', () => {
	it('serves only in demo mode', () => {
		expect(readConfig({ CONSOLE_MODE: 'demo' }).mode).toBe('demo');
		expect(readConfig({}).mode).toBe('unconfigured');
		expect(readConfig({ CONSOLE_MODE: 'production' }).mode).toBe('unconfigured');
	});

	it('keeps billing off unless the flag, a test key and a price are all set', () => {
		expect(readConfig({}).billing).toMatchObject({
			enabled: false,
			reason: 'Billing is not connected yet.'
		});
		expect(readConfig({ BILLING: 'test' }).billing.enabled).toBe(false);
		expect(readConfig({ BILLING: 'test', STRIPE_SECRET_KEY: TEST_KEY }).billing.reason).toBe(
			'Billing is switched on but has no plan price.'
		);
		const on = readConfig({
			BILLING: 'test',
			STRIPE_SECRET_KEY: TEST_KEY,
			STRIPE_PRICE_ID: 'price_1'
		});
		expect(on.billing).toMatchObject({ enabled: true, secretKey: TEST_KEY, priceId: 'price_1' });
	});

	it('refuses live keys and never exposes a refused key', () => {
		const live = readConfig({
			BILLING: 'test',
			STRIPE_SECRET_KEY: LIVE_KEY,
			STRIPE_PRICE_ID: 'price_1'
		});
		expect(live.billing).toMatchObject({ enabled: false, secretKey: null });
		expect(live.billing.reason).toBe('Billing accepts test-mode keys only.');
		expect(isTestKey(TEST_KEY)).toBe(true);
		expect(isTestKey('rk_test_' + 'a1B2c3D4e5F6')).toBe(true);
		expect(isTestKey(LIVE_KEY)).toBe(false);
		expect(isTestKey('sk_test_')).toBe(false);
	});
});

describe('console wording of API problems', async () => {
	const { KofraError } = await import('@kofra/api');
	const { describe: describeProblem } = await import('./api.js');
	const problem = (code: string, hint: string) =>
		new KofraError({
			type: 't',
			title: 't',
			status: 404,
			code,
			detail: 'There is no bucket "x".',
			hint,
			docs_url: 'u',
			request_id: 'req_1',
			retryable: false
		});

	it('replaces hints written for programs with console wording, or drops them', () => {
		expect(
			describeProblem(problem('bucket_not_found', 'List your buckets with GET /v1/buckets.')).hint
		).toBe('Check the name in the bucket list; it may have been deleted.');
		expect(
			describeProblem(problem('unknown_field', 'Remove the field named by errors[].pointer.')).hint
		).toBeUndefined();
	});
});

describe('live configuration', () => {
	const upstream = { fetch: async () => new Response(null, { status: 204 }) };
	const key = '0a'.repeat(32);
	const env = { CONSOLE_DATA: 'live', ACCOUNT: upstream, API: upstream, ASSERTION_KEY: key };

	it('requires both service bindings and decodes exactly 32 bytes', () => {
		expect(readConfig(env)).toMatchObject({
			mode: 'live',
			problem: null,
			account: upstream,
			api: upstream,
			assertionKey: new Uint8Array(32).fill(10)
		});
	});

	it.each([
		['ACCOUNT', undefined],
		['ACCOUNT', { fetch: true }],
		['API', undefined],
		['API', {}],
		['ASSERTION_KEY', undefined],
		['ASSERTION_KEY', 'ab'],
		['ASSERTION_KEY', key.toUpperCase()],
		['ASSERTION_KEY', key + '\n'],
		['ASSERTION_KEY', 'gg'.repeat(32)]
	])('refuses an invalid %s and exposes only its name', (setting, value) => {
		expect(readConfig({ ...env, [setting]: value })).toMatchObject({
			mode: 'unconfigured',
			problem: setting,
			account: null,
			api: null,
			assertionKey: null
		});
	});

	it('refuses a CONSOLE_MODE that disagrees, and never takes live from it', () => {
		expect(readConfig({ ...env, CONSOLE_DATA: 'demo', CONSOLE_MODE: 'live' })).toMatchObject({
			mode: 'unconfigured',
			problem: 'CONSOLE_MODE'
		});
		expect(readConfig({ ...env, CONSOLE_DATA: undefined, CONSOLE_MODE: 'live' }).mode).toBe(
			'unconfigured'
		);
		expect(readConfig({ ...env, CONSOLE_MODE: 'live' }).mode).toBe('live');
	});

	it('provides the fake without bindings and ignores them in demo', () => {
		expect(readConfig({ CONSOLE_DATA: 'live-fake' })).toMatchObject({
			mode: 'live-fake',
			account: { fetch: expect.any(Function) },
			assertionKey: null
		});
		expect(readConfig({ ...env, CONSOLE_DATA: 'demo' })).toMatchObject({
			mode: 'demo',
			account: null,
			api: null,
			assertionKey: null
		});
	});
});
