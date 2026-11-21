// Copy for the home page. The page template and its Markdown twin both read from here.
import { ENDPOINT, PROFILE, REGION } from '#lib/content.js';
import { PRICES_FINAL, SIGNUP_OPEN } from '#lib/site.js';

export const HOME = {
	title: 'Kofra: S3-compatible cloud storage',
	description:
		'S3-compatible cloud object storage for backups, media and archives. One price per TB, with downloads and API requests included. Works with aws-cli, rclone and restic.',
	hero: {
		eyebrow: 'Kofra Object Storage',
		heading: 'S3-compatible cloud storage for backups, media and archives',
		lead: 'Keep any amount of data in buckets you reach with aws-cli, rclone, restic or any S3 SDK. One price per TB, with downloads and API requests included.',
		proof: ['$6 per TB a month', 'No fees for API requests', '25 GB free, no card needed'],
		fine: [!PRICES_FINAL && 'Example prices.', !SIGNUP_OPEN && 'Kofra is in early access.']
			.filter(Boolean)
			.join(' ')
	},
	features: {
		heading: 'Everything you need from object storage',
		lead: 'The features you expect from an S3 provider, with a bill you can predict.'
	},
	s3: {
		heading: 'Use the S3 API you already know',
		lead: 'Kofra implements the S3 API for buckets, objects, multipart uploads and presigned URLs. Point your tool at the Kofra endpoint and use a Kofra access key.',
		facts: [
			['Endpoint', ENDPOINT],
			['Region', REGION],
			['Addressing', 'Path-style'],
			['Largest file', `${PROFILE.maxObjectGiB} GiB, in parts of ${PROFILE.partMiB} MiB`]
		] as [string, string][],
		more: 'Read the quick-start guides'
	},
	pricing: {
		heading: 'Simple, predictable pricing',
		lead: 'Pay per TB stored.',
		more: 'Compare plans in detail'
	},
	security: {
		heading: 'Security and data integrity',
		lead: 'How Kofra protects and checks your data.'
	},
	faq: {
		heading: 'Frequently asked questions',
		more: 'All questions'
	},
	cta: SIGNUP_OPEN
		? {
				heading: 'Start with 25 GB free',
				lead: 'Create an account, make a bucket and connect your tools in a few minutes. No card needed.'
			}
		: {
				heading: 'Kofra is in early access',
				lead: 'Accounts are not open yet. Read the docs now, and check back for sign-ups.'
			}
};
