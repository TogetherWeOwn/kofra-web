// The sign-in and account journeys against the real account service and API (the Kofra API
// Worker on a local D1; see live-servers.ts), not the in-memory fake: invites, the
// verification link, the welcome step, the authenticator app with real codes, passkeys with
// a virtual authenticator and the real WebAuthn checks, password reset, CSRF and API tokens.
// Runs only when KOFRA_API_DIR names a built kofra-api checkout.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import path from 'node:path';

const API = path.resolve(process.env.KOFRA_API_DIR ?? '.', 'workers/kofra-api');
const STATE = path.resolve(import.meta.dirname, '..', '.wrangler', 'e2e-live');
const wrangler = path.resolve(import.meta.dirname, '..', 'node_modules', '.bin', 'wrangler');
const RUN = randomBytes(3).toString('hex');
const PW = `live ${randomBytes(9).toString('base64url')} password`;
const addr = (local: string) => `${local}.${RUN}${'@'}example.com`;

// A deployed API's database (see live-servers.ts), or the local one.
const REMOTE_D1 = process.env.KOFRA_E2E_REMOTE_D1;

function sql(command: string): Record<string, unknown>[] {
	const where = REMOTE_D1
		? [REMOTE_D1, '--remote']
		: ['DB', '--local', '--persist-to', STATE, '-c', 'wrangler.toml'];
	const out = execFileSync(wrangler, ['d1', 'execute', ...where, '--json', '--command', command], {
		cwd: REMOTE_D1 ? path.resolve(import.meta.dirname, '..') : API,
		env: { ...process.env, CI: '1' },
		stdio: ['ignore', 'pipe', 'ignore']
	}).toString();
	return (JSON.parse(out) as { results: Record<string, unknown>[] }[])[0]?.results ?? [];
}

/** A user's ID by address, as an SQL subquery (addresses are this run's own). */
const userOf = (email: string) =>
	`(SELECT id FROM account_users WHERE email_key = '${email.toLowerCase()}')`;

// Remove what this run made (it may run against a shared staging database), in one call.
test.afterAll(() => {
	const mine = `(SELECT id FROM account_users WHERE email_key LIKE '%.${RUN}@example.com')`;
	const ws = `(SELECT workspace_id FROM api_members WHERE user_id IN ${mine})`;
	const mark = `e2e-delete-${RUN}`;
	sql(
		[
			`DELETE FROM api_tokens WHERE workspace_id IN ${ws}`,
			`DELETE FROM api_audit WHERE workspace_id IN ${ws}`,
			`DELETE FROM api_idempotency WHERE workspace_id IN ${ws}`,
			`DELETE FROM api_deletion_requests WHERE workspace_id IN ${ws}`,
			`DELETE FROM account_provisioning WHERE workspace_id IN ${ws}`,
			// Members point at workspaces: mark the workspaces, drop the members, then them.
			`UPDATE api_workspaces SET name = '${mark}' WHERE id IN ${ws}`,
			`DELETE FROM api_members WHERE user_id IN ${mine}`,
			`DELETE FROM api_workspaces WHERE name = '${mark}'`,
			`DELETE FROM account_users WHERE id IN ${mine}`,
			`DELETE FROM account_invites WHERE email_key LIKE '%.${RUN}@example.com'`,
			`DELETE FROM account_mail_outbox WHERE to_addr LIKE '%.${RUN}@example.com'`
		].join('; ')
	);
});

/** What the operator's invite script does: the hash in D1, the token to the person. */
function invite(email: string): string {
	const token = randomBytes(32).toString('base64url');
	const hash = createHash('sha256').update(token).digest('hex');
	const now = Date.now();
	sql(
		`INSERT INTO account_invites (id, token_hash, email_key, created_at, expires_at) VALUES ('inv_${randomBytes(8).toString('hex')}', X'${hash}', '${email.toLowerCase()}', ${now}, ${now + 86_400_000})`
	);
	return token;
}

/** The newest link token mailed to `email` (kept in the local outbox). */
async function mailed(email: string): Promise<string> {
	for (let i = 0; i < 30; i++) {
		const rows = sql(
			`SELECT text_body FROM account_mail_outbox WHERE to_addr = '${email.toLowerCase()}' ORDER BY id DESC LIMIT 1`
		);
		const m = /token=([A-Za-z0-9_-]{43})/.exec(String(rows[0]?.text_body ?? ''));
		if (m) return encodeURIComponent(m[1]!);
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error('no mail');
}

function totp(secret: string, step: number): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let bits = '';
	for (const c of secret.replace(/[\s=]/g, '').toUpperCase())
		bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
	const key: number[] = [];
	for (let i = 0; i + 8 <= bits.length; i += 8) key.push(parseInt(bits.slice(i, i + 8), 2));
	const msg = Buffer.alloc(8);
	msg.writeBigUInt64BE(BigInt(step));
	const h = createHmac('sha1', Buffer.from(key)).update(msg).digest();
	const o = h[h.length - 1]! & 0xf;
	const n = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
	return String(n % 1_000_000).padStart(6, '0');
}

async function axe(page: Page) {
	const { violations } = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
		.analyze();
	expect(
		violations
			.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))
			.map((v) => `${v.id}: ${v.nodes.map((node) => node.target.join(' ')).join(', ')}`)
	).toEqual([]);
}

async function login(page: Page, email: string, password = PW) {
	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function signOut(page: Page) {
	await page.goto('/sign-out');
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
}

/** Invite, sign-up, the verification link and the first workspace: a signed-in owner. */
async function newOwner(page: Page, local: string, name = 'New Customer') {
	const email = addr(local);
	await page.goto(`/signup?invite=${invite(email)}`);
	await page.getByLabel('Name').fill(name);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PW);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
	await page.goto(`/verify?token=${await mailed(email)}`);
	await page.getByLabel('Password', { exact: true }).fill(PW);
	await page.getByRole('button', { name: 'Confirm email address' }).click();
	await expect(
		page.getByText('Your email address is confirmed. Sign in to continue.')
	).toBeVisible();
	await login(page, email);
	await expect(page.getByLabel('Workspace name')).toHaveValue(`${name.split(' ')[0]}'s workspace`);
	await page.getByRole('button', { name: 'Create workspace' }).click();
	await expect(page.getByRole('heading', { name: 'Protect your account' })).toBeVisible();
	await page.getByRole('link', { name: 'Not now' }).click();
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
	return email;
}

test('invite, verification, workspace on the real service', async ({ page }) => {
	// An invite for another address, or none, is refused by the service.
	await page.goto(`/signup?invite=${invite(addr('someone-else'))}`);
	await page.getByLabel('Name').fill('Wrong Person');
	await page.getByLabel('Email').fill(addr('wrong'));
	await page.getByLabel('Password').fill(PW);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByText('Kofra is invite-only for now.', { exact: false })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toHaveCount(0);

	await newOwner(page, 'owner');
	await axe(page);
	const cookie = (await page.context().cookies()).find((c) => c.name === '__Host-kofra_session');
	expect(cookie).toMatchObject({ secure: true, httpOnly: true, sameSite: 'Lax', path: '/' });
	// The verification link never signed anyone in, and it is spent.
	expect(
		sql(
			`SELECT count(*) AS n FROM account_email_tokens WHERE used_at IS NULL AND purpose = 'verify' AND email = '${addr('owner')}'`
		)[0]?.n
	).toBe(0);
});

test('the authenticator app with real codes, then sign-in in two steps', async ({ page }) => {
	const email = await newOwner(page, 'totp');
	await page.goto('/account');
	await page.getByRole('button', { name: 'Set up', exact: true }).click();
	const secret = (await page.locator('#authenticator-secret').textContent())!.trim();
	const step = Math.floor(Date.now() / 30_000);
	const twoStep = page.getByRole('region', { name: 'Two-step verification' });
	await twoStep.getByLabel('Code', { exact: true }).fill(totp(secret, step));
	await twoStep.getByLabel('Current password').fill(PW);
	await page.getByRole('button', { name: 'Confirm setup' }).click();
	await expect(page.getByText('Save these recovery codes')).toBeVisible();
	const codes = (await page.locator('pre.code-block').first().textContent())!.trim().split('\n');
	expect(codes).toHaveLength(10);

	await signOut(page);
	await login(page, email);
	await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();
	await page.locator('html[data-ready]').waitFor({ state: 'attached' });
	// The code that confirmed the app was spent by it (replay guard).
	await page.getByLabel('Code', { exact: true }).fill(totp(secret, step));
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByText('That code did not work. Try again.')).toBeVisible();
	await page.getByLabel('Code', { exact: true }).fill(totp(secret, step + 1));
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

	// A recovery code works once.
	await signOut(page);
	await login(page, email);
	await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();
	await page.getByRole('link', { name: 'Use a recovery code instead' }).click();
	await page.getByLabel('Recovery code').fill(codes[0]!);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
});

test('CSRF is required and API tokens are made and revoked through the API', async ({
	page,
	baseURL
}) => {
	await newOwner(page, 'tokens');
	const response = await page.request.post('/account?/profile', {
		form: { name: 'Changed' },
		headers: { origin: baseURL! },
		maxRedirects: 0
	});
	expect(response.status()).toBe(403);
	await page.goto('/tokens');
	await page.getByRole('link', { name: 'Create token' }).click();
	await page.getByLabel('Name').fill('Build scripts');
	await page.getByLabel('View buckets').check();
	await page.getByRole('button', { name: 'Create token' }).click();
	await expect(page.getByText('Copy it now. You will not see it again.')).toBeVisible();
	await page.getByRole('link', { name: 'Done' }).click();
	await expect(page.getByText('Read only')).toBeVisible();
	expect(
		sql(
			`SELECT count(*) AS n FROM api_tokens WHERE name = 'Build scripts' AND revoked_at IS NULL AND user_id = ${userOf(addr('tokens'))}`
		)[0]?.n
	).toBeGreaterThan(0);
	await page.getByRole('link', { name: 'Revoke Build scripts' }).click();
	await page.getByRole('button', { name: 'Revoke token' }).click();
	await expect(page.getByText('No API tokens yet.')).toBeVisible();
});

test('password reset through the mailed link', async ({ browser, baseURL, page: first }) => {
	const email = await newOwner(first, 'reset');
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/reset');
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Send reset link' }).click();
	await expect(
		page.getByText(
			'If an account exists for that address, we sent a link. It works for 30 minutes.'
		)
	).toBeVisible();
	await page.goto(`/reset/new?token=${await mailed(email)}`);
	const password = `other ${randomBytes(9).toString('base64url')} password`;
	await page.getByLabel('New password').fill(password);
	await page.getByRole('button', { name: 'Set password' }).click();
	await expect(
		page.getByText('Your password was changed. Sign in with the new one.')
	).toBeVisible();
	await login(page, email, password);
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
	await context.close();
	// The reset ended the first browser's session.
	await first.goto('/account');
	await expect(first.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('a passkey is registered and signs in, checked by the real WebAuthn verifier', async ({
	page,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'The virtual authenticator uses Chromium CDP.');
	// A deployed API's passkeys belong to its own console host, not to this local one.
	test.skip(!!REMOTE_D1, 'Passkeys are bound to the deployed console host.');
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true
		}
	});
	await newOwner(page, 'passkey');
	await page.goto('/account');
	await page.getByRole('button', { name: 'Add a passkey' }).click();
	await page.getByLabel('Passkey name').fill('Test device');
	await page.locator('#new-passkey-password').fill(PW);
	await page.getByRole('button', { name: 'Create passkey' }).click();
	await expect(
		page
			.getByRole('region', { name: 'Passkeys' })
			.getByRole('cell', { name: 'Test device' })
			.first()
	).toBeVisible();
	await expect(page.getByText('Save these recovery codes')).toBeVisible();
	expect(
		sql(
			`SELECT count(*) AS n FROM account_passkeys WHERE name = 'Test device' AND user_id = ${userOf(addr('passkey'))}`
		)[0]?.n
	).toBeGreaterThan(0);

	await signOut(page);
	await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
});
