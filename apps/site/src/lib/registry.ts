// Every page of the site, once. Navigation metadata, <head> tags, structured data, the sitemap,
// the Markdown twins and llms.txt are all generated from this list.
import {
	faqMarkdown,
	homeMarkdown,
	licencesMarkdown,
	pricingMarkdown,
	prose,
	securityMarkdown
} from '#lib/markdown.js';
import { AWS_CLI, AWS_CLI_BLOCKS } from '#lib/pages/aws-cli.js';
import { DOCS, DOCS_BLOCKS } from '#lib/pages/docs.js';
import { HOME } from '#lib/pages/home.js';
import { PRIVACY, PRIVACY_BLOCKS, TERMS, TERMS_BLOCKS } from '#lib/pages/legal.js';
import {
	EARLY,
	EARLY_BLOCKS,
	FAQ_PAGE,
	LICENCE_WORKS,
	LICENCES,
	SECURITY_PAGE
} from '#lib/pages/misc.js';
import { PRICING } from '#lib/pages/pricing.js';
import { RCLONE, RCLONE_BLOCKS } from '#lib/pages/rclone.js';
import { S3, S3_BLOCKS } from '#lib/pages/s3.js';
import { WEBDAV, WEBDAV_BLOCKS } from '#lib/pages/webdav.js';
import { SITE, pageTitle } from '#lib/site.js';

export type PageKind = 'home' | 'page' | 'docs' | 'legal';
export type LlmsSection = 'Docs' | 'Product' | 'Optional';

export interface PageEntry {
	path: string;
	/** Short name for breadcrumbs and llms.txt. */
	name: string;
	/** Full document title. */
	title: string;
	description: string;
	/** Last content change (sitemap lastmod, structured data dateModified). */
	updated: string;
	kind: PageKind;
	/** Path of the parent page in the breadcrumb trail (home is implied). */
	parent?: string;
	/** Where the page goes in llms.txt, with a one-line note. */
	llms: { section: LlmsSection; note: string };
	/** The page as a complete Markdown document. */
	markdown: () => string;
}

export const PAGES: PageEntry[] = [
	{
		path: '/',
		name: 'Home',
		title: HOME.title,
		description: HOME.description,
		updated: '2026-11-21',
		kind: 'home',
		llms: { section: 'Product', note: 'what Kofra is, features, S3 settings and a plan summary' },
		markdown: homeMarkdown
	},
	{
		path: '/pricing',
		name: 'Pricing',
		title: pageTitle(PRICING.heading),
		description: PRICING.description,
		updated: '2026-11-19',
		kind: 'page',
		llms: {
			section: 'Product',
			note: 'plans, a full comparison, a worked example bill (example prices)'
		},
		markdown: pricingMarkdown
	},
	{
		path: '/docs',
		name: 'Documentation',
		title: pageTitle(DOCS.heading),
		description: DOCS.description,
		updated: '2026-11-21',
		kind: 'docs',
		llms: {
			section: 'Docs',
			note: 'connection settings, recommended upload settings, and quick-starts for restic, Cyberduck and SDKs'
		},
		markdown: () => prose(DOCS.heading, DOCS.lead, DOCS_BLOCKS)
	},
	{
		path: '/docs/aws-cli',
		name: 'aws-cli',
		title: pageTitle(AWS_CLI.heading),
		description: AWS_CLI.description,
		updated: '2026-11-21',
		kind: 'docs',
		parent: '/docs',
		llms: {
			section: 'Docs',
			note: 'aws-cli profile with the recommended upload settings, commands, large files, errors'
		},
		markdown: () => prose(AWS_CLI.heading, AWS_CLI.lead, AWS_CLI_BLOCKS)
	},
	{
		path: '/docs/rclone',
		name: 'rclone',
		title: pageTitle(RCLONE.heading),
		description: RCLONE.description,
		updated: '2026-11-21',
		kind: 'docs',
		parent: '/docs',
		llms: {
			section: 'Docs',
			note: 'rclone remote with the recommended upload settings, copy, sync, mount, migration'
		},
		markdown: () => prose(RCLONE.heading, RCLONE.lead, RCLONE_BLOCKS)
	},
	{
		path: '/docs/webdav',
		name: 'WebDAV',
		title: pageTitle(WEBDAV.heading),
		description: WEBDAV.description,
		updated: '2026-11-21',
		kind: 'docs',
		parent: '/docs',
		llms: { section: 'Docs', note: 'WebDAV settings, clients and limits (coming soon)' },
		markdown: () => prose(WEBDAV.heading, WEBDAV.lead, WEBDAV_BLOCKS)
	},
	{
		path: '/docs/s3-compatibility',
		name: 'S3 compatibility',
		title: pageTitle(S3.heading),
		description: S3.description,
		updated: '2026-11-21',
		kind: 'docs',
		parent: '/docs',
		llms: { section: 'Docs', note: 'supported S3 operations, limits and error codes' },
		markdown: () => prose(S3.heading, S3.lead, S3_BLOCKS)
	},
	{
		path: '/faq',
		name: 'Questions and answers',
		title: pageTitle(FAQ_PAGE.heading),
		description: FAQ_PAGE.description,
		updated: '2026-11-21',
		kind: 'page',
		llms: { section: 'Product', note: 'short answers about tools, billing and data' },
		markdown: faqMarkdown
	},
	{
		path: '/security',
		name: 'Security',
		title: pageTitle(SECURITY_PAGE.heading),
		description: SECURITY_PAGE.description,
		updated: '2026-11-19',
		kind: 'page',
		llms: { section: 'Product', note: 'encryption, integrity checks and access control' },
		markdown: securityMarkdown
	},
	{
		path: '/early-access',
		name: 'Early access',
		title: pageTitle(EARLY.heading),
		description: EARLY.description,
		updated: '2026-11-21',
		kind: 'page',
		llms: { section: 'Optional', note: 'sign-up status' },
		markdown: () => prose(EARLY.heading, EARLY.lead, EARLY_BLOCKS)
	},
	{
		path: '/legal/terms',
		name: 'Terms of service (draft)',
		title: pageTitle(TERMS.heading),
		description: TERMS.description,
		updated: '2026-11-19',
		kind: 'legal',
		llms: { section: 'Optional', note: 'draft, not in force' },
		markdown: () => prose(TERMS.heading, TERMS.lead, TERMS_BLOCKS, TERMS.notice)
	},
	{
		path: '/legal/privacy',
		name: 'Privacy policy (draft)',
		title: pageTitle(PRIVACY.heading),
		description: PRIVACY.description,
		updated: '2026-11-19',
		kind: 'legal',
		llms: { section: 'Optional', note: 'draft, not in force' },
		markdown: () => prose(PRIVACY.heading, PRIVACY.lead, PRIVACY_BLOCKS, PRIVACY.notice)
	},
	{
		path: '/licences',
		name: 'Licences',
		title: pageTitle(LICENCES.heading),
		description: LICENCES.description,
		updated: '2026-11-19',
		kind: 'page',
		llms: { section: 'Optional', note: 'open-source fonts and icons used on the site' },
		markdown: () => licencesMarkdown(LICENCE_WORKS)
	}
];

const BY_PATH = new Map(PAGES.map((p) => [p.path, p]));

/** The entry for a URL path (trailing slash ignored), or undefined for unknown paths. */
export function pageFor(path: string): PageEntry | undefined {
	const p = path.length > 1 ? path.replace(/\/+$/, '') : path;
	return BY_PATH.get(p || '/');
}

/** URL path of a page's Markdown twin: "/" -> "/index.md", "/docs" -> "/docs.md". */
export const twinPath = (path: string) => (path === '/' ? '/index.md' : `${path}.md`);

/** Absolute canonical URL of a page. */
export const canonical = (path: string) => `${SITE.origin}${path === '/' ? '/' : path}`;

/** Markdown twin with a short provenance header, as served at twinPath(). */
export function twinDocument(entry: PageEntry): string {
	const body = entry.markdown();
	const note = `<!-- ${SITE.name}: ${canonical(entry.path)} (Markdown version of this page, updated ${entry.updated}) -->`;
	return `${note}\n\n${body}`;
}
