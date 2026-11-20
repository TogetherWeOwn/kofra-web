/** Every console page. A new route must be added here, so the axe and page checks cover it. */
export const PAGES = [
	'/',
	'/buckets',
	'/buckets?create',
	'/buckets/backups',
	'/buckets/backups?prefix=server/db/',
	'/buckets/backups/delete',
	'/buckets/shared-docs/delete',
	'/keys',
	'/keys/new',
	'/keys/KF7Q2M8X4T7R5N0B/revoke',
	'/usage',
	'/billing',
	'/settings',
	'/settings/delete-workspace',
	'/settings/reset-demo',
	'/sign-in'
] as const;

export const VIEWPORTS = [
	{ name: 'desktop', width: 1440, height: 900 },
	{ name: 'mobile', width: 390, height: 844 }
] as const;

export const THEMES = ['light', 'dark'] as const;
