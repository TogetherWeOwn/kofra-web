import { expect, test } from '@playwright/test';
import { WAITLIST_RESULT_PAGES } from './pages';

// The default build has the waitlist off (wrangler.jsonc: WAITLIST_ENABLED "false"), and it must
// stay off until every binding and secret is in place. These tests pin the disabled state.

const ORIGIN = 'http://127.0.0.1:4173';
const TOKEN = 'A'.repeat(43);

test('the sign-up endpoint does not exist while the waitlist is off', async ({ request }) => {
	// A same-origin form post, so the framework's cross-site check is not what answers.
	const response = await request.post('/early-access/join', {
		headers: { origin: ORIGIN },
		form: { email: 'someone@example.com', 'cf-turnstile-response': 'x' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(404);
});

test('the confirmation page and action do not exist while the waitlist is off', async ({
	request
}) => {
	const page = await request.get(`/early-access/confirm?token=${TOKEN}`);
	expect(page.status()).toBe(404);
	expect(await page.text()).not.toContain(TOKEN);
	const action = await request.post('/early-access/confirm', {
		headers: { origin: ORIGIN },
		form: { token: TOKEN },
		maxRedirects: 0
	});
	expect(action.status()).toBe(404);
});

test('a cross-site form post is refused before it reaches the endpoint', async ({ request }) => {
	const response = await request.post('/early-access/join', {
		headers: { origin: 'https://attacker.example' },
		form: { email: 'someone@example.com' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(403);
});

test('the early access page shows no form and loads nothing from another origin', async ({
	page
}) => {
	const foreign: string[] = [];
	page.on('request', (r) => {
		if (!r.url().startsWith(ORIGIN)) foreign.push(r.url());
	});
	const response = await page.goto('/early-access');
	await expect(page.locator('form')).toHaveCount(0);
	const csp = response!.headers()['content-security-policy'] ?? '';
	expect(csp).toContain("script-src 'self';");
	expect(csp).not.toContain('challenges.cloudflare.com');
	expect(foreign).toEqual([]);
});

for (const path of WAITLIST_RESULT_PAGES) {
	test(`${path} renders, is noindex and keeps the strict policy`, async ({ page }) => {
		const problems: string[] = [];
		page.on('console', (m) => {
			if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
		});
		page.on('pageerror', (e) => problems.push(e.message));
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		const headers = response!.headers();
		expect(headers['x-robots-tag']).toBe('noindex');
		expect(headers['content-security-policy']).toContain("script-src 'self';");
		expect(headers['content-security-policy']).not.toContain('challenges.cloudflare.com');
		await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', 'noindex');
		await expect(page.locator('h1')).toHaveCount(1);
		await expect(page.locator('form')).toHaveCount(0);
		// Every link on the page leads somewhere.
		const hrefs = await page
			.locator('main a[href^="/"]')
			.evaluateAll((els) => els.map((e) => e.getAttribute('href')!));
		expect(hrefs.length).toBeGreaterThan(0);
		for (const href of hrefs) expect((await page.request.get(href)).status(), href).toBe(200);
		expect(problems).toEqual([]);
	});
}

test('the retention cron handler exists and does nothing without a database', async ({
	request
}) => {
	// wrangler dev runs the scheduled handler of the built entry Worker at this path.
	const response = await request.get('/cdn-cgi/handler/scheduled');
	expect(response.status()).toBe(200);
});
