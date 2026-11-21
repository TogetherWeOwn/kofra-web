import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { THEMES, VIEWPORTS } from './pages';

// tenant0 mode against the local fake of the storage service (e2e/fake-storage.ts). Every
// test starts from the fake's seed: buckets files (with folders) and scratch open in the
// console, nntune not open yet; the console's own key and two other keys.

const FAKE = 'http://127.0.0.1:4178';
const DEPLOYED = 'http://127.0.0.1:4179';

test.beforeEach(async ({ request }) => {
	expect((await request.post(`${FAKE}/__test/reset`)).status()).toBe(204);
});

async function ready(page: Page) {
	await page.locator('html[data-ready]').waitFor({ state: 'attached' });
}
const main = (page: Page) => page.locator('main');

test('as deployed, nothing is served without an Access token, and storage is never called', async ({
	request
}) => {
	const before = (await (await request.get(`${FAKE}/__test/calls`)).json()) as string[];
	for (const path of [
		'/',
		'/buckets',
		'/buckets/files',
		'/keys',
		'/usage',
		'/settings',
		'/sign-in'
	]) {
		const res = await request.get(`${DEPLOYED}${path}`, { maxRedirects: 0 });
		expect(res.status(), path).toBe(403);
	}
	const forged = await request.get(`${DEPLOYED}/buckets`, {
		headers: {
			// A well-formed token signed by nobody.
			'cf-access-jwt-assertion': [{ alg: 'RS256', kid: 'k1' }, {}, 'sig']
				.map((p) =>
					Buffer.from(typeof p === 'string' ? p : JSON.stringify(p)).toString('base64url')
				)
				.join('.')
		}
	});
	expect(forged.status()).toBe(403);
	const upload = await request.post(`${DEPLOYED}/buckets/files/upload`, {
		data: { key: 'x.txt', size: 1 },
		headers: { origin: DEPLOYED }
	});
	expect(upload.status()).toBe(403);
	const del = await request.post(`${DEPLOYED}/buckets/scratch/delete`, {
		form: { confirm: 'scratch' },
		headers: { origin: DEPLOYED }
	});
	expect(del.status()).toBe(403);
	const after = (await (await request.get(`${FAKE}/__test/calls`)).json()) as string[];
	expect(after.length).toBe(before.length);
});

test('buckets: the console lists what it can open, protects files, and offers the rest', async ({
	page
}) => {
	await page.goto('/buckets');
	const m = main(page);
	await expect(m.getByRole('link', { name: 'files', exact: true })).toBeVisible();
	await expect(m.getByRole('link', { name: 'scratch', exact: true })).toBeVisible();
	await expect(m.getByRole('link', { name: 'Delete bucket files' })).toHaveCount(0);
	await expect(m.getByRole('row', { name: /files.*Protected/ })).toBeVisible();
	await expect(m.getByRole('heading', { name: 'Not open in the console' })).toBeVisible();
	await expect(m.getByRole('link', { name: 'Open nntune in the console' })).toBeVisible();
	await expect(page.getByText('Live data')).toBeVisible();
	await expect(page.getByText('Owner workspace').first()).toBeVisible();
	await expect(page.getByRole('link', { name: 'Billing' })).toHaveCount(0);
});

test('the files bucket cannot be deleted, not even by a crafted request', async ({
	page,
	request
}) => {
	await page.goto('/buckets/files/delete');
	await expect(page.getByText('This bucket is protected')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete bucket' })).toHaveCount(0);
	const res = await request.post('/buckets/files/delete', {
		form: { confirm: 'files' },
		headers: { origin: 'http://127.0.0.1:4177' }
	});
	expect(await res.text()).toContain('protected');
	await page.goto('/buckets');
	await expect(main(page).getByRole('link', { name: 'files', exact: true })).toBeVisible();
	const calls = (await (await request.get(`${FAKE}/__test/calls`)).json()) as string[];
	expect(calls.filter((c) => c === 'DELETE /files')).toEqual([]);
});

test('create a bucket, then delete it with the typed confirmation', async ({ page }) => {
	await page.goto('/buckets?create');
	await ready(page);
	await page.getByLabel('Bucket name').fill('e2e-new');
	await page.getByRole('button', { name: 'Create bucket' }).click();
	await expect(page).toHaveURL(/\/buckets\/e2e-new\?created=1$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('e2e-new');
	await page.goto('/buckets/e2e-new/delete');
	await page.getByLabel('Type e2e-new to confirm').fill('e2e-new');
	await page.getByRole('button', { name: 'Delete bucket' }).click();
	await expect(page).toHaveURL(/\/buckets\?deleted=e2e-new$/);
	await expect(main(page).getByRole('link', { name: 'e2e-new', exact: true })).toHaveCount(0);
});

test('browse folders and pages of files', async ({ page }) => {
	await page.goto('/buckets/files');
	const m = main(page);
	for (const f of ['docs/', 'many/', 'photos/'])
		await expect(m.getByRole('link', { name: f })).toBeVisible();
	await expect(m.getByRole('rowheader', { name: 'notes.txt' })).toBeVisible();
	await m.getByRole('link', { name: 'docs/' }).click();
	await expect(m.getByRole('link', { name: 'plans/' })).toBeVisible();
	await expect(m.getByRole('rowheader', { name: 'readme.txt' })).toBeVisible();
	await page.goto('/buckets/files?prefix=many/');
	await expect(m.getByRole('rowheader', { name: /^file-\d+\.txt$/ })).toHaveCount(200);
	await m.getByRole('link', { name: 'Next page' }).click();
	await expect(m.getByRole('rowheader', { name: /^file-\d+\.txt$/ })).toHaveCount(30);
	await expect(m.getByRole('rowheader', { name: 'file-229.txt' })).toBeVisible();
	await m.getByRole('link', { name: 'First page' }).click();
	await expect(m.getByRole('rowheader', { name: 'file-000.txt' })).toBeVisible();
});

test('download through a short-lived presigned link', async ({ page, request }) => {
	await page.goto('/buckets/files?prefix=docs/');
	const href = await page.getByRole('link', { name: 'Download readme.txt' }).getAttribute('href');
	const res = await request.get(href!, { maxRedirects: 0 });
	expect(res.status()).toBe(303);
	const target = res.headers()['location']!;
	expect(target).toMatch(
		/^http:\/\/127\.0\.0\.1:4178\/files\/docs\/readme\.txt\?X-Amz-Algorithm=AWS4-HMAC-SHA256&/
	);
	expect(target).toContain('X-Amz-Expires=300');
	const file = await request.get(target);
	expect(file.status()).toBe(200);
	expect(await file.text()).toBe('Read me first.\n');
	expect(
		(
			await request.get(
				target.replace(/X-Amz-Signature=[0-9a-f]+/, `X-Amz-Signature=${'0'.repeat(64)}`)
			)
		).status()
	).toBe(403);
});

test('upload a small and a multipart file; an existing name is never replaced', async ({
	page,
	request
}) => {
	await page.goto('/buckets/scratch');
	await ready(page);
	const input = page.locator('input[type="file"]');
	await input.setInputFiles({
		name: 'hello.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('hello there')
	});
	await expect(page.getByText('Uploaded, 11 B')).toBeVisible();
	const big = Buffer.alloc(16 * 1024 * 1024 + 10, 7);
	await input.setInputFiles({ name: 'big.bin', mimeType: 'application/octet-stream', buffer: big });
	await expect(page.getByText(/Uploaded, 16(\.\d)? MB/)).toBeVisible({ timeout: 60_000 });
	await page.reload();
	await expect(main(page).getByRole('rowheader', { name: 'hello.txt' })).toBeVisible();
	await expect(main(page).getByRole('rowheader', { name: 'big.bin' })).toBeVisible();
	const href = await page.getByRole('link', { name: 'Download big.bin' }).getAttribute('href');
	const loc = (await request.get(href!, { maxRedirects: 0 })).headers()['location']!;
	expect((await (await request.get(loc)).body()).length).toBe(big.length);
	await ready(page);
	await page.locator('input[type="file"]').setInputFiles({
		name: 'hello.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('replacement')
	});
	await expect(page.getByText(/Failed: "hello.txt" already exists/)).toBeVisible();
	const again = await request.get(
		(await request.get(href!.replace('big.bin', 'hello.txt'), { maxRedirects: 0 })).headers()[
			'location'
		]!
	);
	expect(await again.text()).toBe('hello there');
});

test('an upload address only works for what it was issued for', async ({ request }) => {
	const origin = { origin: 'http://127.0.0.1:4177' };
	const start = await request.post('/buckets/scratch/upload', {
		data: { key: 'a.txt', size: 3 },
		headers: origin
	});
	expect(start.status()).toBe(200);
	const { url } = (await start.json()) as { url: string };
	const token = new URL(url).searchParams.get('t')!;
	const put = (path: string, body: string) =>
		request.put(path, {
			data: Buffer.from(body),
			headers: { ...origin, 'content-type': 'text/plain' }
		});
	expect(
		(await put(`/buckets/files/upload/object?t=${encodeURIComponent(token)}`, 'abc')).status()
	).toBe(403);
	expect(
		(await put(`/buckets/scratch/upload/object?t=${encodeURIComponent(token)}`, 'abcd')).status()
	).toBe(400);
	expect(
		(await put(`/buckets/scratch/upload/object?t=${encodeURIComponent(token)}x`, 'abc')).status()
	).toBe(403);
	expect(
		(await put(`/buckets/scratch/upload/object?t=${encodeURIComponent(token)}`, 'abc')).status()
	).toBe(200);
	// A cross-site request is refused before anything else.
	const cross = await request.post('/buckets/scratch/upload', {
		data: { key: 'b.txt', size: 1 },
		headers: { origin: 'https://evil.example' }
	});
	expect(cross.status()).toBe(403);
});

test('delete files only through the confirmation that lists them', async ({ page, request }) => {
	await page.goto('/buckets/files?prefix=docs/');
	await ready(page);
	await page.getByRole('checkbox', { name: 'Select readme.txt' }).check();
	await page.getByRole('button', { name: 'Delete selected' }).click();
	await expect(page).toHaveURL(
		/\/buckets\/files\/delete-files\?prefix=docs%2F&key=docs%2Freadme\.txt$/
	);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Delete 1 file from files');
	await expect(page.getByRole('rowheader', { name: 'docs/readme.txt' })).toBeVisible();
	// The server checks the confirmation, not only the browser.
	const form = await page
		.locator('form[method="POST"]')
		.evaluate((f) =>
			Object.fromEntries([...new FormData(f as HTMLFormElement)].map(([k, v]) => [k, String(v)]))
		);
	const unconfirmed = await request.post(page.url(), {
		form: { ...form },
		headers: { origin: 'http://127.0.0.1:4177' },
		maxRedirects: 0
	});
	expect(unconfirmed.status()).toBe(400);
	const tampered = await request.post(page.url(), {
		form: { ...form, key: 'notes.txt', confirm: 'yes' },
		headers: { origin: 'http://127.0.0.1:4177' },
		maxRedirects: 0
	});
	expect(await tampered.text()).toContain('not valid');
	await page.getByLabel('I understand that these 1 file are deleted for good.').check();
	await page.getByRole('button', { name: 'Delete 1 file' }).click();
	await expect(page).toHaveURL(/\/buckets\/files\?.*deleted=1/);
	await expect(page.getByText('1 file deleted.')).toBeVisible();
	await expect(main(page).getByRole('rowheader', { name: 'readme.txt' })).toHaveCount(0);
	await page.goto('/buckets');
	await expect(main(page).getByRole('link', { name: 'notes.txt' })).toHaveCount(0);
	await page.goto('/buckets/files');
	await expect(main(page).getByRole('rowheader', { name: 'notes.txt' })).toBeVisible();
});

test('open a bucket read-only, then allow changes', async ({ page }) => {
	await page.goto('/buckets/nntune/connect');
	await ready(page);
	await page.getByRole('button', { name: 'Open bucket' }).click();
	await expect(page).toHaveURL(/\/buckets\/nntune$/);
	await expect(page.getByText('Browse and download only')).toBeVisible();
	await expect(page.locator('input[type="file"]')).toHaveCount(0);
	await expect(page.getByRole('checkbox')).toHaveCount(0);
	await main(page).getByRole('link', { name: 'library/' }).click();
	await expect(main(page).getByRole('rowheader', { name: 'track.flac' })).toBeVisible();
	await page.getByRole('link', { name: 'Allow uploads and deletes' }).click();
	await ready(page);
	await page.getByRole('button', { name: 'Allow changes' }).click();
	await expect(page).toHaveURL(/\/buckets\/nntune$/);
	await expect(page.locator('input[type="file"]')).toHaveCount(1);
	// nntune is protected by this deploy's settings: no delete link.
	await expect(page.getByRole('link', { name: 'Delete bucket' })).toHaveCount(0);
});

test('create an access key with per-bucket access, see the secret once, then revoke it', async ({
	page
}) => {
	await page.goto('/keys');
	const m = main(page);
	await expect(
		m.getByRole('row', { name: /AKVLCONSOLE0000000001.*Used by this console/ })
	).toBeVisible();
	await expect(m.getByRole('link', { name: 'Revoke key AKVLCONSOLE0000000001' })).toHaveCount(0);
	await page.goto('/keys/new');
	await ready(page);
	await expect(page.getByLabel('Name')).toHaveCount(0);
	await page.getByLabel('files').selectOption('read');
	await page.getByLabel('scratch').selectOption('read_write');
	await page.getByLabel('nntune').selectOption('read');
	await page.getByRole('button', { name: 'Create access key' }).click();
	const secret = page.locator('#key-secret');
	await expect(secret).toBeVisible();
	const id = (await page.getByRole('heading', { level: 2, name: /^Key AKVL/ }).innerText()).match(
		/AKVL[A-Z0-9]+/
	)![0];
	await page.goto('/keys');
	const row = m.getByRole('row', { name: new RegExp(id) });
	await expect(row).toContainText('Read and write: scratch');
	await expect(row).toContainText('Read only: files, nntune');
	await expect(page.locator('#key-secret')).toHaveCount(0);
	await m.getByRole('link', { name: `Revoke key ${id}` }).click();
	await expect(page.getByText('Tools that use it stop working at once')).toBeVisible();
	await ready(page);
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: /Revoke/ }).click();
	await expect(page).toHaveURL(new RegExp(`/keys\\?revoked=${id}$`));
	await expect(m.getByRole('row', { name: new RegExp(id) })).toHaveCount(0);
});

test("the console's own key cannot be revoked, not even by a crafted request", async ({
	page,
	request
}) => {
	const res = await page.goto('/keys/AKVLCONSOLE0000000001/revoke');
	expect(res?.status()).toBe(403);
	const post = await request.post('/keys/AKVLCONSOLE0000000001/revoke', {
		form: { confirm: 'yes' },
		headers: { origin: 'http://127.0.0.1:4177' },
		maxRedirects: 0
	});
	expect(post.status()).toBe(403);
	await page.goto('/keys');
	await expect(main(page).getByRole('row', { name: /AKVLCONSOLE0000000001/ })).toBeVisible();
});

test('usage shows stored amounts only, and the workspace cannot be deleted', async ({
	page,
	request
}) => {
	await page.goto('/usage');
	await expect(page.getByText('Stored amounts only')).toBeVisible();
	await expect(main(page).getByRole('link', { name: 'files', exact: true })).toBeVisible();
	await expect(main(page).getByRole('link', { name: 'nntune', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Download CSV' })).toHaveCount(0);
	expect((await request.get('/usage/export.csv')).status()).toBe(404);
	await page.goto('/settings');
	await expect(page.getByRole('heading', { name: 'Delete workspace' })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Demo data' })).toHaveCount(0);
	expect((await request.get('/settings/delete-workspace')).status()).toBe(404);
	expect((await request.get('/settings/reset-demo')).status()).toBe(404);
	const del = await request.post('/settings/delete-workspace', {
		form: { confirm: 'ws_0' },
		headers: { origin: 'http://127.0.0.1:4177' },
		maxRedirects: 0
	});
	expect(del.status()).toBe(404);
	expect((await request.get('/demo-files/files/notes.txt?expires=9999999999')).status()).toBe(404);
	const calls = (await (await request.get(`${FAKE}/__test/calls`)).json()) as string[];
	expect(calls.filter((c) => c.includes('/_admin/status'))).toEqual([]);
});

const PAGES0 = [
	'/',
	'/buckets',
	'/buckets/files',
	'/buckets/files?prefix=many/',
	'/buckets/files/delete-files?key=notes.txt&key=docs/readme.txt',
	'/buckets/files/delete',
	'/buckets/scratch/delete',
	'/buckets/nntune/connect',
	'/keys',
	'/keys/new',
	'/usage',
	'/settings'
];

for (const path of PAGES0) {
	test(`tenant0 ${path}: one h1, a title, headers, no console errors`, async ({ page }) => {
		const problems: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error' || msg.type() === 'warning') problems.push(msg.text());
		});
		page.on('pageerror', (e) => problems.push(e.message));
		const res = await page.goto(path);
		expect(res?.status()).toBe(200);
		const h = res!.headers();
		expect(h['cache-control']).toBe('private, no-store');
		expect(h['x-robots-tag']).toBe('noindex');
		expect(h['content-security-policy'] ?? '').toMatch(/script-src 'self' 'nonce-[^']+'/);
		await expect(page.locator('h1')).toHaveCount(1);
		expect((await page.title()).endsWith(': Kofra console')).toBe(true);
		const text = (await page.locator('body').innerText()).toLowerCase();
		for (const word of ['backend', 'mock', 'tenant'])
			expect(text, `${path} says "${word}"`).not.toContain(word);
		expect(problems).toEqual([]);
	});
	for (const theme of THEMES) {
		for (const vp of VIEWPORTS) {
			test(`tenant0 axe ${path} ${theme} ${vp.name}`, async ({ browser }) => {
				const context = await browser.newContext({
					viewport: { width: vp.width, height: vp.height },
					colorScheme: theme,
					baseURL: 'http://127.0.0.1:4177'
				});
				const page = await context.newPage();
				await page.goto(path);
				await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
				const menu = page.getByRole('button', { name: 'Menu' });
				if (await menu.isVisible()) await menu.click();
				const results = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
					.analyze();
				const serious = results.violations.filter(
					(v) => v.impact === 'serious' || v.impact === 'critical'
				);
				expect(
					serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
				).toEqual([]);
				await context.close();
			});
		}
	}
}
