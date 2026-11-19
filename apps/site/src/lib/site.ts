// Site-wide facts. Pages are listed in PAGES so navigation, the sitemap, the Markdown twins and
// llms.txt are generated from one list.

export const SITE = {
	name: 'Kofra',
	/** Canonical origin. Staging and previews serve the same pages but are never indexed. */
	origin: 'https://kofra.app',
	tagline: 'S3-compatible cloud storage.'
} as const;

/** Title for <title>: the page name, then the brand. The home page uses its own. */
export const pageTitle = (name: string) => `${name} | ${SITE.name}`;
