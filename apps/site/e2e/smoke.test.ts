import { expect, test } from '@playwright/test';

test('home page renders and is not indexable', async ({ page }) => {
	const response = await page.goto('/');
	expect(response?.status()).toBe(200);
	expect(response?.headers()['x-robots-tag']).toBe('noindex');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'S3-compatible cloud storage for backups, media and archives'
	);
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

// Until launch (KOFRA_INDEXABLE unset) nothing may be crawled, and robots.txt
// itself carries the noindex header from the root _headers rule.
test('robots.txt disallows crawling before launch and is not indexable', async ({ request }) => {
	const response = await request.get('/robots.txt');
	expect(response.status()).toBe(200);
	expect(await response.text()).toBe('User-agent: *\nDisallow: /\n');
	expect(response.headers()['x-robots-tag']).toContain('noindex');
});

test('unknown paths return the 404 page with the site headers', async ({ page }) => {
	const response = await page.goto('/this-path-does-not-exist');
	expect(response?.status()).toBe(404);
	expect(response?.headers()['x-robots-tag']).toContain('noindex');
	expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
});
