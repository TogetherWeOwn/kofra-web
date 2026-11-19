import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PAGES, THEMES, VIEWPORTS } from './pages';

for (const path of PAGES) {
	test(`${path}: one h1, a title, a description, security headers, no console errors`, async ({
		page
	}) => {
		const problems: string[] = [];
		page.on('console', (m) => {
			if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
		});
		page.on('pageerror', (e) => problems.push(e.message));
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		const headers = response!.headers();
		expect(headers['x-robots-tag']).toBe('noindex');
		expect(headers['content-security-policy']).toContain("script-src 'self'");
		expect(headers['x-content-type-options']).toBe('nosniff');
		await expect(page.locator('h1')).toHaveCount(1);
		expect((await page.title()).length).toBeGreaterThan(5);
		const description = await page.locator('meta[name="description"]').getAttribute('content');
		expect(description?.length ?? 0).toBeGreaterThan(50);
		// The only script is the theme switch (CSP violations also surface as console errors).
		const scripts = await page
			.locator('script[src]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('src')));
		expect(scripts).toHaveLength(1);
		expect(scripts[0]).toMatch(/\/_app\/immutable\/assets\/theme\.[\w-]+\.js$/);
		// Inline scripts: only the JSON-LD data block, which browsers never execute.
		await expect(page.locator('script:not([src]):not([type="application/ld+json"])')).toHaveCount(
			0
		);
		expect(problems).toEqual([]);
	});
}

// Hard gate: zero serious or critical axe violations on every page, in both themes, at
// phone and desktop widths. Lesser findings are printed so they stay visible.
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
				// Open every disclosure so hidden answers and menus are checked too.
				await page
					.locator('details')
					.evaluateAll((els) => els.forEach((d) => d.setAttribute('open', '')));
				const results = await new AxeBuilder({ page })
					.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
					.analyze();
				const serious = results.violations.filter(
					(v) => v.impact === 'serious' || v.impact === 'critical'
				);
				const minor = results.violations.filter((v) => !serious.includes(v));
				if (minor.length) {
					console.log(`axe minor ${path} ${theme} ${vp.name}:`, minor.map((v) => v.id).join(', '));
				}
				expect(
					serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
				).toEqual([]);
				await context.close();
			});
		}
	}
}

test('the theme toggle switches, persists across pages and is announced as pressed', async ({
	browser
}) => {
	const context = await browser.newContext({ colorScheme: 'light' });
	const page = await context.newPage();
	await page.goto('/');
	const toggle = page.getByRole('button', { name: 'Dark theme' });
	await expect(toggle).toHaveAttribute('aria-pressed', 'false');
	await toggle.click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await page.goto('/pricing');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.getByRole('button', { name: 'Dark theme' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await context.close();
});

test('without JavaScript every page still reads, the menu works and the toggle is hidden', async ({
	browser
}) => {
	const context = await browser.newContext({
		javaScriptEnabled: false,
		viewport: { width: 390, height: 844 }
	});
	const page = await context.newPage();
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Dark theme' })).toBeHidden();
	await page.getByText('Menu', { exact: true }).click();
	await page
		.getByRole('navigation', { name: 'Main' })
		.getByRole('link', { name: 'Pricing' })
		.click();
	await expect(page).toHaveURL(/\/pricing$/);
	await expect(page.locator('h1')).toHaveText('Pricing');
	await context.close();
});

test('every internal link resolves, including its #fragment', async ({ page, request }) => {
	const seen = new Set<string>();
	for (const path of PAGES) {
		await page.goto(path);
		// Same-page anchors (skip link, "On this page") must point at an element on this page.
		const anchors = await page
			.locator('a[href^="#"]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('href')!.slice(1)));
		for (const id of anchors) {
			await expect(page.locator(`[id="${id}"]`), `${path}#${id}`).toHaveCount(1);
		}
		const hrefs = await page
			.locator('a[href^="/"]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
		for (const h of hrefs) seen.add(h);
	}
	for (const href of seen) {
		const [path, fragment] = href.split('#') as [string, string | undefined];
		const r = await request.get(path);
		expect(r.status(), href).toBe(200);
		if (fragment) {
			await page.goto(path);
			await expect(page.locator(`[id="${fragment}"]`), href).toHaveCount(1);
		}
	}
});
