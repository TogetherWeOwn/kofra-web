// Early-access waitlist with double opt-in. OFF unless WAITLIST_ENABLED is "true" (wrangler.jsonc
// vars); collecting addresses needs a privacy policy in force first, which is an owner decision.
//
// Storage choice (the safer of the two options): no plaintext address is stored.
// - email_hash = HMAC-SHA-256(normalised address, WAITLIST_HMAC_KEY): finds duplicates and lets an
//   address be removed on request, but a copy of the table alone cannot be reversed by guessing
//   addresses, because the key is not in the database.
// - email_enc = AES-256-GCM(address padded to a fixed length, WAITLIST_ENC_KEY) with a fresh
//   random 96-bit nonce per encryption and email_hash as associated data, so a ciphertext cannot
//   be moved to another row and its length says nothing about the address. It is needed once, to
//   invite the person at launch. A database leak without the Worker secrets reveals no address.
// - The two keys are separate secrets and must differ (waitlist-env.ts refuses equal keys).
// - The confirmation token is 256 random bits and is stored only as SHA-256. It is found by an
//   index lookup on that hash, never by comparing secret bytes, so response time says nothing
//   useful about a stored token. It expires after 24 hours and works once (one atomic UPDATE).
//
// Limits on confirmation emails, so the form cannot be used to pester someone or to burn the
// account's email quota. All of them are enforced by one atomic statement (claimSend):
// - one email per address per hour, MAX_SENDS in total for a sign-up;
// - no email whose link would outlive the row;
// - a daily cap over all addresses (Deps.dailySendCap).
//
// Retention (src/lib/waitlist-purge.js; on every sign-up and from an hourly cron trigger):
// - an unconfirmed row loses its address 7 days after the FIRST request for it; later requests do
//   not move that date. The keyed hash stays 30 more days ("suppressed") so the address cannot be
//   emailed again at once, then the row is deleted;
// - confirmed rows are kept until the launch invitation is sent or the person asks to be removed
//   (docs/waitlist.md).
import { PENDING_RETENTION_S, SUPPRESSION_S, purgeExpired } from '#lib/waitlist-purge.js';

export { PENDING_RETENTION_S, SUPPRESSION_S };
export const TOKEN_TTL_S = 24 * 60 * 60;
/** At most one confirmation email per address per hour. */
export const RESEND_AFTER_S = 60 * 60;
/** Confirmation emails per sign-up (until the row is confirmed or deleted). */
export const MAX_SENDS = 3;
/** Default for Deps.dailySendCap: confirmation emails a day over all addresses. */
export const DEFAULT_DAILY_SEND_CAP = 50;
const DAY_S = 24 * 60 * 60;
/** UTF-8 bytes; also the fixed plaintext size of email_enc minus its 2-byte length prefix. */
const MAX_EMAIL = 254;
const MAX_LOCAL = 64;
const PADDED = 2 + MAX_EMAIL;

export interface WaitlistRow {
	email_hash: string;
	email_enc: string | null;
	status: 'pending' | 'confirmed' | 'suppressed';
	token_hash: string | null;
	token_expires_at: number | null;
	created_at: number;
	confirmed_at: number | null;
	last_sent_at: number;
	send_count: number;
}

/** What claimSend writes for a sign-up request. */
export interface SendClaim {
	email_hash: string;
	email_enc: string;
	token_hash: string;
	now: number;
	dailySendCap: number;
}

/** Storage operations; d1Store() is the only implementation (tests run it on SQLite). */
export interface WaitlistStore {
	/**
	 * Decides and records, in one atomic statement, whether a confirmation email may be sent now:
	 * a new address, or a pending one within the per-address limits, and the daily cap not
	 * reached. True means "send exactly one email"; of concurrent calls for one address only one
	 * gets true. A confirmed or suppressed row is never changed.
	 */
	claimSend(claim: SendClaim): Promise<boolean>;
	/** Undoes the limits of a claim whose email could not be sent, if its token is still current. */
	releaseSend(emailHash: string, tokenHash: string): Promise<void>;
	/**
	 * Confirms the pending row that holds this token hash, if the token has not expired at `now`,
	 * and clears the token. One atomic statement: of two concurrent calls only one returns true.
	 */
	confirmToken(tokenHash: string, now: number): Promise<boolean>;
	/** Applies the retention rules at `now`. Confirmed rows are never touched. */
	purge(now: number): Promise<void>;
	/** Number of addresses with a confirmation email sent after `since`. */
	sentSince(since: number): Promise<number>;
}

export interface Deps {
	store: WaitlistStore;
	/** Base64 of 32 random bytes each. Missing or short keys disable the waitlist. */
	hmacKey: string;
	encKey: string;
	/** Confirmation emails a day over all addresses; above it, sign-ups are dropped silently. */
	dailySendCap: number;
	/** Sends the confirmation email. */
	send(to: string, confirmUrl: string): Promise<void>;
	/** Seconds since the epoch. */
	now(): number;
}

export type JoinResult = 'sent' | 'invalid';
export type ConfirmResult = 'confirmed' | 'expired';

const enc = new TextEncoder();

// Never valid in either part: spaces, control and invisible format characters (zero-width, bidi),
// and everything that separates addresses or starts a comment, route or literal in a mail header.
const FORBIDDEN = /[\s\p{Cc}\p{Cf},;:()[\]\\<>"@]/u;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** The domain in its one ASCII (IDNA) spelling, or null if it is not a plain host name. */
function normaliseDomain(input: string): string | null {
	if (FORBIDDEN.test(input) || /[/?#%]/.test(input)) return null;
	let host: string;
	try {
		// WHATWG URL host parsing is IDNA (UTS 46): case, fullwidth forms and Unicode labels all
		// map to one lower-case A-label spelling.
		host = new URL(`http://${input}`).hostname;
	} catch {
		return null;
	}
	const labels = host.split('.');
	// Dot-separated letter-digit-hyphen labels, at least two, and not an IP address.
	if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null;
	if (/^\d+$/.test(labels.at(-1)!)) return null;
	return host;
}

/**
 * The one spelling of an address that is hashed, stored and written to: trimmed, lower-cased,
 * NFC, domain in IDNA ASCII form. Plus- and dot-variants of a mailbox stay distinct addresses
 * (docs/waitlist.md). Returns null for anything that is not a plain `local@domain` address.
 */
export function normaliseEmail(input: unknown): string | null {
	if (typeof input !== 'string' || input.length > 4 * MAX_EMAIL) return null;
	const parts = input.trim().split('@');
	if (parts.length !== 2) return null;
	const local = parts[0]!.toLowerCase().normalize('NFC');
	if (local.length === 0 || local.length > MAX_LOCAL || FORBIDDEN.test(local)) return null;
	if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
	const domain = normaliseDomain(parts[1]!);
	if (!domain) return null;
	const email = `${local}@${domain}`;
	return enc.encode(email).length <= MAX_EMAIL ? email : null;
}

/**
 * Rate-limit key for a client address: an IPv4 address as it is, an IPv6 address by its /64
 * (one customer line usually owns a whole /64, so the full address would be no limit at all).
 */
export function clientKey(ip: string | null): string {
	if (!ip) return 'unknown';
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
	if (mapped) return mapped[1]!;
	if (!ip.includes(':')) return ip;
	const [head = '', tail] = ip.toLowerCase().split('::') as [string, string | undefined];
	const groups = head === '' ? [] : head.split(':');
	if (tail === undefined && groups.length !== 8) return 'unknown';
	while (groups.length < 4) groups.push('0'); // inside the "::" gap, or a short head
	if (!groups.slice(0, 4).every((g) => /^[0-9a-f]{1,4}$/.test(g))) return 'unknown';
	return `${groups
		.slice(0, 4)
		.map((g) => g.replace(/^0+(?=.)/, ''))
		.join(':')}::/64`;
}

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
 * AES-256-GCM; output is base64(12-byte random nonce || ciphertext with tag). The plaintext is
 * always 256 bytes (2-byte length, the address, zero padding), so every ciphertext has the same
 * length. `emailHashHex` (the row's primary key) is authenticated as associated data, binding
 * the ciphertext to its row.
 */
export async function encryptEmail(
	email: string,
	encKey: string,
	emailHashHex: string
): Promise<string> {
	const key = await crypto.subtle.importKey('raw', keyBytes(encKey), 'AES-GCM', false, ['encrypt']);
	const bytes = enc.encode(email);
	if (bytes.length > MAX_EMAIL) throw new Error('waitlist address is too long');
	const padded = new Uint8Array(PADDED);
	padded[0] = bytes.length >> 8;
	padded[1] = bytes.length & 0xff;
	padded.set(bytes, 2);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv, additionalData: enc.encode(emailHashHex) },
			key,
			padded
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
	if (bytes.length !== 12 + PADDED + 16) throw new Error('waitlist ciphertext has the wrong size');
	const pt = new Uint8Array(
		await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: enc.encode(emailHashHex) },
			key,
			bytes.slice(12)
		)
	);
	const length = (pt[0]! << 8) | pt[1]!;
	if (length > MAX_EMAIL || pt.slice(2 + length).some((b) => b !== 0))
		throw new Error('waitlist plaintext is malformed');
	return new TextDecoder('utf-8', { fatal: true }).decode(pt.slice(2, 2 + length));
}

/**
 * Adds an address (or re-sends its confirmation). Always reports "sent" for a valid address,
 * whether it was new, pending, confirmed, suppressed or over a limit, so the form reveals
 * nothing about who is on the list.
 */
export async function join(
	rawEmail: unknown,
	confirmBase: string,
	deps: Deps
): Promise<JoinResult> {
	const email = normaliseEmail(rawEmail);
	if (!email) return 'invalid';
	const now = deps.now();
	await deps.store.purge(now);
	const hash = await emailHash(email, deps.hmacKey);
	const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
	const tokenHash = await sha256(token);
	const claimed = await deps.store.claimSend({
		email_hash: hash,
		email_enc: await encryptEmail(email, deps.encKey, hash),
		token_hash: tokenHash,
		now,
		dailySendCap: deps.dailySendCap
	});
	if (!claimed) {
		// Fixed text, no address: the operator must be able to see that sign-ups are being dropped.
		if ((await deps.store.sentSince(now - DAY_S)) >= deps.dailySendCap)
			console.warn('waitlist: daily send cap reached; sign-ups are not stored until it clears');
		return 'sent';
	}
	const url = new URL(confirmBase);
	url.searchParams.set('token', token);
	try {
		await deps.send(email, url.href);
	} catch (err) {
		// Nothing was sent: give the attempt back, so the person can retry at once.
		await deps.store.releaseSend(hash, tokenHash);
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
		claimSend: async (c) => {
			// One statement, so two requests cannot both pass a check and then both send.
			// Insert: a new address, unless the daily cap is reached. On conflict: only a pending
			// row that is due for a re-send, under its send limit, and old enough to keep
			// (created_at is never moved) for the whole life of the new link.
			const res = await db
				.prepare(
					`INSERT INTO waitlist (email_hash, email_enc, status, token_hash, token_expires_at,
					   created_at, confirmed_at, last_sent_at, send_count)
					 SELECT ?1, ?2, 'pending', ?3, ?4 + ?5, ?4, NULL, ?4, 1
					 WHERE (SELECT COUNT(*) FROM waitlist WHERE last_sent_at > ?4 - ?6) < ?7
					 ON CONFLICT (email_hash) DO UPDATE SET email_enc = excluded.email_enc,
					   token_hash = excluded.token_hash, token_expires_at = excluded.token_expires_at,
					   last_sent_at = excluded.last_sent_at, send_count = waitlist.send_count + 1
					 WHERE waitlist.status = 'pending' AND waitlist.last_sent_at <= ?4 - ?8
					   AND waitlist.send_count < ?9
					   AND waitlist.created_at + ?10 >= excluded.token_expires_at`
				)
				.bind(
					c.email_hash,
					c.email_enc,
					c.token_hash,
					c.now,
					TOKEN_TTL_S,
					DAY_S,
					c.dailySendCap,
					RESEND_AFTER_S,
					MAX_SENDS,
					PENDING_RETENTION_S
				)
				.run();
			return res.meta.changes === 1;
		},
		releaseSend: async (emailHash, tokenHash) => {
			await db
				.prepare(
					`UPDATE waitlist SET last_sent_at = 0, send_count = MAX(send_count - 1, 0)
					 WHERE email_hash = ?1 AND token_hash = ?2 AND status = 'pending'`
				)
				.bind(emailHash, tokenHash)
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
		purge: (now) => purgeExpired(db, now),
		sentSince: async (since) => {
			const row = await db
				.prepare('SELECT COUNT(*) AS n FROM waitlist WHERE last_sent_at > ?')
				.bind(since)
				.first<{ n: number }>();
			return row?.n ?? 0;
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
