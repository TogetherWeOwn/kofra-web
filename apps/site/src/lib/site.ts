// Site-wide facts and the indexing switch.

export const SITE = {
	name: 'Kofra',
	/** Canonical origin. Staging and previews serve the same pages but are never indexed. */
	origin: 'https://kofra.app',
	tagline: 'S3-compatible cloud storage.',
	/** Social preview image (1200×630) and square logo, both in static/. */
	ogImage: '/og.png',
	logo: '/logo.png'
} as const;

/**
 * Whether search engines may index the site. Off for every build unless the build runs with
 * KOFRA_INDEXABLE=true (production launch, an owner decision). It switches, together:
 * the robots meta tag, the X-Robots-Tag header, robots.txt and the sitemap reference.
 */
export const INDEXABLE: boolean = __KOFRA_INDEXABLE__;

/**
 * Legal facts for structured data. Left undefined until the owner supplies them; undefined
 * fields are omitted, never filled with placeholders.
 */
export const ORGANISATION_FACTS: { legalName?: string; email?: string; address?: string } = {};

/** Title for <title>: the page name, then the brand. */
export const pageTitle = (name: string) => `${name} | ${SITE.name}`;

/**
 * Prices on the site are examples until the owner sets real ones. While false, no price is
 * published as structured data (no schema.org Product or Offer), only as labelled page text.
 */
export const PRICES_FINAL = false;

/** Whether the early-access form is shown (build time; the endpoints check again at run time). */
export const WAITLIST: boolean = __KOFRA_WAITLIST__;
export const TURNSTILE_SITE_KEY: string = __KOFRA_TURNSTILE_SITE_KEY__;
