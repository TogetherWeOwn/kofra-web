// Early-access waitlist with double opt-in. OFF unless WAITLIST_ENABLED is "true" (wrangler.jsonc
// vars); collecting addresses needs a privacy policy in force first, which is an owner decision.
//
// Storage choice (the safer of the two options): no plaintext address is stored.
// - email_hash = HMAC-SHA-256(normalised address, WAITLIST_HMAC_KEY): finds duplicates and lets an
//   address be removed on request, but a copy of the table alone cannot be reversed by guessing
//   addresses, because the key is not in the database.
// - email_enc = AES-256-GCM(address, WAITLIST_ENC_KEY) with a fresh random 96-bit nonce per
//   encryption and email_hash as associated data, so a ciphertext cannot be moved to another row.
//   It is needed once, to invite the person at launch. A database leak without the Worker secrets
//   reveals no address.
// - The two keys are separate secrets and must differ (waitlist-env.ts refuses equal keys).
// - The confirmation token is 256 random bits and is stored only as SHA-256. It is found by an
//   index lookup on that hash, never by comparing secret bytes, so response time says nothing
//   useful about a stored token. It expires after 24 hours and works once (one atomic UPDATE).
// Retention: unconfirmed rows are deleted 7 days after the latest sign-up request for the address
// (checked on every sign-up); confirmed rows are kept until the launch invitation is sent or the
// person asks to be removed (docs/waitlist.md).

export const TOKEN_TTL_S = 24 * 60 * 60;
export const PENDING_RETENTION_S = 7 * 24 * 60 * 60;
/** At most one confirmation email per address per hour, so the form cannot be used to flood someone. */
export const RESEND_AFTER_S = 60 * 60;
const MAX_EMAIL = 254;

export interface WaitlistRow {
	email_hash: string;
	email_enc: string;
	status: 'pending' | 'confirmed';
	token_hash: string | null;
	token_expires_at: number | null;
	created_at: number;
	confirmed_at: number | null;
	last_sent_at: number;
}

/** Storage operations; the D1 implementation is d1Store(), tests use an in-memory one. */
export interface WaitlistStore {
	get(emailHash: string): Promise<WaitlistRow | null>;
	/** Inserts the row, or replaces a pending one. A confirmed row is never overwritten. */
	put(row: WaitlistRow): Promise<void>;
	/**
	 * Confirms the pending row that holds this token hash, if the token has not expired at `now`,
	 * and clears the token. One atomic statement: of two concurrent calls only one returns true.
	 */
	confirmToken(tokenHash: string, now: number): Promise<boolean>;
	/** Deletes pending rows created before `olderThan`. Confirmed rows are never touched. */
	purgePending(olderThan: number): Promise<void>;
}

export interface Deps {
	store: WaitlistStore;
	/** Base64 of 32 random bytes each. Missing or short keys disable the waitlist. */
	hmacKey: string;
	encKey: string;
	/** Sends the confirmation email. */
	send(to: string, confirmUrl: string): Promise<void>;
	/** Seconds since the epoch. */
	now(): number;
}

export type JoinResult = 'sent' | 'invalid';
export type ConfirmResult = 'confirmed' | 'expired';

/**
 * Trims, lower-cases and Unicode-normalises (NFC), so one address always gives one hash.
 * Returns null for anything that is not a plausible address.
 */
export function normaliseEmail(input: unknown): string | null {
	if (typeof input !== 'string') return null;
	if (input.length > 4 * MAX_EMAIL) return null;
	const email = input.trim().toLowerCase().normalize('NFC');
	if (email.length < 3 || email.length > MAX_EMAIL) return null;
	// One @, a dot in the domain, and no spaces, control characters (so no header injection),
	// quotes or angle brackets. Deliberately simple; the confirmation email is the real check.
	if (!/^[^\s\p{Cc}@<>"]+@[^\s\p{Cc}@<>"]+\.[^\s\p{Cc}@<>".]+$/u.test(email)) return null;
	return email;
}

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) =>
	[...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => {
	const bin = atob(s);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
};
const b64url = (bytes: Uint8Array) =>
	b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Decodes a base64 key and checks it is 32 bytes. */
export function keyBytes(key: string): Uint8Array<ArrayBuffer> {
	let bytes: Uint8Array<ArrayBuffer>;
	try {
		bytes = fromB64(key);
	} catch {
		throw new Error('waitlist key is not base64');
	}
	if (bytes.length !== 32) throw new Error('waitlist key must be 32 bytes');
	return bytes;
}

export async function emailHash(email: string, hmacKey: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		keyBytes(hmacKey),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return hex(await crypto.subtle.sign('HMAC', key, enc.encode(email)));
}

export const sha256 = async (s: string) =>
	hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

/**
 * AES-256-GCM; output is base64(12-byte random nonce || ciphertext with tag). `emailHashHex` (the
 * row's primary key) is authenticated as associated data, binding the ciphertext to its row.
 */
export async function encryptEmail(
	email: string,
	encKey: string,
	emailHashHex: string
): Promise<string> {
	const key = await crypto.subtle.importKey('raw', keyBytes(encKey), 'AES-GCM', false, ['encrypt']);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv, additionalData: enc.encode(emailHashHex) },
			key,
			enc.encode(email)
		)
	);
	const out = new Uint8Array(iv.length + ct.length);
	out.set(iv);
	out.set(ct, iv.length);
	return b64(out);
}

/**
 * Inverse of encryptEmail, for the launch invitation job. Throws on a wrong key, a ciphertext
 * that was changed, or one that belongs to another row.
 */
export async function decryptEmail(
	blob: string,
	encKey: string,
	emailHashHex: string
): Promise<string> {
	const key = await crypto.subtle.importKey('raw', keyBytes(encKey), 'AES-GCM', false, ['decrypt']);
	const bytes = fromB64(blob);
	if (bytes.length < 12 + 16) throw new Error('waitlist ciphertext is too short');
	const pt = await crypto.subtle.decrypt(
		{ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: enc.encode(emailHashHex) },
		key,
		bytes.slice(12)
	);
	return new TextDecoder('utf-8', { fatal: true }).decode(pt);
}

/**
 * Adds an address (or re-sends its confirmation). Always reports "sent" for a valid address,
 * whether it was new, pending or already confirmed, so the form reveals nothing about who
 * is on the list.
 */
export async function join(
	rawEmail: unknown,
	confirmBase: string,
	deps: Deps
): Promise<JoinResult> {
	const email = normaliseEmail(rawEmail);
	if (!email) return 'invalid';
	const now = deps.now();
	await deps.store.purgePending(now - PENDING_RETENTION_S);
	const hash = await emailHash(email, deps.hmacKey);
	const existing = await deps.store.get(hash);
	if (existing?.status === 'confirmed') return 'sent';
	if (existing && now - existing.last_sent_at < RESEND_AFTER_S) return 'sent';

	const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
	const row: WaitlistRow = {
		email_hash: hash,
		email_enc: await encryptEmail(email, deps.encKey, hash),
		status: 'pending',
		token_hash: await sha256(token),
		token_expires_at: now + TOKEN_TTL_S,
		// A repeated request is a new sign-up: the 7-day retention clock restarts with it, so a
		// fresh link is never deleted before it expires.
		created_at: now,
		confirmed_at: null,
		last_sent_at: now
	};
	await deps.store.put(row);
	const url = new URL(confirmBase);
	url.searchParams.set('token', token);
	try {
		await deps.send(email, url.href);
	} catch (err) {
		// Nothing was sent: allow an immediate retry instead of the one-hour pause.
		await deps.store.put({ ...row, last_sent_at: 0 });
		throw err;
	}
	return 'sent';
}

/** Confirms the address that owns this token, if the token is current. Tokens work once. */
export async function confirm(rawToken: unknown, deps: Deps): Promise<ConfirmResult> {
	if (typeof rawToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return 'expired';
	const done = await deps.store.confirmToken(await sha256(rawToken), deps.now());
	return done ? 'confirmed' : 'expired';
}

/** Minimal D1 surface used here (structurally compatible with Cloudflare's D1Database). */
export interface D1Like {
	prepare(sql: string): {
		bind(...values: unknown[]): {
			first<T>(): Promise<T | null>;
			run(): Promise<{ meta: { changes?: number } }>;
		};
	};
}

export function d1Store(db: D1Like): WaitlistStore {
	return {
		get: (h) =>
			db.prepare('SELECT * FROM waitlist WHERE email_hash = ?').bind(h).first<WaitlistRow>(),
		put: async (r) => {
			await db
				.prepare(
					`INSERT INTO waitlist (email_hash, email_enc, status, token_hash, token_expires_at,
					   created_at, confirmed_at, last_sent_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
					 ON CONFLICT (email_hash) DO UPDATE SET email_enc = excluded.email_enc,
					   status = excluded.status, token_hash = excluded.token_hash,
					   token_expires_at = excluded.token_expires_at, created_at = excluded.created_at,
					   confirmed_at = excluded.confirmed_at, last_sent_at = excluded.last_sent_at
					 WHERE waitlist.status = 'pending'`
				)
				.bind(
					r.email_hash,
					r.email_enc,
					r.status,
					r.token_hash,
					r.token_expires_at,
					r.created_at,
					r.confirmed_at,
					r.last_sent_at
				)
				.run();
		},
		confirmToken: async (tokenHash, now) => {
			const res = await db
				.prepare(
					`UPDATE waitlist SET status = 'confirmed', token_hash = NULL, token_expires_at = NULL,
					   confirmed_at = ?1
					 WHERE token_hash = ?2 AND status = 'pending' AND token_expires_at >= ?1`
				)
				.bind(now, tokenHash)
				.run();
			return res.meta.changes === 1;
		},
		purgePending: async (olderThan) => {
			await db
				.prepare("DELETE FROM waitlist WHERE status = 'pending' AND created_at < ?")
				.bind(olderThan)
				.run();
		}
	};
}

/** The confirmation email, plain text only. */
export function confirmationEmail(confirmUrl: string) {
	return {
		subject: 'Confirm your place on the Kofra early access list',
		text: [
			'Hello,',
			'',
			'Someone, hopefully you, asked to join the Kofra early access list with this address.',
			'To confirm, open this link within 24 hours and press the Confirm button:',
			'',
			confirmUrl,
			'',
			'If this was not you, ignore this email. Unconfirmed addresses are deleted after 7 days.',
			'',
			'Kofra'
		].join('\n')
	};
}

/** Verifies a Cloudflare Turnstile token. Any failure (network, timeout, mismatch) is false. */
export async function verifyTurnstile(
	token: unknown,
	opts: { secret: string; ip: string | null; hostname: string; fetch?: typeof fetch }
): Promise<boolean> {
	if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;
	const body = new FormData();
	body.set('secret', opts.secret);
	body.set('response', token);
	if (opts.ip) body.set('remoteip', opts.ip);
	try {
		const res = await (opts.fetch ?? fetch)(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			{ method: 'POST', body, signal: AbortSignal.timeout(5000) }
		);
		if (!res.ok) return false;
		const out = (await res.json()) as { success?: boolean; hostname?: string; action?: string };
		return out.success === true && out.hostname === opts.hostname && out.action === 'waitlist';
	} catch {
		return false;
	}
}
