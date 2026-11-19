import { expect, test } from '@playwright/test';
import { checkJsonLd } from '../src/lib/schema-check';
import { PAGES } from './pages';

const ORIGIN = 'https://kofra.app';
const twinOf = (path: string) => (path === '/' ? '/index.md' : `${path}.md`);

for (const path of PAGES) {
	test(`${path}: canonical, social tags, valid JSON-LD and a Markdown twin`, async ({
		page,
		request
	}) => {
		await page.goto(path);
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${ORIGIN}${path}`);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
		for (const prop of ['og:title', 'og:description', 'og:url', 'og:image', 'og:type']) {
			await expect(page.locator(`meta[property="${prop}"]`), prop).toHaveCount(1);
		}
		await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
			'content',
			'summary_large_image'
		);

		const blocks = await page
			.locator('script[type="application/ld+json"]')
			.evaluateAll((els) => els.map((e) => e.textContent ?? ''));
		expect(blocks).toHaveLength(1);
		expect(checkJsonLd(JSON.parse(blocks[0]!))).toEqual([]);

		const alt = page.locator('link[rel="alternate"][type="text/markdown"]');
		await expect(alt).toHaveAttribute('href', twinOf(path));
		const twin = await request.get(twinOf(path));
		expect(twin.status()).toBe(200);
		expect(twin.headers()['content-type']).toContain('text/markdown');
		const md = await twin.text();
		const h1 = (await page.locator('h1').textContent())?.trim();
		expect(md).toContain(`\n# ${h1}\n`);
		// Parity: every heading and note the page shows is in the twin (Markdown marks removed).
		const flat = md
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
			.replace(/[*`]/g, '')
			.replace(/\s+/g, ' ');
		const shown = await page
			.locator('main h2, main h3, main [role="note"]')
			.evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
		for (const text of shown) expect(flat, `${path}: "${text}"`).toContain(text);
		expect(twin.headers()['link']).toBe(`<${ORIGIN}${path}>; rel="canonical"`);

		const negotiated = await request.get(path, { headers: { accept: 'text/markdown' } });
		expect(negotiated.status()).toBe(200);
		expect(negotiated.headers()['content-type']).toContain('text/markdown');
		expect(negotiated.headers()['vary']).toContain('Accept');
		expect(await negotiated.text()).toBe(md);

		expect(negotiated.headers()['link']).toBe(`<${ORIGIN}${path}>; rel="canonical"`);

		const html = await request.get(path, { headers: { accept: 'text/html,*/*;q=0.8' } });
		expect(html.headers()['content-type']).toContain('text/html');
		expect(html.headers()['vary']).toContain('Accept');
	});
}

test('llms.txt and llms-full.txt are served and every llms.txt link resolves', async ({
	request
}) => {
	const llms = await request.get('/llms.txt');
	expect(llms.status()).toBe(200);
	expect(llms.headers()['content-type']).toContain('text/plain');
	const links = [...(await llms.text()).matchAll(/\]\((https:\/\/kofra\.app[^)]+)\)/g)].map(
		(m) => m[1]!
	);
	expect(links.length).toBe(PAGES.length);
	for (const link of links) {
		const r = await request.get(link.slice(ORIGIN.length));
		expect(r.status(), link).toBe(200);
		expect(r.headers()['content-type'], link).toContain('text/markdown');
	}
	const full = await request.get('/llms-full.txt');
	expect(full.status()).toBe(200);
	expect((await full.text()).split('\n---\n').length).toBe(PAGES.length);
});

test('sitemap.xml lists every page and each one resolves', async ({ request }) => {
	const sitemap = await request.get('/sitemap.xml');
	expect(sitemap.status()).toBe(200);
	expect(sitemap.headers()['content-type']).toContain('xml');
	const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
	expect(locs.map((l) => l.slice(ORIGIN.length)).sort()).toEqual([...PAGES].sort());
	for (const loc of locs) expect((await request.get(loc.slice(ORIGIN.length))).status()).toBe(200);
});

test('the social image and logo exist at the advertised size', async ({ page, request }) => {
	for (const [path, w, h] of [
		['/og.png', 1200, 630],
		['/logo.png', 512, 512]
	] as const) {
		const r = await request.get(path);
		expect(r.status(), path).toBe(200);
		const png = await r.body();
		expect(png.readUInt32BE(16), path).toBe(w);
		expect(png.readUInt32BE(20), path).toBe(h);
	}
	await page.goto('/');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
		'content',
		`${ORIGIN}/og.png`
	);
});
