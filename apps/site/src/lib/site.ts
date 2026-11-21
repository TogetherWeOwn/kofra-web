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

/* ---------------- Launch switches and other Kofra hosts ---------------- */

/**
 * Whether accounts are open. Off unless the build runs with KOFRA_SIGNUP_OPEN=true (an owner
 * decision at launch). It switches, together: the main call to action (early access or create
 * an account), the plan buttons, the early access page and the related answers.
 */
export const SIGNUP_OPEN: boolean = __KOFRA_SIGNUP_OPEN__;

/**
 * Whether the public status page is live. Off unless the build runs with KOFRA_STATUS_LIVE=true.
 * While off, no page links to it, so the site never points at a page that does not answer.
 */
export const STATUS_LIVE: boolean = __KOFRA_STATUS_LIVE__;

/** The customer console. Sign-in is always linked: existing customers need it before launch too. */
export const CONSOLE_ORIGIN = 'https://console.kofra.app';
export const SIGN_IN_URL = `${CONSOLE_ORIGIN}/sign-in`;
export const SIGN_UP_URL = `${CONSOLE_ORIGIN}/sign-up`;

/** The public status page (served by a separate service). */
export const STATUS_URL = 'https://status.kofra.app';

/** The launch status for llms.txt, or '' once accounts are open and prices final. */
export const LLMS_STATUS = SIGNUP_OPEN
	? PRICES_FINAL
		? ''
		: 'The prices shown are examples.'
	: PRICES_FINAL
		? 'It is in early access: not yet open for sign-ups.'
		: 'It is in early access: not yet open for sign-ups, and the prices shown are examples.';

/** The footer's one-line status: early access and example prices, until each is switched off. */
export const STATUS_NOTE = [
	!SIGNUP_OPEN && 'Kofra is in early access.',
	!PRICES_FINAL && 'Prices shown are examples.'
]
	.filter(Boolean)
	.join(' ');
