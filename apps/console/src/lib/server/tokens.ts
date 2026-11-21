// Short signed tokens the console hands to its own pages: an upload address, or the exact
// list of files a delete confirmation showed. HMAC-SHA256 under a key derived from a server
// secret, so a page cannot change what the server agreed to. They are not credentials: every
// request that carries one still passes the Access check first.

const enc = new TextEncoder();
const LABEL = 'kofra-console/tokens/v1';

const b64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
	try {
		const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
		return Uint8Array.from(bin, (c) => c.charCodeAt(0));
	} catch {
		return null;
	}
}

export type TokenKey = CryptoKey;

/** The token key, derived from a server secret with a fixed label. */
export async function tokenKey(secret: string): Promise<TokenKey> {
	const root = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const derived = await crypto.subtle.sign('HMAC', root, enc.encode(LABEL));
	return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify'
	]);
}

/** `payload.signature`. The payload names its purpose and expiry (seconds). */
export async function seal(
	key: TokenKey,
	purpose: string,
	expiresAt: number,
	data: Record<string, unknown>
): Promise<string> {
	const body = b64url(enc.encode(JSON.stringify({ p: purpose, e: expiresAt, d: data })));
	const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
	return `${body}.${b64url(sig)}`;
}

/** The token's data, or null when it is malformed, forged, expired or for another purpose. */
export async function open<T extends Record<string, unknown>>(
	key: TokenKey,
	purpose: string,
	token: string | null | undefined,
	nowSeconds: number
): Promise<T | null> {
	if (typeof token !== 'string' || token.length > 8192) return null;
	const [body, sig, extra] = token.split('.');
	if (!body || !sig || extra !== undefined) return null;
	const sigBytes = fromB64url(sig);
	if (!sigBytes) return null;
	// Constant-time comparison inside the platform's verify.
	if (!(await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(body)))) return null;
	const raw = fromB64url(body);
	if (!raw) return null;
	try {
		const v = JSON.parse(new TextDecoder().decode(raw)) as {
			p?: unknown;
			e?: unknown;
			d?: unknown;
		};
		if (v.p !== purpose || typeof v.e !== 'number' || v.e < nowSeconds) return null;
		if (typeof v.d !== 'object' || v.d === null || Array.isArray(v.d)) return null;
		return v.d as T;
	} catch {
		return null;
	}
}
