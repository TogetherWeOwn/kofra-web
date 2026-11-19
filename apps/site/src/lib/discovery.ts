// robots.txt, sitemap.xml, llms.txt and llms-full.txt, generated from the page registry.
import { ENDPOINT, REGION } from '#lib/content.js';
import { PAGES, canonical, twinDocument, twinPath, type LlmsSection } from '#lib/registry.js';
import { SITE } from '#lib/site.js';

/** Crawlers for AI products that honour robots.txt. All are allowed on the production site. */
export const AI_CRAWLERS = [
	'GPTBot',
	'OAI-SearchBot',
	'ChatGPT-User',
	'ClaudeBot',
	'Claude-SearchBot',
	'Claude-User',
	'PerplexityBot',
	'Perplexity-User',
	'Google-Extended',
	'Applebot-Extended',
	'Amazonbot',
	'meta-externalagent',
	'CCBot'
];

export function robotsTxt(indexable: boolean): string {
	if (!indexable) {
		// Staging and previews: nothing may be crawled (pages also carry noindex).
		return 'User-agent: *\nDisallow: /\n';
	}
	return [
		'User-agent: *',
		'Allow: /',
		'',
		'# AI crawlers that honour robots.txt are welcome. Markdown versions of every page are',
		'# linked from each page and listed in /llms.txt.',
		...AI_CRAWLERS.map((ua) => `User-agent: ${ua}`),
		'Allow: /',
		'',
		`Sitemap: ${SITE.origin}/sitemap.xml`,
		''
	].join('\n');
}

const xml = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(): string {
	const urls = PAGES.map(
		(p) => `  <url><loc>${xml(canonical(p.path))}</loc><lastmod>${p.updated}</lastmod></url>`
	);
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

const SECTIONS: LlmsSection[] = ['Docs', 'Product', 'Optional'];

/** llms.txt in the llmstxt.org format: title, summary, details, then sections of links. */
export function llmsTxt(): string {
	const sections = SECTIONS.map((section) => {
		const links = PAGES.filter((p) => p.llms.section === section).map(
			(p) => `- [${p.name}](${SITE.origin}${twinPath(p.path)}): ${p.llms.note}`
		);
		return `## ${section}\n\n${links.join('\n')}`;
	});
	return (
		[
			`# ${SITE.name}`,
			`> ${SITE.name} is S3-compatible cloud object storage for backups, media and archives, billed per TB stored with downloads and API requests included. It is in early access: not yet open for sign-ups, and the prices shown are examples.`,
			[
				'Connection facts for any S3 tool or SDK:',
				'',
				`- Endpoint: ${ENDPOINT} (HTTPS only)`,
				`- Region: ${REGION}`,
				'- Addressing: path-style only (virtual-hosted style is refused)',
				'- Signing: AWS Signature Version 4',
				'- One request body: up to 95 MiB; use multipart uploads (up to 10,000 parts) above that',
				'- rclone needs upload_cutoff=95M; aws-cli and restic work with their defaults',
				'- Buckets are created in the Kofra console, not through the S3 API',
				'',
				`Every page is also available as Markdown: add .md to its path (the home page is /index.md), or request it with \`Accept: text/markdown\`. The full text of all pages is at ${SITE.origin}/llms-full.txt.`
			].join('\n'),
			...sections
		].join('\n\n') + '\n'
	);
}

/** Every Markdown twin, concatenated, for tools that read one file. */
export function llmsFullTxt(): string {
	return PAGES.map((p) => twinDocument(p).trim()).join('\n\n---\n\n') + '\n';
}

export const text = (body: string, type: string) =>
	new Response(body, { headers: { 'content-type': `${type}; charset=utf-8` } });
