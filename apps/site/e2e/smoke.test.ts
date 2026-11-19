import { expect, test } from '@playwright/test';

test('home page renders the placeholder and is not indexable', async ({ page }) => {
	const response = await page.goto('/');
	expect(response?.status()).toBe(200);
	expect(response?.headers()['x-robots-tag']).toBe('noindex');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kofra');
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('static assets are not indexable', async ({ page, request }) => {
	await page.goto('/');
	const src = await page
		.locator('link[href*="/_app/immutable/"], script[src*="/_app/immutable/"]')
		.first()
		.evaluate((el) => el.getAttribute('href') ?? el.getAttribute('src'));
	expect(src).toBeTruthy();
	const asset = await request.get(new URL(src!, page.url()).href);
	expect(asset.status()).toBe(200);
	expect(asset.headers()['x-robots-tag']).toContain('noindex');
});

// robots.txt is outside /_app/, so only the root _headers catch-all rule
// can add the header. Crawling stays allowed so crawlers can see noindex.
test('robots.txt allows crawling and is not indexable', async ({ request }) => {
	const response = await request.get('/robots.txt');
	expect(response.status()).toBe(200);
	expect(await response.text()).toContain('Allow: /');
	expect(response.headers()['x-robots-tag']).toContain('noindex');
});

test('unknown paths return 404 and are not indexable', async ({ request }) => {
	const response = await request.get('/this-path-does-not-exist');
	expect(response.status()).toBe(404);
	expect(response.headers()['x-robots-tag']).toContain('noindex');
});
