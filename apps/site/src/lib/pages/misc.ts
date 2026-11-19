// Copy for the FAQ, security, early access and licences pages.
import type { Block } from '#lib/blocks.js';

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

export const EARLY = {
	heading: 'Early access',
	description: 'Kofra is in early access and not yet open for sign-ups.',
	lead: 'Kofra is not open for sign-ups yet.'
};

export const EARLY_BLOCKS: Block[] = [
	{
		type: 'p',
		text: 'We are finishing the service and the customer console. When accounts open, this page will say so and explain how to sign up.'
	},
	{ type: 'h2', text: 'What you can do now' },
	{
		type: 'ul',
		items: [
			'Read the [quick-start guides](/docs) for aws-cli, rclone, restic and Cyberduck.',
			'See the [example pricing](/pricing) and how billing works.',
			'Read [how Kofra protects your data](/security).'
		]
	}
];

export const LICENCES = {
	heading: 'Licences',
	description: 'Open-source fonts and icons used on the Kofra website, and their licences.',
	lead: 'This website uses these open-source works. Their licences are reproduced in full below.'
};
