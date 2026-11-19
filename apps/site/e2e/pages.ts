/** Every prerendered page. A new route must be added here, so the axe and page checks cover it. */
export const PAGES = [
	'/',
	'/pricing',
	'/docs',
	'/docs/s3-compatibility',
	'/faq',
	'/security',
	'/early-access',
	'/legal/terms',
	'/legal/privacy',
	'/licences'
] as const;

/** Where the waitlist form and the confirmation redirect to. Static and noindex in every build. */
export const WAITLIST_RESULT_PAGES = [
	'/early-access/sent',
	'/early-access/try-again',
	'/early-access/confirmed',
	'/early-access/link-expired'
] as const;

export const VIEWPORTS = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'mobile', width: 390, height: 844 }
] as const;

export const THEMES = ['light', 'dark'] as const;
