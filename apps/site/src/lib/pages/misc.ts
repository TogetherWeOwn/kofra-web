// Copy for the FAQ, security, early access and licences pages.
import type { Block } from '#lib/blocks.js';
import plexSans from '#lib/licences/ibm-plex-sans.txt?raw';
import plexMono from '#lib/licences/ibm-plex-mono.txt?raw';
import lucide from '#lib/licences/lucide.txt?raw';
import { PRICES_FINAL, SIGN_IN_URL, SIGN_UP_URL, SIGNUP_OPEN } from '#lib/site.js';

export const FAQ_PAGE = {
	heading: 'Questions and answers',
	description:
		'Answers about Kofra cloud storage: S3 compatibility, supported tools, pricing, downloads, minimum storage duration and data protection.',
	lead: 'Short answers about Kofra. For setup steps, see the documentation.'
};

export const SECURITY_PAGE = {
	heading: 'Security',
	description:
		'How Kofra protects stored data: encryption at rest, HTTPS and checksums on upload. Scoped access keys, two-factor sign-in and audit logs are planned for launch.',
	lead: 'How Kofra protects and checks your data, and how access to it is controlled.',
	protectionsHeading: 'Protections'
};

export const SECURITY_BLOCKS: Block[] = [
	{ type: 'h2', text: 'Reporting a security issue', id: 'report' },
	{
		type: 'p',
		text: 'A security contact and a vulnerability disclosure policy will be published on this page before Kofra opens for sign-ups.'
	}
];

export const EARLY = SIGNUP_OPEN
	? {
			heading: 'Early access',
			description: 'Kofra is open for sign-ups. Create an account in the Kofra console.',
			lead: 'Kofra is open for sign-ups.'
		}
	: {
			heading: 'Early access',
			description: 'Kofra is in early access and not yet open for sign-ups.',
			lead: 'Kofra is not open for sign-ups yet.'
		};

export const EARLY_BLOCKS: Block[] = [
	SIGNUP_OPEN
		? {
				type: 'p',
				text: `[Create an account](${SIGN_UP_URL}) in the Kofra console. The Free plan needs no card. If you already have an account, [sign in](${SIGN_IN_URL}).`
			}
		: {
				type: 'p',
				text: `We are finishing the service and the customer console. When accounts open, this page will say so and explain how to sign up. If you already have an account, [sign in](${SIGN_IN_URL}).`
			},
	{ type: 'h2', text: SIGNUP_OPEN ? 'Get started' : 'What you can do now' },
	{
		type: 'ul',
		items: [
			'Read the [quick-start guides](/docs) for aws-cli, rclone, restic and Cyberduck.',
			`See the [${PRICES_FINAL ? 'pricing' : 'example pricing'}](/pricing) and how billing works.`,
			'Read [how Kofra protects your data](/security).'
		]
	}
];

export const LICENCES = {
	heading: 'Licences',
	description: 'Open-source fonts and icons used on the Kofra website, and their licences.',
	lead: 'This website uses these open-source works. Their licences are reproduced in full below.'
};

/** Open-source works used on the site, with their full licence texts (src/lib/licences/). */
export const LICENCE_WORKS = [
	{
		id: 'plex-sans',
		name: 'IBM Plex Sans',
		use: 'Text typeface',
		licence: 'SIL Open Font License 1.1',
		text: plexSans
	},
	{
		id: 'plex-mono',
		name: 'IBM Plex Mono',
		use: 'Code typeface',
		licence: 'SIL Open Font License 1.1',
		text: plexMono
	},
	{ id: 'lucide', name: 'Lucide', use: 'Icons', licence: 'ISC License', text: lucide }
];
