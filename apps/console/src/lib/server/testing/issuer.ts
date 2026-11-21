// An Access-like token signer for tests (from the service's console tests).

export const TEAM = 'example-team.cloudflareaccess.com';
export const AUD = 'a'.repeat(64);
export const EMAIL = 'owner@example.com';
export const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(bytes)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
const b64urlJson = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

export async function makeIssuer(kid = 'k1') {
	const pair = (await crypto.subtle.generateKey(
		{
			name: 'RSASSA-PKCS1-v1_5',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256'
		},
		true,
		['sign', 'verify']
	)) as CryptoKeyPair;
	const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
	const certs = { keys: [{ kty: 'RSA', kid, alg: 'RS256', use: 'sig', n: jwk.n, e: jwk.e }] };
	let certFetches = 0;
	return {
		kid,
		get certFetches() {
			return certFetches;
		},
		fetchCerts: async (url: string) => {
			certFetches++;
			if (url !== `https://${TEAM}/cdn-cgi/access/certs`)
				return new Response('no', { status: 404 });
			return Response.json(certs);
		},
		async token(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
			const h = { alg: 'RS256', kid, typ: 'JWT', ...header };
			const c = {
				iss: `https://${TEAM}`,
				aud: [AUD],
				email: EMAIL,
				iat: NOW / 1000 - 60,
				nbf: NOW / 1000 - 60,
				exp: NOW / 1000 + 3600,
				...claims
			};
			const input = `${b64urlJson(h)}.${b64urlJson(c)}`;
			const sig = await crypto.subtle.sign(
				'RSASSA-PKCS1-v1_5',
				pair.privateKey,
				new TextEncoder().encode(input)
			);
			return `${input}.${b64url(sig)}`;
		}
	};
}
