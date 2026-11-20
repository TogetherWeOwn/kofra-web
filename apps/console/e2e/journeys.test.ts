import { expect, test, type Page } from '@playwright/test';

// Each test starts with a fresh browser context, so a fresh demo workspace.

async function main(page: Page) {
	return page.locator('main');
}

/** Waits until the page is hydrated, for steps that need its script. */
async function ready(page: Page) {
	await page.locator('html[data-ready]').waitFor({ state: 'attached' });
}

test('create a bucket, refuse a wrong confirmation, then delete it', async ({ page }) => {
	await page.goto('/buckets');
	await page.getByRole('link', { name: 'Create bucket' }).first().click();
	await page.getByLabel('Bucket name').fill('Bad_Name');
	await page.getByRole('button', { name: 'Create bucket' }).click();
	await expect(page.getByText('is not a valid bucket name')).toBeVisible();
	await expect(page.getByLabel('Bucket name')).toHaveAttribute('aria-invalid', 'true');
	await page.getByLabel('Bucket name').fill('e2e-bucket');
	await page.getByRole('button', { name: 'Create bucket' }).click();
	await expect(page).toHaveURL(/\/buckets\/e2e-bucket\?created=1$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('e2e-bucket');
	await page.goto('/buckets');
	await expect(
		(await main(page)).getByRole('link', { name: 'e2e-bucket', exact: true })
	).toBeVisible();

	await page.getByRole('link', { name: 'Delete bucket e2e-bucket' }).click();
	await expect(page.getByText('Deletes the empty bucket "e2e-bucket"')).toBeVisible();
	await page.getByLabel('Type e2e-bucket to confirm').fill('e2e-bucke');
	await page.getByRole('button', { name: 'Delete bucket' }).click();
	await expect(page.getByText('The name you typed does not match.')).toBeVisible();
	await page.goto('/buckets');
	await expect(
		(await main(page)).getByRole('link', { name: 'e2e-bucket', exact: true })
	).toBeVisible();

	await page.goto('/buckets/e2e-bucket/delete');
	await page.getByLabel('Type e2e-bucket to confirm').fill('e2e-bucket');
	await page.getByRole('button', { name: 'Delete bucket' }).click();
	await expect(page).toHaveURL(/\/buckets\?deleted=e2e-bucket$/);
	await expect(page.getByText('The bucket e2e-bucket is gone.')).toBeVisible();
	await expect(
		(await main(page)).getByRole('link', { name: 'e2e-bucket', exact: true })
	).toHaveCount(0);
});

test('a bucket that holds files cannot be deleted', async ({ page }) => {
	await page.goto('/buckets/backups/delete');
	await expect(page.getByText('This bucket still holds files')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete bucket' })).toHaveCount(0);
});

test('create an access key: the secret is shown once, then revoke it with confirmation', async ({
	page
}) => {
	await page.goto('/keys/new');
	await page.getByRole('button', { name: 'Create access key' }).click();
	await expect(page.getByText('Give the key access to at least one bucket.')).toBeVisible();
	await page.getByLabel('Name (optional)').fill('e2e-key');
	await page.getByLabel('projects').selectOption('read');
	await page.getByRole('button', { name: 'Create access key' }).click();
	await expect(page.getByText('Copy the secret now')).toBeVisible();
	const secret = await page.locator('#key-secret').innerText();
	expect(secret).toMatch(/^[A-Za-z0-9]{40}$/);
	const id = await page.locator('#key-id').innerText();
	await expect(page.getByText(`AWS_SECRET_ACCESS_KEY=${secret}`)).toBeVisible();

	await page.goto('/keys');
	await expect(page.getByRole('row', { name: /e2e-key/ })).toContainText('Read only: projects');
	expect(await page.content()).not.toContain(secret);

	await page.getByRole('link', { name: 'Revoke key e2e-key' }).click();
	await expect(page.getByText(`Revokes access key ${id}`)).toBeVisible();
	await page.getByRole('button', { name: 'Revoke key' }).click();
	// The browser refuses an unticked required box; without script the server refuses too.
	await expect(page).toHaveURL(new RegExp(`/keys/${id}/revoke$`));
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Revoke key' }).click();
	await expect(page).toHaveURL(new RegExp(`/keys\\?revoked=${id}$`));
	await expect(page.getByRole('row', { name: /e2e-key/ })).toHaveCount(0);
});

test('the server refuses destructive actions without confirmation', async ({ page, request }) => {
	await page.goto('/keys');
	const origin = new URL(page.url()).origin;
	const res = await request.post('/keys/KF7Q2M8X4T7R5N0B/revoke', {
		form: {},
		headers: { origin, accept: 'application/json', 'x-sveltekit-action': 'true' }
	});
	expect(((await res.json()) as { type: string; status: number }).status).toBe(400);
	const bucket = await request.post('/buckets/backups/delete', {
		form: { confirm: 'wrong' },
		headers: { origin, accept: 'application/json', 'x-sveltekit-action': 'true' }
	});
	expect(((await bucket.json()) as { status: number }).status).toBe(400);
	const cross = await request.post('/keys/KF7Q2M8X4T7R5N0B/revoke', {
		form: { confirm: 'yes' },
		headers: { origin: 'https://evil.example' }
	});
	expect(cross.status()).toBe(403);
	await page.goto('/keys');
	await expect(page.getByRole('row', { name: /nightly-backup/ })).toBeVisible();
});

test('upload a file, see it listed, and download it through a presigned link', async ({ page }) => {
	await page.goto('/buckets/projects');
	await ready(page);
	await page.locator('input[type="file"]').setInputFiles({
		name: 'e2e note.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('hello from the e2e test\n')
	});
	await expect(page.getByText('Uploaded, 24 B')).toBeVisible();
	await expect(page.getByRole('rowheader', { name: 'e2e note.txt' })).toBeVisible();
	const download = page.waitForEvent('download');
	await page.getByRole('link', { name: 'Download e2e note.txt' }).click();
	const file = await download;
	expect(file.suggestedFilename()).toBe('e2e_note.txt.demo.txt');
});

test('folders open, and the breadcrumb leads back', async ({ page }) => {
	await page.goto('/buckets/backups');
	await page.getByRole('link', { name: 'server/' }).click();
	await page.getByRole('link', { name: 'db/' }).click();
	await expect(page).toHaveURL(/prefix=server%2Fdb%2F$/);
	await expect(page.getByRole('rowheader', { name: '2026-11-19.sql.gz' })).toBeVisible();
	await page
		.getByRole('navigation', { name: 'Breadcrumb' })
		.getByRole('link', { name: 'server' })
		.click();
	await expect(page.getByRole('link', { name: 'db/' })).toBeVisible();
});

test('request and cancel workspace deletion', async ({ page }) => {
	await page.goto('/settings/delete-workspace');
	await expect(page.getByText('Requests deletion of this workspace')).toBeVisible();
	const id = await page.locator('label[for="confirm"] code').innerText();
	await page.getByLabel(/Type the workspace ID/).fill(id);
	await page.getByRole('button', { name: 'Request deletion' }).click();
	await expect(page).toHaveURL(/done=deletion-requested$/);
	await expect(page.getByText('Workspace deletion requested')).toBeVisible();
	await page.getByRole('button', { name: 'Cancel deletion' }).first().click();
	await expect(page).toHaveURL(/done=deletion-cancelled$/);
	await expect(page.getByText('Workspace deletion requested')).toHaveCount(0);
});

test('reset the demo after a change', async ({ page }) => {
	await page.goto('/buckets/new');
	await page.getByLabel('Bucket name').fill('to-be-reset');
	await page.getByRole('button', { name: 'Create bucket' }).click();
	await expect(page).toHaveURL(/to-be-reset/);
	await page.goto('/settings/reset-demo');
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Reset demo data' }).click();
	await expect(page).toHaveURL(/done=demo-reset$/);
	await page.goto('/buckets');
	await expect(page.getByRole('link', { name: 'to-be-reset', exact: true })).toHaveCount(0);
});

test('billing stays off without a test key: buttons are disabled and say why', async ({ page }) => {
	await page.goto('/billing');
	await expect(page.getByText('Billing is not connected yet').first()).toBeVisible();
	await expect(page.getByRole('button', { name: 'Choose this plan' })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Manage payment details' })).toBeDisabled();
});

test('charts read out by keyboard and offer a table', async ({ page }) => {
	await page.goto('/usage');
	await ready(page);
	const slider = page.getByRole('slider', { name: 'Downloads per day: day' });
	await slider.focus();
	const last = await slider.getAttribute('aria-valuetext');
	await page.keyboard.press('ArrowLeft');
	const before = await slider.getAttribute('aria-valuetext');
	expect(before).not.toBe(last);
	await page.keyboard.press('Home');
	await expect(slider).toHaveAttribute('aria-valuenow', '0');
	await page.getByText('Table view').first().click();
	await expect(page.getByRole('table').first().getByRole('row')).toHaveCount(31);
});

test('the phone menu opens and closes', async ({ browser }) => {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const page = await context.newPage();
	await page.goto('/');
	await ready(page);
	const nav = page.getByRole('navigation', { name: 'Console sections' });
	await expect(nav).toBeHidden();
	await page.getByRole('button', { name: 'Menu' }).click();
	await expect(nav).toBeVisible();
	await nav.getByRole('link', { name: 'Usage' }).click();
	await expect(page).toHaveURL(/\/usage$/);
	await expect(nav).toBeHidden();
	await context.close();
});

test('the theme toggle switches and is announced as pressed', async ({ browser }) => {
	const context = await browser.newContext({ colorScheme: 'light' });
	const page = await context.newPage();
	await page.goto('/settings');
	await ready(page);
	const toggle = page.getByRole('button', { name: 'Dark theme' }).first();
	await toggle.click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await context.close();
});
