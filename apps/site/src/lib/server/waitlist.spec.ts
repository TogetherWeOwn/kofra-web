import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	PENDING_RETENTION_S,
	RESEND_AFTER_S,
	TOKEN_TTL_S,
	confirm,
	confirmationEmail,
	d1Store,
	decryptEmail,
	emailHash,
	encryptEmail,
	join,
	keyBytes,
	normaliseEmail,
	sha256,
	verifyTurnstile,
	type D1Like,
	type Deps,
	type WaitlistRow
} from './waitlist';

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const key = (fill: number) => b64(new Uint8Array(32).fill(fill));
const HMAC_KEY = key(1);
const ENC_KEY = key(2);
const BASE = 'https://kofra.example/early-access/confirm';

/** The real migration and the real SQL of d1Store(), on an in-memory SQLite database. */
function sqliteD1(): { d1: D1Like; db: DatabaseSync } {
	const db = new DatabaseSync(':memory:');
	db.exec(readFileSync(new URL('../../../migrations/0001_waitlist.sql', import.meta.url), 'utf8'));
	const d1: D1Like = {
		prepare: (sql) => ({
			bind: (...values) => ({
				first: async <T>() => (db.prepare(sql).get(...(values as SQLInputValue[])) ?? null) as T,
				run: async () => ({
					meta: { changes: Number(db.prepare(sql).run(...(values as SQLInputValue[])).changes) }
				})
			})
		})
	};
	return { d1, db };
}

let db: DatabaseSync;
let deps: Deps;
let clock: number;
let sent: { to: string; url: string }[];

const rows = () => db.prepare('SELECT * FROM waitlist ORDER BY created_at').all() as unknown[];
const rowOf = async (email: string) =>
	db
		.prepare('SELECT * FROM waitlist WHERE email_hash = ?')
		.get(await emailHash(email, HMAC_KEY)) as unknown as WaitlistRow | undefined;
const lastToken = () => new URL(sent.at(-1)!.url).searchParams.get('token')!;

beforeEach(() => {
	const s = sqliteD1();
	db = s.db;
	clock = 1_800_000_000;
	sent = [];
	deps = {
		store: d1Store(s.d1),
		hmacKey: HMAC_KEY,
		encKey: ENC_KEY,
		now: () => clock,
		send: async (to, url) => {
			sent.push({ to, url });
		}
	};
});

describe('normaliseEmail and emailHash', () => {
	it('gives one hash for one address however it is typed', async () => {
		expect(normaliseEmail('  Ada@Example.COM ')).toBe('ada@example.com');
		const a = await emailHash(normaliseEmail('  Ada@Example.COM ')!, HMAC_KEY);
		expect(a).toBe(await emailHash(normaliseEmail('ada@example.com')!, HMAC_KEY));
		expect(a).toMatch(/^[0-9a-f]{64}$/);
		// Composed and decomposed forms of the same letter are one address.
		expect(normaliseEmail('jose\u0301@example.com')).toBe('jos\u00e9@example.com');
	});

	it('is keyed: another key gives another hash, and it is not a bare SHA-256', async () => {
		const a = await emailHash('ada@example.com', HMAC_KEY);
		expect(a).not.toBe(await emailHash('ada@example.com', ENC_KEY));
		expect(a).not.toBe(await sha256('ada@example.com'));
	});

	it('rejects what is not a plausible address', () => {
		for (const bad of [
			null,
			undefined,
			7,
			'',
			'a@b',
			'no-at.example.com',
			'two@@example.com',
			'a b@example.com',
			'a@example.com\r\nBcc: x@example.com',
			'a\u0000@example.com',
			'<a@example.com>',
			`${'a'.repeat(250)}@example.com`
		]) {
			expect(normaliseEmail(bad), String(bad)).toBeNull();
		}
	});
});

describe('keyBytes', () => {
	it('accepts exactly 32 bytes of base64', () => {
		expect(keyBytes(HMAC_KEY)).toHaveLength(32);
		expect(() => keyBytes(b64(new Uint8Array(31)))).toThrow(/32 bytes/);
		expect(() => keyBytes(b64(new Uint8Array(33)))).toThrow(/32 bytes/);
		expect(() => keyBytes('not base64 !!')).toThrow(/base64/);
	});
});

describe('encryptEmail / decryptEmail', () => {
	const AAD = 'a'.repeat(64);

	it('round-trips', async () => {
		const blob = await encryptEmail('ada@example.com', ENC_KEY, AAD);
		expect(blob).not.toContain('ada');
		expect(await decryptEmail(blob, ENC_KEY, AAD)).toBe('ada@example.com');
	});

	it('uses a fresh nonce every time', async () => {
		const blobs = await Promise.all(
			Array.from({ length: 200 }, () => encryptEmail('ada@example.com', ENC_KEY, AAD))
		);
		const nonces = blobs.map((b) => atob(b).slice(0, 12));
		expect(new Set(nonces).size).toBe(200);
		expect(new Set(blobs).size).toBe(200);
	});

	it('rejects a changed ciphertext, nonce or tag, a wrong key and another row', async () => {
		const blob = await encryptEmail('ada@example.com', ENC_KEY, AAD);
		const bytes = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
		for (const at of [0, 12, bytes.length - 1]) {
			const copy = bytes.slice();
			copy[at] = copy[at]! ^ 1;
			await expect(decryptEmail(b64(copy), ENC_KEY, AAD), `byte ${at}`).rejects.toThrow();
		}
		await expect(decryptEmail(b64(bytes.slice(0, -1)), ENC_KEY, AAD)).rejects.toThrow();
		await expect(decryptEmail(b64(bytes.slice(0, 20)), ENC_KEY, AAD)).rejects.toThrow(/short/);
		await expect(decryptEmail(blob, HMAC_KEY, AAD)).rejects.toThrow();
		await expect(decryptEmail(blob, ENC_KEY, 'b'.repeat(64))).rejects.toThrow();
	});
});

describe('join', () => {
	it('stores no plaintext address and sends one confirmation link', async () => {
		expect(await join(' Ada@Example.com ', BASE, deps)).toBe('sent');
		expect(sent).toHaveLength(1);
		expect(sent[0]!.to).toBe('ada@example.com');
		const token = lastToken();
		expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(JSON.stringify(rows())).not.toMatch(/ada|example\.com/i);
		expect(JSON.stringify(rows())).not.toContain(token);
		const row = (await rowOf('ada@example.com'))!;
		expect(row.status).toBe('pending');
		expect(row.token_hash).toBe(await sha256(token));
		expect(row.token_expires_at).toBe(clock + TOKEN_TTL_S);
		expect(await decryptEmail(row.email_enc, ENC_KEY, row.email_hash)).toBe('ada@example.com');
	});

	it('answers the same for a new, a pending and a confirmed address', async () => {
		expect(await join('ada@example.com', BASE, deps)).toBe('sent');
		expect(await join('ada@example.com', BASE, deps)).toBe('sent'); // pending: no second email
		expect(sent).toHaveLength(1);
		expect(await confirm(lastToken(), deps)).toBe('confirmed');
		clock += RESEND_AFTER_S + 1;
		expect(await join('ada@example.com', BASE, deps)).toBe('sent'); // confirmed: no email
		expect(sent).toHaveLength(1);
		expect((await rowOf('ada@example.com'))!.status).toBe('confirmed');
		expect(await join('not an address', BASE, deps)).toBe('invalid');
	});

	it('re-sends after an hour with a new token; the old one stops working', async () => {
		await join('ada@example.com', BASE, deps);
		const first = lastToken();
		clock += RESEND_AFTER_S;
		await join('ada@example.com', BASE, deps);
		expect(sent).toHaveLength(2);
		expect(lastToken()).not.toBe(first);
		expect(await confirm(first, deps)).toBe('expired');
		expect(await confirm(lastToken(), deps)).toBe('confirmed');
		expect(rows()).toHaveLength(1);
	});

	it('lets the address retry at once when the email could not be sent', async () => {
		deps.send = vi.fn().mockRejectedValueOnce(new Error('provider down'));
		await expect(join('ada@example.com', BASE, deps)).rejects.toThrow('provider down');
		expect((await rowOf('ada@example.com'))!.last_sent_at).toBe(0);
		expect(await join('ada@example.com', BASE, deps)).toBe('sent');
		expect(deps.send).toHaveBeenCalledTimes(2);
	});
});

describe('confirm', () => {
	it('works once', async () => {
		await join('ada@example.com', BASE, deps);
		const token = lastToken();
		clock += 60;
		expect(await confirm(token, deps)).toBe('confirmed');
		const row = (await rowOf('ada@example.com'))!;
		expect(row).toMatchObject({
			status: 'confirmed',
			token_hash: null,
			token_expires_at: null,
			confirmed_at: clock
		});
		expect(await confirm(token, deps)).toBe('expired');
	});

	it('confirms only once when the button is pressed twice at the same moment', async () => {
		await join('ada@example.com', BASE, deps);
		const token = lastToken();
		const results = await Promise.all([confirm(token, deps), confirm(token, deps)]);
		expect(results.sort()).toEqual(['confirmed', 'expired']);
	});

	it('expires after 24 hours, to the second', async () => {
		await join('ada@example.com', BASE, deps);
		const token = lastToken();
		clock += TOKEN_TTL_S + 1;
		expect(await confirm(token, deps)).toBe('expired');
		expect((await rowOf('ada@example.com'))!.status).toBe('pending');
		clock -= 1;
		expect(await confirm(token, deps)).toBe('confirmed');
	});

	it('rejects a tampered, truncated, unknown or non-string token', async () => {
		await join('ada@example.com', BASE, deps);
		const token = lastToken();
		const flipped = (token[0] === 'A' ? 'B' : 'A') + token.slice(1);
		for (const bad of [flipped, token.slice(1), `${token}A`, `${token}=`, '', null, 42, [token]]) {
			expect(await confirm(bad, deps), String(bad)).toBe('expired');
		}
		expect((await rowOf('ada@example.com'))!.status).toBe('pending');
		expect(await confirm(token, deps)).toBe('confirmed');
	});

	it('never lets a late sign-up write undo a confirmation', async () => {
		await join('ada@example.com', BASE, deps);
		const pending = (await rowOf('ada@example.com'))!;
		await confirm(lastToken(), deps);
		await deps.store.put({ ...pending, last_sent_at: 0 });
		expect((await rowOf('ada@example.com'))!.status).toBe('confirmed');
	});
});

describe('retention', () => {
	it('deletes pending rows 7 days after the latest request and keeps confirmed ones', async () => {
		await join('old-pending@example.com', BASE, deps);
		await join('old-confirmed@example.com', BASE, deps);
		expect(await confirm(lastToken(), deps)).toBe('confirmed');
		clock += 3 * 24 * 60 * 60;
		await join('old-pending-again@example.com', BASE, deps);
		clock += RESEND_AFTER_S;
		await join('old-pending@example.com', BASE, deps); // asks again: the clock restarts
		clock += PENDING_RETENTION_S - RESEND_AFTER_S + 1;
		// Day 10 and a second: only the request from day 3 that was never repeated is too old.
		await join('new@example.com', BASE, deps);
		expect(await rowOf('old-pending-again@example.com')).toBeUndefined();
		expect((await rowOf('old-pending@example.com'))!.status).toBe('pending');
		expect((await rowOf('old-confirmed@example.com'))!.status).toBe('confirmed');
		expect((await rowOf('new@example.com'))!.status).toBe('pending');
		clock += PENDING_RETENTION_S + 1;
		await join('newer@example.com', BASE, deps);
		expect(rows()).toHaveLength(2); // the confirmed row and the newest request
		expect((await rowOf('old-confirmed@example.com'))!.status).toBe('confirmed');
	});

	it('purges on the boundary exactly: created before the cut-off goes, at it stays', async () => {
		await join('a@example.com', BASE, deps);
		await deps.store.purgePending(clock);
		expect(rows()).toHaveLength(1);
		await deps.store.purgePending(clock + 1);
		expect(rows()).toHaveLength(0);
	});
});

describe('confirmationEmail', () => {
	it('is plain text with the link and the retention note', () => {
		const mail = confirmationEmail(`${BASE}?token=abc`);
		expect(mail.subject).toContain('Kofra');
		expect(mail.text).toContain(`${BASE}?token=abc`);
		expect(mail.text).toContain('deleted after 7 days');
	});
});

describe('verifyTurnstile', () => {
	const opts = (body: unknown, ok = true) => {
		const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 }));
		return { secret: 'turnstile-secret', ip: '203.0.113.7', hostname: 'kofra.example', fetch };
	};
	const good = { success: true, hostname: 'kofra.example', action: 'waitlist' };

	it('accepts a token Cloudflare verified for this host and action', async () => {
		const o = opts(good);
		expect(await verifyTurnstile('tok', o)).toBe(true);
		const [url, init] = o.fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
		const body = init.body as FormData;
		expect(init.method).toBe('POST');
		expect(body.get('secret')).toBe('turnstile-secret');
		expect(body.get('response')).toBe('tok');
		expect(body.get('remoteip')).toBe('203.0.113.7');
	});

	it('refuses everything else, without calling out for an absent token', async () => {
		expect(await verifyTurnstile('tok', opts({ ...good, success: false }))).toBe(false);
		expect(await verifyTurnstile('tok', opts({ ...good, hostname: 'evil.example' }))).toBe(false);
		expect(await verifyTurnstile('tok', opts({ ...good, action: 'login' }))).toBe(false);
		expect(await verifyTurnstile('tok', opts(good, false))).toBe(false);
		const down = { ...opts(good), fetch: vi.fn().mockRejectedValue(new Error('network')) };
		expect(await verifyTurnstile('tok', down)).toBe(false);
		for (const absent of [null, undefined, '', 'x'.repeat(2049), new Blob(['tok'])]) {
			const o = opts(good);
			expect(await verifyTurnstile(absent, o)).toBe(false);
			expect(o.fetch).not.toHaveBeenCalled();
		}
	});
});
