import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const existingPassword = 'correct horse battery staple';
const owner = 'owner@example.com';
const mfa = 'mfa@example.com';

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

async function login(page: Page, email: string, password = existingPassword) {
	await page.goto('/sign-in');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function token(page: Page, email: string) {
	const response = await page.request.get(`/__fake/last-token?${new URLSearchParams({ email })}`);
	expect(response.status()).toBe(200);
	const data = (await response.json()) as { token: string };
	return encodeURIComponent(data.token);
}

test('invite, verification and workspace setup', async ({ page }) => {
	await page.goto('/signup?invite=inv-e2e');
	await axe(page);
	await page.getByLabel('Name').fill('New Customer');
	await page.getByLabel('Email').fill('new@example.com');
	await page.getByLabel('Password').fill(existingPassword);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
	await axe(page);
	const path = `/verify?token=${await token(page, 'new@example.com')}`;
	await page.goto(path);
	await expect(page.getByRole('heading', { name: 'Confirm your email address' })).toBeVisible();
	await page.reload();
	await page.getByLabel('Password', { exact: true }).fill(existingPassword);
	await page.getByRole('button', { name: 'Confirm email address' }).click();
	await expect(
		page.getByText('Your email address is confirmed. Sign in to continue.')
	).toBeVisible();
	expect((await page.context().cookies()).some((c) => c.name === '__Host-kofra_session')).toBe(
		false
	);
	await login(page, 'new@example.com');
	await expect(page.getByLabel('Workspace name')).toHaveValue("New's workspace");
	await axe(page);
	const cookie = (await page.context().cookies()).find((c) => c.name === '__Host-kofra_session');
	expect(cookie).toMatchObject({ secure: true, httpOnly: true, sameSite: 'Lax', path: '/' });
	await page.getByRole('button', { name: 'Create workspace' }).click();
	await expect(page.getByRole('heading', { name: 'Protect your account' })).toBeVisible();
	await page.getByRole('link', { name: 'Not now' }).click();
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
});

test('authenticator sign-in refuses a wrong code and accepts the fake code', async ({ page }) => {
	await page.goto('/sign-in');
	await axe(page);
	await login(page, mfa);
	await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();
	await axe(page);
	await page.locator('html[data-ready]').waitFor({ state: 'attached' });
	await page.getByLabel('Code', { exact: true }).fill('000000');
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByText('That code did not work. Try again.')).toBeVisible();
	await expect(page.getByLabel('Code', { exact: true })).toBeFocused();
	await page.getByLabel('Code', { exact: true }).fill('123456');
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
});

test('account requires CSRF and tokens can be created and revoked', async ({ page, baseURL }) => {
	await login(page, owner);
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
	await page.goto('/account');
	await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
	await axe(page);
	const response = await page.request.post('/account?/profile', {
		form: { name: 'Changed' },
		headers: { origin: baseURL! },
		maxRedirects: 0
	});
	expect(response.status()).toBe(403);
	expect(await response.text()).toBe('This request was refused.');
	await page.goto('/tokens');
	await axe(page);
	await page.getByRole('link', { name: 'Create token' }).click();
	await page.getByLabel('Name').fill('Build scripts');
	await page.getByLabel('View buckets').check();
	await page.getByRole('button', { name: 'Create token' }).click();
	await expect(page.getByText('Copy it now. You will not see it again.')).toBeVisible();
	await page.getByRole('link', { name: 'Done' }).click();
	await expect(page.getByText('Read only')).toBeVisible();
	await page.getByRole('link', { name: 'Revoke Build scripts' }).click();
	await page.getByRole('button', { name: 'Revoke token' }).click();
	await expect(page.getByText('No API tokens yet.')).toBeVisible();
});

test('password reset works with standard form submissions', async ({
	browser,
	baseURL,
	page: accessiblePage
}) => {
	await accessiblePage.goto('/reset');
	await axe(accessiblePage);
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/reset');
	await page.getByLabel('Email').fill(owner);
	await page.getByRole('button', { name: 'Send reset link' }).click();
	await expect(
		page.getByText(
			'If an account exists for that address, we sent a link. It works for 30 minutes.'
		)
	).toBeVisible();
	await page.goto(`/reset/new?token=${await token(page, owner)}`);
	const password = 'a different test password';
	await page.getByLabel('New password').fill(password);
	await page.getByRole('button', { name: 'Set password' }).click();
	await expect(
		page.getByText('Your password was changed. Sign in with the new one.')
	).toBeVisible();
	await login(page, owner, password);
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
	await context.close();
});

test('registers a passkey and uses it to sign in', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'The virtual authenticator uses Chromium CDP.');
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

	await login(page, 'passkeys@example.com');
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
	await page.goto('/account');
	await page.getByRole('button', { name: 'Add a passkey' }).click();
	await expect(page.getByLabel('Passkey name')).toHaveValue(/Passkey on .+ on .+/);
	await page.getByLabel('Passkey name').fill('Test device');
	await page.locator('#new-passkey-password').fill('correct horse battery staple');
	await page.getByRole('button', { name: 'Create passkey' }).click();
	await expect(
		page
			.getByRole('region', { name: 'Passkeys' })
			.getByRole('cell', { name: 'Test device' })
			.first()
	).toBeVisible();
	await expect(page.getByText('Save these recovery codes')).toBeVisible();

	await page.goto('/sign-out');
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
	await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
});

test('a passkey-only account completes the second step with a recovery code', async ({
	page,
	browserName
}) => {
	test.skip(browserName !== 'chromium', 'The virtual authenticator uses Chromium CDP.');
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
	await login(page, 'recovery@example.com');
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
	await page.goto('/account');
	await page.getByRole('button', { name: 'Add a passkey' }).click();
	await page.getByLabel('Passkey name').fill('Recovery test');
	await page.locator('#new-passkey-password').fill(existingPassword);
	await page.getByRole('button', { name: 'Create passkey' }).click();
	const codes = (await page.locator('pre.code-block').first().textContent())!.trim().split('\n');
	expect(codes).toHaveLength(10);
	await page.goto('/sign-out');
	await page.getByRole('button', { name: 'Sign out', exact: true }).click();
	await login(page, 'recovery@example.com');
	await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();
	await page.getByLabel('Recovery code').fill(codes[0]!);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
});
