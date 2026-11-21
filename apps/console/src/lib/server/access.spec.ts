import { describe, expect, it } from 'vitest';
import {
	AccessDenied,
	createAccessVerifier,
	parseEmails,
	type AccessVerifierOptions
} from './access.js';
import { AUD, EMAIL, NOW, TEAM, makeIssuer } from './testing/issuer.js';

const issuer = await makeIssuer();
const verifier = (over: Partial<AccessVerifierOptions> = {}) =>
	createAccessVerifier({
		teamDomain: TEAM,
		aud: AUD,
		allowedEmails: [EMAIL],
		fetchCerts: issuer.fetchCerts,
		now: () => NOW,
		...over
	});

async function denied(p: Promise<unknown>, reason: string) {
	await expect(p).rejects.toSatisfy((e) => e instanceof AccessDenied && e.reason === reason);
}

describe('Access JWT verification', () => {
	it('accepts a valid token and returns its claims', async () => {
		expect((await verifier()(await issuer.token())).email).toBe(EMAIL);
		await verifier()(await issuer.token({ aud: AUD }));
	});
	it('refuses a missing token', async () => {
		await denied(verifier()(null), 'missing');
		await denied(verifier()(''), 'missing');
	});
	it('refuses wrong aud, issuer, time window and email', async () => {
		await denied(verifier()(await issuer.token({ aud: ['b'.repeat(64)] })), 'aud');
		await denied(
			verifier()(await issuer.token({ iss: 'https://other.cloudflareaccess.com' })),
			'iss'
		);
		await denied(verifier()(await issuer.token({ exp: NOW / 1000 - 120 })), 'expired');
		await denied(verifier()(await issuer.token({ exp: undefined })), 'expired');
		await denied(verifier()(await issuer.token({ nbf: NOW / 1000 + 600 })), 'not-yet-valid');
		await denied(verifier()(await issuer.token({ email: 'someone@example.com' })), 'email');
		await denied(verifier()(await issuer.token({ email: undefined })), 'email');
	});
	it('accepts the allowed email in any case', async () => {
		const claims = await verifier()(await issuer.token({ email: EMAIL.toUpperCase() }));
		expect(claims.email).toBe(EMAIL.toUpperCase());
	});
	it('refuses another key, a tampered payload, and alg other than RS256', async () => {
		const other = await makeIssuer('k1');
		await denied(verifier()(await other.token()), 'signature');
		const t = (await issuer.token()).split('.');
		const evil = Buffer.from(
			JSON.stringify({ iss: `https://${TEAM}`, aud: [AUD], email: EMAIL, exp: NOW / 1000 + 9999 })
		).toString('base64url');
		await denied(verifier()(`${t[0]}.${evil}.${t[2]}`), 'signature');
		await denied(verifier()(await issuer.token({}, { alg: 'HS256' })), 'alg');
		await denied(verifier()(await issuer.token({}, { alg: 'none' })), 'alg');
	});
	it('refreshes certs for an unknown kid at most once a minute', async () => {
		let t = NOW;
		const v = verifier({ now: () => t });
		await v(await issuer.token());
		t += 61_000;
		const before = issuer.certFetches;
		await denied(v(await issuer.token({}, { kid: 'nope' })), 'unknown-kid');
		await denied(v(await issuer.token({}, { kid: 'nope' })), 'unknown-kid');
		expect(issuer.certFetches - before).toBe(1);
	});
	it('refuses malformed tokens', async () => {
		await denied(verifier()('a.b'), 'shape');
		await denied(verifier()('!!.??.**'), 'encoding');
	});
	it('refuses everything without configuration', async () => {
		const token = await issuer.token();
		await denied(verifier({ aud: '' })(token), 'not-configured');
		await denied(verifier({ aud: undefined })(token), 'not-configured');
		await denied(verifier({ teamDomain: 'evil.example.com' })(token), 'not-configured');
		await denied(verifier({ allowedEmails: [] })(token), 'not-configured');
	});
	it('refuses when the certs endpoint fails, and fetches it at most once a minute', async () => {
		await denied(
			verifier({ fetchCerts: async () => new Response('down', { status: 503 }) })(
				await issuer.token()
			),
			'certs-status'
		);
		await denied(
			verifier({
				fetchCerts: async () => {
					throw new Error('net');
				}
			})(await issuer.token()),
			'certs-unreachable'
		);
		let fetches = 0;
		let t = NOW;
		const v = verifier({
			now: () => t,
			fetchCerts: async () => {
				fetches++;
				return new Response('down', { status: 503 });
			}
		});
		const token = await issuer.token();
		await Promise.allSettled([v(token), v(token), v(token)]);
		expect(fetches).toBe(1);
		await denied(v(token), 'certs-unavailable');
		t += 61_000;
		await denied(v(await issuer.token({ exp: t / 1000 + 600 })), 'certs-status');
		expect(fetches).toBe(2);
	});
	it('parses the allow list', () => {
		expect(parseEmails(' A@x.example , ,b@y.example')).toEqual(['a@x.example', 'b@y.example']);
		expect(parseEmails(undefined)).toEqual([]);
	});
});
