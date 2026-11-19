import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DAILY_SEND_CAP } from './waitlist';
import { waitlistRuntime, type WaitlistEnv } from './waitlist-env';

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const key = (fill: number, length = 32) => b64(new Uint8Array(length).fill(fill));

const full = (): Required<WaitlistEnv> => ({
	WAITLIST_ENABLED: 'true',
	WAITLIST_FROM: 'early-access@kofra.example',
	WAITLIST_DAILY_SEND_CAP: '',
	TURNSTILE_SITE_KEY: 'site-key',
	TURNSTILE_SECRET_KEY: 'turnstile-secret',
	WAITLIST_HMAC_KEY: key(1),
	WAITLIST_ENC_KEY: key(2),
	WAITLIST_DB: { prepare: vi.fn() },
	EMAIL: { send: vi.fn(async () => ({})) },
	WAITLIST_RATE: { limit: vi.fn(async () => ({ success: true })) }
});

describe('waitlistRuntime', () => {
	it('runs when everything is configured, and sends from the configured address', async () => {
		const env = full();
		const rt = waitlistRuntime(env);
		expect(rt).not.toBeNull();
		expect(rt!.turnstileSecret).toBe('turnstile-secret');
		expect(rt!.rate).toBe(env.WAITLIST_RATE);
		await rt!.deps.send('ada@example.com', 'https://kofra.example/early-access/confirm?token=t');
		expect(env.EMAIL.send).toHaveBeenCalledWith(
			expect.objectContaining({
				from: 'early-access@kofra.example',
				to: 'ada@example.com',
				text: expect.stringContaining('https://kofra.example/early-access/confirm?token=t')
			})
		);
		expect(rt!.deps.now()).toBeCloseTo(Date.now() / 1000, -1);
	});

	it('takes the daily send cap from the environment, and stops on a malformed one', () => {
		expect(waitlistRuntime(full())!.deps.dailySendCap).toBe(DEFAULT_DAILY_SEND_CAP);
		const without: WaitlistEnv = full();
		delete without.WAITLIST_DAILY_SEND_CAP;
		expect(waitlistRuntime(without)!.deps.dailySendCap).toBe(DEFAULT_DAILY_SEND_CAP);
		expect(waitlistRuntime({ ...full(), WAITLIST_DAILY_SEND_CAP: '90' })!.deps.dailySendCap).toBe(
			90
		);
		for (const bad of ['0', '-1', '1.5', '1e3', ' 90', 'ninety', '0x10', '100001', '9999999'])
			expect(waitlistRuntime({ ...full(), WAITLIST_DAILY_SEND_CAP: bad }), bad).toBeNull();
	});

	it('is off unless the flag is exactly "true"', () => {
		for (const flag of ['false', '', 'TRUE', '1', 'yes', undefined]) {
			expect(waitlistRuntime({ ...full(), WAITLIST_ENABLED: flag }), String(flag)).toBeNull();
		}
		expect(waitlistRuntime({})).toBeNull();
	});

	const NEEDED = [
		'WAITLIST_FROM',
		'TURNSTILE_SECRET_KEY',
		'WAITLIST_HMAC_KEY',
		'WAITLIST_ENC_KEY',
		'WAITLIST_DB',
		'EMAIL',
		'WAITLIST_RATE'
	] as const;

	it.each(NEEDED)('fails closed when %s is missing', (name) => {
		const env: WaitlistEnv = full();
		delete env[name];
		expect(waitlistRuntime(env)).toBeNull();
	});

	it.each([
		'WAITLIST_FROM',
		'TURNSTILE_SECRET_KEY',
		'WAITLIST_HMAC_KEY',
		'WAITLIST_ENC_KEY'
	] as const)('fails closed when %s is empty', (name) => {
		expect(waitlistRuntime({ ...full(), [name]: '' })).toBeNull();
	});

	it.each(['WAITLIST_HMAC_KEY', 'WAITLIST_ENC_KEY'] as const)(
		'fails closed when %s is short, long or not base64',
		(name) => {
			for (const bad of [key(3, 16), key(3, 31), key(3, 33), 'not base64 !!', 'c2hvcnQ=']) {
				expect(waitlistRuntime({ ...full(), [name]: bad }), bad).toBeNull();
			}
		}
	);

	it('fails closed when one key is used for both purposes', () => {
		expect(waitlistRuntime({ ...full(), WAITLIST_ENC_KEY: key(1) })).toBeNull();
		// The same key bytes in a different base64 spelling (no padding) are still the same key.
		expect(waitlistRuntime({ ...full(), WAITLIST_ENC_KEY: key(1).replace(/=+$/, '') })).toBeNull();
	});
});
