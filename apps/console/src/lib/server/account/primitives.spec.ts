import { expect, it } from 'vitest';
import { mintAssertion } from './assertion.js';
import { checkCsrf } from './csrf.js';
import { loopback, nextPath } from './session.js';

it('matches the API assertion vector', async () => {
	const value = await mintAssertion(
		Uint8Array.from({ length: 32 }, (_, i) => i),
		'ws_01jd3k9v6q2m8x4t7r5n0b1c2d',
		'usr_01jd3k9v6q2m8x4t7r5n0b1c3e',
		'ses_01jd3k9v6q2m8x4t7r5n0b1c4f',
		1763546410
	);
	expect(value).toBe(
		'kofra_cs_djF8d3NfMDFqZDNrOXY2cTJtOHg0dDdyNW4wYjFjMmR8dXNyXzAxamQzazl2NnEybTh4NHQ3cjVuMGIxYzNlfHNlc18wMWpkM2s5djZxMm04eDR0N3I1bjBiMWM0ZnwxNzYzNTQ2NDYw.Vak5DYlO_PUrrP74XSnL9oNBBigWW3JIdIte4cJQ_JU'
	);
});

it('compares CSRF values as bytes and refuses a file or a missing value', () => {
	const t = 'csrf-xéz-0123456789';
	expect(checkCsrf(t, t)).toBe(true);
	expect(checkCsrf(t, t.replace('é', 'è'))).toBe(false);
	expect(checkCsrf(t, t.replace('é', 'e'))).toBe(false);
	expect(checkCsrf(t, null)).toBe(false);
	expect(checkCsrf(t, new File([t], 'csrf'))).toBe(false);
});

it('refuses when the expected token is empty or short', () => {
	expect(checkCsrf('', '')).toBe(false);
	expect(checkCsrf('short', 'short')).toBe(false);
});

it('preserves a local redirect path, query and fragment', () => {
	expect(nextPath('/tokens/new?a=b#section')).toBe('/tokens/new?a=b#section');
});

it.each([
	null,
	'',
	'settings',
	'//other.example',
	'https://other.example',
	'/\\other.example',
	'/\t/other.example',
	'/.//other.example',
	'/%2fother.example'
])('refuses unsafe redirect value %j', (value) => {
	expect(nextPath(value)).toBe('/');
});

it.each(['127.0.0.1', 'localhost', '[::1]'])('accepts the loopback hostname %s', (host) => {
	expect(loopback(new URL(`http://${host}:4175/`))).toBe(true);
});
