import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { purgeScheduled } from '../waitlist-purge.js';
import {
	MAX_SENDS,
	PENDING_RETENTION_S,
	RESEND_AFTER_S,
	SUPPRESSION_S,
	TOKEN_TTL_S,
	clientKey,
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
let d1: D1Like;
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
	d1 = s.d1;
	clock = 1_800_000_000;
	sent = [];
	deps = {
		store: d1Store(s.d1),
		hmacKey: HMAC_KEY,
		encKey: ENC_KEY,
		dailySendCap: 1000,
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
			`${'a'.repeat(250)}@example.com`,
			`${'a'.repeat(65)}@example.com`,
			// More than one recipient, or header syntax, in one field.
			'victim@example.com,evil.org',
			'victim@example.com;evil.org',
			'victim@example.com, other@example.org',
			'a(comment)@example.com',
			'a@example.com(comment)',
			'"a b"@example.com',
			'a\\b@example.com',
			'a:b@example.com',
			'a@example.com:25',
			// Not a host name.
			'a@[1.2.3.4]',
			'a@1.2.3.4',
			'a@[::1]',
			'a@example..com',
			'a@.example.com',
			'a@example.com.',
			'a@-example.com',
			'a@exa_mple.com',
			'a@example.com/path',
			'a@example.com?x=1',
			'a@example.com#x',
			'a@user:pw@example.com',
			'a@%65xample.com',
			// Dots in the local part only between other characters.
			'.a@example.com',
			'a.@example.com',
			'a..b@example.com',
			// Invisible format characters: zero-width space, joiner, bidi override, soft hyphen, BOM.
			'a\u200bb@example.com',
			'a\u200db@example.com',
			'a\u202eb@example.com',
			'a\u00adb@example.com',
			'a\ufeffb@example.com',
			'a@exam\u200bple.com'
		]) {
			expect(normaliseEmail(bad), JSON.stringify(bad)).toBeNull();
		}
	});

	it('gives a domain one spelling (IDNA), so look-alike spellings are one address', async () => {
		// Fullwidth letters and a fullwidth dot.
		expect(normaliseEmail('ada@\uff45xample.com')).toBe('ada@example.com');
		expect(normaliseEmail('ada@example\uff0ecom')).toBe('ada@example.com');
		// A Unicode label and its A-label, in any case.
		expect(normaliseEmail('ada@B\u00fccher.example')).toBe('ada@xn--bcher-kva.example');
		expect(normaliseEmail('ada@XN--Bcher-KVA.example')).toBe('ada@xn--bcher-kva.example');
		expect(await emailHash(normaliseEmail('ada@\uff45xample.com')!, HMAC_KEY)).toBe(
			await emailHash('ada@example.com', HMAC_KEY)
		);
	});

	it('keeps plus- and dot-variants of a mailbox distinct (documented policy)', () => {
		expect(normaliseEmail('ada+list@example.com')).toBe('ada+list@example.com');
		expect(normaliseEmail('a.da@example.com')).toBe('a.da@example.com');
	});
});

describe('clientKey', () => {
	it('keeps an IPv4 address and reduces an IPv6 address to its /64', () => {
		expect(clientKey('203.0.113.7')).toBe('203.0.113.7');
		expect(clientKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
		expect(clientKey('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64');
		expect(clientKey('2001:0DB8:0001:0002:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
		expect(clientKey('2001:db8:1:2::9')).toBe('2001:db8:1:2::/64');
		expect(clientKey('2001:db8::9')).toBe('2001:db8:0:0::/64');
		expect(clientKey('2001:db8:0:0:1::9')).toBe('2001:db8:0:0::/64');
		expect(clientKey('::1')).toBe('0:0:0:0::/64');
		// Another line is another key.
		expect(clientKey('2001:db8:1:3::9')).not.toBe(clientKey('2001:db8:1:2::9'));
	});

	it('uses one shared key for anything it cannot read', () => {
		for (const bad of [null, '', '2001:db8:1', 'zz:1:2:3:4:5:6:7', '1:2:3:4:5:6:7:8:9'])
			expect(clientKey(bad), String(bad)).toBe('unknown');
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

	it('hides the length of the address: every ciphertext has the same size', async () => {
		const longest = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`;
		expect(new TextEncoder().encode(longest)).toHaveLength(254);
		const sizes = new Set<number>();
		for (const email of ['a@b.co', 'ada@example.com', 'jos\u00e9@example.com', longest]) {
			const blob = await encryptEmail(email, ENC_KEY, AAD);
			sizes.add(atob(blob).length);
			expect(await decryptEmail(blob, ENC_KEY, AAD)).toBe(email);
		}
		expect([...sizes]).toEqual([12 + 256 + 16]);
		await expect(encryptEmail(`a${longest}`, ENC_KEY, AAD)).rejects.toThrow(/long/);
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
		await expect(decryptEmail(b64(bytes.slice(0, 20)), ENC_KEY, AAD)).rejects.toThrow(/size/);
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
		expect(row).toMatchObject({ created_at: clock, last_sent_at: clock, send_count: 1 });
		expect(await decryptEmail(row.email_enc!, ENC_KEY, row.email_hash)).toBe('ada@example.com');
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
		expect(await rowOf('ada@example.com')).toMatchObject({ last_sent_at: 0, send_count: 0 });
		expect(await join('ada@example.com', BASE, deps)).toBe('sent');
		expect(deps.send).toHaveBeenCalledTimes(2);
		expect(await rowOf('ada@example.com')).toMatchObject({ last_sent_at: clock, send_count: 1 });
	});

	it('gives back a failed send only while its own token is the current one', async () => {
		await join('ada@example.com', BASE, deps);
		const stale = await sha256(lastToken());
		const hash = await emailHash('ada@example.com', HMAC_KEY);
		clock += RESEND_AFTER_S;
		await join('ada@example.com', BASE, deps); // a newer request has replaced the token
		await deps.store.releaseSend(hash, stale);
		expect(await rowOf('ada@example.com')).toMatchObject({ last_sent_at: clock, send_count: 2 });
	});

	it('sends one email when the same address is submitted many times at once', async () => {
		const many = () =>
			Promise.all(Array.from({ length: 8 }, () => join('ada@example.com', BASE, deps)));
		expect(await many()).toEqual(Array(8).fill('sent'));
		expect(sent).toHaveLength(1);
		expect(rows()).toHaveLength(1);
		expect(await rowOf('ada@example.com')).toMatchObject({ send_count: 1 });
		// The link that was sent is the one that is stored.
		expect((await rowOf('ada@example.com'))!.token_hash).toBe(await sha256(lastToken()));
		clock += RESEND_AFTER_S;
		await many();
		expect(sent).toHaveLength(2);
		expect(await rowOf('ada@example.com')).toMatchObject({ send_count: 2 });
		expect((await rowOf('ada@example.com'))!.token_hash).toBe(await sha256(lastToken()));
	});

	it(`sends at most ${MAX_SENDS} emails for one sign-up, however often it is requested`, async () => {
		const first = clock;
		for (let i = 0; i < MAX_SENDS + 5; i++) {
			await join('ada@example.com', BASE, deps);
			clock += RESEND_AFTER_S;
		}
		expect(sent).toHaveLength(MAX_SENDS);
		// The last link still works, and the first request date never moved.
		expect(await rowOf('ada@example.com')).toMatchObject({
			status: 'pending',
			created_at: first,
			send_count: MAX_SENDS,
			token_hash: await sha256(lastToken())
		});
	});

	it('does not send a link that would outlive the row', async () => {
		await join('ada@example.com', BASE, deps);
		clock += PENDING_RETENTION_S - TOKEN_TTL_S;
		await join('ada@example.com', BASE, deps); // expires exactly when the row does
		expect(sent).toHaveLength(2);
		await join('bob@example.com', BASE, deps);
		clock = (await rowOf('bob@example.com'))!.created_at + PENDING_RETENTION_S - TOKEN_TTL_S + 1;
		await join('bob@example.com', BASE, deps);
		expect(sent).toHaveLength(3);
	});
});

describe('daily send cap', () => {
	afterEach(() => vi.restoreAllMocks());

	it('stops storing and sending above the cap, says so in the log, and recovers', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		deps.dailySendCap = 2;
		await join('a@example.com', BASE, deps);
		await join('b@example.com', BASE, deps);
		expect(warn).not.toHaveBeenCalled();
		expect(await join('c@example.com', BASE, deps)).toBe('sent'); // same answer, nothing done
		expect(sent).toHaveLength(2);
		expect(await rowOf('c@example.com')).toBeUndefined();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0])).not.toMatch(/example/);
		// A re-send counts against the cap as well.
		clock += RESEND_AFTER_S;
		await join('a@example.com', BASE, deps);
		expect(sent).toHaveLength(2);
		// A day after the first two sends there is room again.
		clock += 24 * 60 * 60 - RESEND_AFTER_S;
		await join('c@example.com', BASE, deps);
		expect(sent.map((m) => m.to)).toEqual(['a@example.com', 'b@example.com', 'c@example.com']);
	});

	it('holds when many different addresses arrive at once', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		deps.dailySendCap = 3;
		await Promise.all(
			Array.from({ length: 10 }, (_, i) => join(`user${i}@example.com`, BASE, deps))
		);
		expect(sent).toHaveLength(3);
		expect(rows()).toHaveLength(3);
	});

	it('does not count an email that could not be sent', async () => {
		deps.dailySendCap = 1;
		deps.send = vi.fn().mockRejectedValueOnce(new Error('provider down'));
		await expect(join('a@example.com', BASE, deps)).rejects.toThrow();
		expect(await deps.store.sentSince(clock - 24 * 60 * 60)).toBe(0);
		await join('a@example.com', BASE, deps);
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
		const confirmed = (await rowOf('ada@example.com'))!;
		clock += RESEND_AFTER_S;
		expect(
			await deps.store.claimSend({
				email_hash: pending.email_hash,
				email_enc: 'other',
				token_hash: 'f'.repeat(64),
				now: clock,
				dailySendCap: 1000
			})
		).toBe(false);
		await deps.store.releaseSend(pending.email_hash, pending.token_hash!);
		expect(await rowOf('ada@example.com')).toEqual(confirmed);
	});
});

describe('retention', () => {
	const DAY = 24 * 60 * 60;

	it('counts 7 days from the first request, whatever is asked again later', async () => {
		const first = clock;
		await join('pending@example.com', BASE, deps);
		await join('confirmed@example.com', BASE, deps);
		expect(await confirm(lastToken(), deps)).toBe('confirmed');
		clock += 3 * DAY;
		await join('pending@example.com', BASE, deps); // asks again on day 3: a new link, same date
		expect(sent).toHaveLength(3);
		expect((await rowOf('pending@example.com'))!.created_at).toBe(first);
		clock = first + PENDING_RETENTION_S;
		await join('other@example.com', BASE, deps);
		expect((await rowOf('pending@example.com'))!.status).toBe('pending'); // at the limit: stays
		clock += 1;
		await join('another@example.com', BASE, deps);
		// Past it: the address and the token are gone, only the keyed hash is left.
		expect(await rowOf('pending@example.com')).toEqual({
			email_hash: await emailHash('pending@example.com', HMAC_KEY),
			email_enc: null,
			status: 'suppressed',
			token_hash: null,
			token_expires_at: null,
			created_at: first,
			confirmed_at: null,
			last_sent_at: first + 3 * DAY,
			send_count: 2
		});
		expect((await rowOf('confirmed@example.com'))!.status).toBe('confirmed');
	});

	it('does not email a suppressed address, then forgets it after 30 more days', async () => {
		const first = clock;
		await join('ada@example.com', BASE, deps);
		const token = lastToken();
		clock = first + PENDING_RETENTION_S + 1;
		expect(await join('ada@example.com', BASE, deps)).toBe('sent');
		expect(sent).toHaveLength(1);
		expect((await rowOf('ada@example.com'))!.status).toBe('suppressed');
		expect(await confirm(token, deps)).toBe('expired');
		clock = first + PENDING_RETENTION_S + SUPPRESSION_S;
		await join('ada@example.com', BASE, deps);
		expect(sent).toHaveLength(1);
		clock += 1;
		// The purge at the start of this request deletes the row, so it is a new sign-up.
		await join('ada@example.com', BASE, deps);
		expect(sent).toHaveLength(2);
		expect(await rowOf('ada@example.com')).toMatchObject({
			status: 'pending',
			created_at: clock,
			send_count: 1
		});
	});

	it('keeps confirmed rows for good', async () => {
		await join('ada@example.com', BASE, deps);
		await confirm(lastToken(), deps);
		const row = await rowOf('ada@example.com');
		await deps.store.purge(clock + 10 * (PENDING_RETENTION_S + SUPPRESSION_S));
		expect(await rowOf('ada@example.com')).toEqual(row);
	});

	describe('cron handler', () => {
		afterEach(() => vi.useRealTimers());

		it('applies the same rules with the database binding alone, and is a no-op without it', async () => {
			await join('ada@example.com', BASE, deps);
			vi.useFakeTimers();
			vi.setSystemTime((clock + PENDING_RETENTION_S) * 1000);
			await purgeScheduled(null, { WAITLIST_DB: d1 });
			expect((await rowOf('ada@example.com'))!.status).toBe('pending');
			vi.setSystemTime((clock + PENDING_RETENTION_S + 1) * 1000 + 999);
			await purgeScheduled(null, {});
			expect((await rowOf('ada@example.com'))!.status).toBe('pending');
			await purgeScheduled(null, { WAITLIST_DB: d1 });
			expect(await rowOf('ada@example.com')).toMatchObject({
				status: 'suppressed',
				email_enc: null
			});
			vi.setSystemTime((clock + PENDING_RETENTION_S + SUPPRESSION_S + 1) * 1000);
			await purgeScheduled(null, { WAITLIST_DB: d1 });
			expect(rows()).toHaveLength(0);
		});
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
