import { describe, expect, it } from 'vitest';
import { PAGES as E2E_PAGES } from '../../e2e/pages';
import { llmsFullTxt, llmsTxt, robotsTxt, sitemapXml } from './discovery';
import { graphFor } from './jsonld';
import { PAGES, pageFor, twinDocument, twinPath } from './registry';
import { checkJsonLd } from './schema-check';
import { SITE } from './site';

describe('page registry', () => {
	it('lists exactly the pages the e2e suite checks', () => {
		expect(PAGES.map((p) => p.path).sort()).toEqual([...E2E_PAGES].sort());
	});

	it('gives every page a unique title and a useful description', () => {
		expect(new Set(PAGES.map((p) => p.title)).size).toBe(PAGES.length);
		for (const p of PAGES) {
			expect(p.description.length, p.path).toBeGreaterThanOrEqual(50);
			expect(p.description.length, p.path).toBeLessThanOrEqual(170);
		}
	});

	it('finds pages with or without a trailing slash', () => {
		expect(pageFor('/docs/')?.path).toBe('/docs');
		expect(pageFor('/')?.path).toBe('/');
		expect(pageFor('/nope')).toBeUndefined();
	});
});

describe('Markdown twins', () => {
	for (const p of PAGES) {
		it(`${p.path}: a complete document with absolute links`, () => {
			const md = twinDocument(p);
			expect(md).toMatch(/^<!-- Kofra: https:\/\/kofra\.app\S* /);
			expect(md).toMatch(/\n# \S/);
			expect(md).not.toMatch(/undefined|\[object |NaN/);
			// Every Markdown link is absolute, so the file works on its own.
			for (const [, href] of md.matchAll(/\]\(([^)]+)\)/g))
				expect(href, p.path).toMatch(/^https:\/\//);
		});
	}
});

describe('structured data', () => {
	for (const p of PAGES) {
		it(`${p.path}: valid schema.org JSON-LD`, () => {
			expect(checkJsonLd(graphFor(p))).toEqual([]);
		});
	}

	it('marks every price as an example and emits no placeholder legal facts', () => {
		const pricing = JSON.stringify(graphFor(pageFor('/pricing')!));
		expect(pricing.match(/Example price, not an offer/g)?.length).toBe(3);
		expect(pricing).not.toContain('legalName');
	});

	it('rejects typos, unknown types, dangling references and placeholders', () => {
		const ok = {
			'@context': 'https://schema.org',
			'@graph': [{ '@type': 'WebSite', name: 'K', url: 'u' }]
		};
		expect(checkJsonLd(ok)).toEqual([]);
		const bad = (node: object) =>
			checkJsonLd({ '@context': 'https://schema.org', '@graph': [node] });
		expect(bad({ '@type': 'WebSite', name: 'K', url: 'u', publsher: 'x' })).toEqual([
			'@graph[0]: WebSite has no property publsher'
		]);
		expect(bad({ '@type': 'SoftwareThing', name: 'K' })[0]).toMatch(/unknown or unsupported type/);
		expect(bad({ '@type': 'WebSite', name: 'K', url: 'u', publisher: { '@id': '#x' } })[0]).toMatch(
			/undefined node/
		);
		expect(bad({ '@type': 'Organization', name: '[COMPANY LEGAL NAME]', url: 'u' })).toContain(
			'contains a [PLACEHOLDER] marker'
		);
	});
});

describe('discovery files', () => {
	it('llms.txt links every page twin, absolutely, in the llmstxt.org shape', () => {
		const txt = llmsTxt();
		expect(txt.startsWith('# Kofra\n\n> ')).toBe(true);
		const links = [...txt.matchAll(/\]\((https:\/\/kofra\.app[^)]+)\)/g)].map((m) => m[1]);
		expect(links.sort()).toEqual(PAGES.map((p) => `${SITE.origin}${twinPath(p.path)}`).sort());
		expect(txt).toContain('Endpoint: https://s3.kofra.app');
	});

	it('llms-full.txt holds every page', () => {
		const full = llmsFullTxt();
		for (const p of PAGES)
			expect(full).toContain(`${SITE.origin}${p.path === '/' ? '/' : p.path} (Markdown`);
	});

	it('sitemap lists every canonical URL with a lastmod', () => {
		const xml = sitemapXml();
		expect(xml.match(/<url>/g)?.length).toBe(PAGES.length);
		expect(xml).toContain(
			'<loc>https://kofra.app/docs/s3-compatibility</loc><lastmod>2026-11-19</lastmod>'
		);
	});

	it('robots.txt blocks everything until launch and welcomes AI crawlers after it', () => {
		expect(robotsTxt(false)).toBe('User-agent: *\nDisallow: /\n');
		const prod = robotsTxt(true);
		expect(prod).not.toContain('Disallow');
		for (const ua of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
			expect(prod).toContain(`User-agent: ${ua}`);
		}
		expect(prod).toContain('Sitemap: https://kofra.app/sitemap.xml');
	});
});
