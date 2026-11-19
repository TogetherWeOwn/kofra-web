import { expect, test } from '@playwright/test';

test('home page renders the placeholder and is not indexable', async ({ page }) => {
	const response = await page.goto('/');
	expect(response?.status()).toBe(200);
	expect(response?.headers()['x-robots-tag']).toBe('noindex');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kofra console');
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});
