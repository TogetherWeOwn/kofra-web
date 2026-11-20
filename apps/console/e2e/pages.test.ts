import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PAGES, THEMES, VIEWPORTS } from './pages';

for (const path of PAGES) {
	test(`${path}: one h1, a title, security headers, no console errors`, async ({ page }) => {
		const problems: string[] = [];
		page.on('console', (m) => {
			if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
		});
		page.on('pageerror', (e) => problems.push(e.message));
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		const h = response!.headers();
		expect(h['x-robots-tag']).toBe('noindex');
		expect(h['cache-control']).toBe('private, no-store');
		expect(h['x-content-type-options']).toBe('nosniff');
		const csp = h['content-security-policy'] ?? '';
		expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
		expect(csp).toContain("style-src 'self';");
		expect(csp).toContain("frame-ancestors 'none'");
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
		expect((await page.title()).endsWith(': Kofra console')).toBe(true);
		// Client navigation adds the route announcer; its style must pass the CSP too.
		await page.locator('html[data-ready]').waitFor({ state: 'attached' });
		const to = path === '/' ? '/settings' : '/';
		await page.locator(`a[href="${to}"]`).first().click();
		await expect(page).toHaveURL(new RegExp(`${to === '/' ? '/' : '/settings'}$`));
		expect(problems).toEqual([]);
	});
}

// Hard gate: zero serious or critical axe violations on every page, in both themes, at
// phone and desktop widths.
for (const path of PAGES) {
	for (const theme of THEMES) {
		for (const vp of VIEWPORTS) {
			test(`axe ${path} ${theme} ${vp.name}`, async ({ browser }) => {
				const context = await browser.newContext({
					viewport: { width: vp.width, height: vp.height },
					colorScheme: theme
				});
				const page = await context.newPage();
				await page.goto(path);
				await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
				// Open disclosures and the phone menu so hidden content is checked too.
				await page
					.locator('details')
					.evaluateAll((els) => els.forEach((d) => d.setAttribute('open', '')));
				const menu = page.getByRole('button', { name: 'Menu' });
				if (await menu.isVisible()) await menu.click();
				const results = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
					.analyze();
				const serious = results.violations.filter(
					(v) => v.impact === 'serious' || v.impact === 'critical'
				);
				const minor = results.violations.filter((v) => !serious.includes(v));
				if (minor.length)
					console.log(`axe minor ${path} ${theme} ${vp.name}:`, minor.map((v) => v.id).join(', '));
				expect(
					serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
				).toEqual([]);
				await context.close();
			});
		}
	}
}

test('static assets and errors are not indexable either', async ({ page, request }) => {
	await page.goto('/');
	const src = await page
		.locator('link[href*="/_app/immutable/"], script[src*="/_app/immutable/"]')
		.first()
		.evaluate((el) => el.getAttribute('href') ?? el.getAttribute('src'));
	const asset = await request.get(new URL(src!, page.url()).href);
	expect(asset.status()).toBe(200);
	expect(asset.headers()['x-robots-tag']).toContain('noindex');
	const robots = await request.get('/robots.txt');
	expect(await robots.text()).toContain('Allow: /');
	expect(robots.headers()['x-robots-tag']).toContain('noindex');
	const missing = await request.get('/this-path-does-not-exist');
	expect(missing.status()).toBe(404);
	expect(missing.headers()['x-robots-tag']).toContain('noindex');
});

test('no customer-facing page names how storage works behind the scenes', async ({ page }) => {
	// The full deny-list runs over the build in CI (scripts/forbidden-words.mjs); this checks
	// the rendered text for the plain words a reviewer would look for first.
	for (const path of PAGES) {
		await page.goto(path);
		const text = (await page.locator('body').innerText()).toLowerCase();
		for (const word of ['backend', 'mock'])
			expect(text, `${path} says "${word}"`).not.toContain(word);
	}
});
