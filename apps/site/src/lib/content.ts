// Site copy and data. Every price here is an EXAMPLE and is labelled as one wherever it is shown,
// until real prices are set. Customer-facing vocabulary only: storage, bucket, file, download allowance.
import type { CompareRow, FaqItem, Feature, FooterColumn, NavItem, Plan, Tool } from '@kofra/ui';
import Archive from '@lucide/svelte/icons/archive';
import Code from '@lucide/svelte/icons/code';
import DatabaseBackup from '@lucide/svelte/icons/database-backup';
import FileCheck from '@lucide/svelte/icons/file-check';
import FolderOpen from '@lucide/svelte/icons/folder-open';
import HardDrive from '@lucide/svelte/icons/hard-drive';
import History from '@lucide/svelte/icons/history';
import KeyRound from '@lucide/svelte/icons/key-round';
import Lock from '@lucide/svelte/icons/lock';
import Plug from '@lucide/svelte/icons/plug';
import ReceiptText from '@lucide/svelte/icons/receipt-text';
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import Smartphone from '@lucide/svelte/icons/smartphone';
import Terminal from '@lucide/svelte/icons/terminal';
import { SIGN_IN_URL, SIGN_UP_URL, SIGNUP_OPEN, STATUS_LIVE, STATUS_URL } from '#lib/site.js';

/** The S3 endpoint every example uses. */
export const ENDPOINT = 'https://s3.kofra.io';
export const ENDPOINT_HOST = 's3.kofra.io';
export const REGION = 'auto';

/** The WebDAV address. */
export const WEBDAV_URL = 'https://dav.kofra.io';
export const WEBDAV_HOST = 'dav.kofra.io';

/**
 * Measured client settings: parts of 16 MiB from 16 MiB, about 16 requests at once, and one
 * connection per request for rclone. The guides, the home page and the limits all use these.
 */
export const PROFILE = {
	partMiB: 16,
	concurrency: 16,
	/** Largest single upload request (PutObject or UploadPart). */
	maxRequestMiB: 99,
	/** Largest object, with parts of 16 MiB. */
	maxObjectGiB: 156,
	/** Largest object when parts are larger than 16 MiB. */
	maxObjectLargePartsGiB: 78,
	/** Largest object with 5 MiB parts. */
	maxObjectSmallPartsGiB: 48,
	/** Largest file a WebDAV client can upload (one request per file). */
	webdavMaxUploadMiB: 99
} as const;

export const EARLY_ACCESS = '/early-access';

/** The main call to action: create an account once sign-ups open, early access until then. */
export const PRIMARY_CTA: NavItem = SIGNUP_OPEN
	? { label: 'Create account', href: SIGN_UP_URL }
	: { label: 'Get early access', href: EARLY_ACCESS };

/** Shown next to every price until the owner sets real prices. */
export const EXAMPLE_NOTE = SIGNUP_OPEN
	? 'Example prices and plans. They are not an offer and may change.'
	: 'Example prices and plans. They are not an offer and may change before Kofra opens for sign-ups.';

export const NAV: NavItem[] = [
	{ label: 'Product', href: '/' },
	{ label: 'Pricing', href: '/pricing' },
	{ label: 'Docs', href: '/docs' },
	{ label: 'Security', href: '/security' }
];

export const FOOTER: FooterColumn[] = [
	{
		heading: 'Product',
		links: [
			{ label: 'Overview', href: '/' },
			{ label: 'Pricing', href: '/pricing' },
			{ label: 'Security', href: '/security' }
		]
	},
	{
		heading: 'Developers',
		links: [
			{ label: 'Documentation', href: '/docs' },
			{ label: 'aws-cli guide', href: '/docs/aws-cli' },
			{ label: 'rclone guide', href: '/docs/rclone' },
			{ label: 'WebDAV guide', href: '/docs/webdav' },
			{ label: 'S3 compatibility', href: '/docs/s3-compatibility' }
		]
	},
	{
		heading: 'Account',
		links: [
			{ label: 'Sign in', href: SIGN_IN_URL },
			SIGNUP_OPEN
				? { label: 'Create account', href: SIGN_UP_URL }
				: { label: 'Early access', href: EARLY_ACCESS },
			{ label: 'Questions and answers', href: '/faq' },
			...(STATUS_LIVE ? [{ label: 'Service status', href: STATUS_URL }] : [])
		]
	},
	{
		heading: 'Legal',
		links: [
			{ label: 'Terms of service', href: '/legal/terms' },
			{ label: 'Privacy policy', href: '/legal/privacy' },
			{ label: 'Licences', href: '/licences' }
		]
	}
];

/* ---------------- Prices (examples) ---------------- */

export const PRICE = { perTB: 6, teamPerTB: 9, extraPerGB: 0.01, downloadMultiple: 3 };

const cta = PRIMARY_CTA;

export const PLANS: Plan[] = [
	{
		id: 'free',
		name: 'Free',
		price: '$0',
		unit: 'up to 25 GB',
		blurb: 'Try Kofra with real files. No card needed.',
		cta,
		features: [
			'25 GB of storage',
			'75 GB of downloads a month',
			'One member',
			'30-day trash and versions (planned for launch)',
			'Community support'
		]
	},
	{
		id: 'storage',
		name: 'Storage',
		price: '$6',
		unit: 'per TB a month',
		blurb: 'Pay for what you store, billed monthly.',
		cta,
		featured: true,
		features: [
			'Billed per TB stored, averaged over the month',
			'Downloads free up to 3× what you store',
			'No fees for API requests',
			'No minimum storage duration',
			'Email support'
		]
	},
	{
		id: 'team',
		name: 'Team',
		price: '$9',
		unit: 'per TB a month',
		blurb: 'For businesses with several people and roles.',
		cta,
		features: [
			'Everything in Storage',
			'Members with roles and permissions',
			'Two-factor sign-in required for everyone (planned for launch)',
			'Audit log and data export (planned for launch)',
			'90-day trash and versions (planned for launch)',
			'Priority support'
		]
	}
];

export const COMPARE: CompareRow[] = [
	{
		label: 'Storage price',
		values: ['Included up to 25 GB', '$6 per TB a month', '$9 per TB a month']
	},
	{
		label: 'Downloads (egress)',
		values: ['75 GB a month', 'Free up to 3× stored', 'Free up to 3× stored']
	},
	{
		label: 'Downloads beyond the allowance',
		values: ['Not available', '$0.01 per GB', '$0.01 per GB']
	},
	{ label: 'API requests', values: ['No charge', 'No charge', 'No charge'] },
	{ label: 'Minimum storage duration', values: ['None', 'None', 'None'] },
	{ label: 'Smallest monthly bill', values: ['$0', '$1', '$9 (1 TB)'] },
	{ label: 'Trash and versions (planned for launch)', values: ['30 days', '30 days', '90 days'] },
	{ label: 'Members', values: ['1', '1', 'Unlimited'] },
	{ label: 'Scoped access keys (planned for launch)', values: [true, true, true] },
	{
		label: 'Two-factor sign-in (planned for launch)',
		values: ['Optional', 'Optional', 'Required for all members']
	},
	{ label: 'Audit log (planned for launch)', values: [false, false, true] },
	{
		label: 'Support',
		values: ['Community', 'Email, next business day', 'Email, same business day']
	}
];

/** Plan summary on the home page: [plan, storage, downloads, API requests, smallest bill]. */
export const PLAN_SUMMARY: CompareRow[] = [
	{ label: 'Free', values: ['25 GB included', '75 GB a month', 'No charge', '$0'] },
	{
		label: 'Storage',
		values: ['$6 per TB a month', 'Free up to 3× stored', 'No charge', '$1 a month']
	},
	{
		label: 'Team',
		values: ['$9 per TB a month', 'Free up to 3× stored', 'No charge', '$9 a month (1 TB)']
	}
];

export interface BillLine {
	item: string;
	usage: string;
	amount: number;
}

/** Worked example bill. Totals are computed, never typed. */
export const EXAMPLE_BILL = (() => {
	const storedTB = 2.4;
	const downloadsGB = 310;
	const storage = Math.round(storedTB * PRICE.perTB * 100) / 100;
	const allowanceGB = storedTB * PRICE.downloadMultiple * 1000;
	const extra = Math.round(Math.max(0, downloadsGB - allowanceGB) * PRICE.extraPerGB * 100) / 100;
	const lines: BillLine[] = [
		{ item: 'Storage', usage: `${storedTB.toFixed(2)} TB average × $6.00 per TB`, amount: storage },
		{
			item: 'Downloads',
			usage: `${downloadsGB} GB used of ${(allowanceGB / 1000).toFixed(1)} TB included`,
			amount: extra
		},
		{ item: 'API requests', usage: '1.9 million requests', amount: 0 }
	];
	return {
		title: 'Example: a 2.4 TB backup archive on Storage',
		lines,
		total: Math.round(lines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100
	};
})();

export const money = (n: number) => `$${n.toFixed(2)}`;

/* ---------------- Features, security, tools ---------------- */

export const FEATURES: Feature[] = [
	{
		icon: Plug,
		title: 'Works with S3 tools',
		body: 'Any tool or SDK that speaks the S3 API can use Kofra. Change the endpoint, keep your scripts.'
	},
	{
		icon: ReceiptText,
		title: 'One price per TB',
		body: 'Storage is billed per TB a month. Downloads up to 3× what you store and all API requests are included.'
	},
	{
		icon: ShieldCheck,
		title: 'Checked on upload',
		body: 'Kofra verifies the checksum of every upload and rejects a file that arrived damaged.'
	},
	{
		icon: History,
		title: 'Trash and versions',
		body: 'Planned for launch: restore a deleted or overwritten file for 30 days, or 90 days on Team.'
	},
	{
		icon: KeyRound,
		title: 'Scoped access keys',
		body: 'Planned for launch: keys that can only read, only write, or only reach one bucket.'
	},
	{
		icon: HardDrive,
		title: 'Mount as a drive',
		body: 'Coming soon: connect over WebDAV from macOS, Windows or Linux and use your own file manager.'
	}
];

export const SECURITY: Feature[] = [
	{
		icon: Lock,
		title: 'Encrypted at rest and in transit',
		body: 'Objects are encrypted at rest, and every connection to Kofra uses HTTPS.'
	},
	{
		icon: FileCheck,
		title: 'Integrity checks',
		body: 'Checksums are verified on upload. Planned for launch: stored data is re-checked on a regular schedule.'
	},
	{
		icon: KeyRound,
		title: 'Least-privilege keys',
		body: 'Planned for launch: keys limited to one bucket, read-only or write-only, and revoked at any time.'
	},
	{
		icon: Smartphone,
		title: 'Two-factor sign-in',
		body: 'Planned for launch: authenticator apps and passkeys, required for every member on Team.'
	},
	{
		icon: ScrollText,
		title: 'Audit log',
		body: 'Planned for launch: Team accounts record sign-ins, key changes and deletions, with export.'
	},
	{
		icon: DatabaseBackup,
		title: 'Your data stays portable',
		body: 'The same S3 tools copy data out as easily as in, and downloads within your allowance are free.'
	}
];

export const TOOLS: Tool[] = [
	{ name: 'aws-cli', icon: Terminal },
	{ name: 'rclone', icon: RefreshCw },
	{ name: 'restic', icon: Archive },
	{ name: 'Cyberduck', icon: FolderOpen },
	{ name: 'WebDAV', icon: HardDrive, note: 'coming soon' },
	{ name: 'Any S3 SDK', icon: Code }
];

/** Quick-start examples on the home page; the full steps are on /docs. */
export const TOOL_EXAMPLES: {
	id: string;
	name: string;
	kind: string;
	blurb: string;
	code: string;
}[] = [
	{
		id: 'aws-cli',
		name: 'aws-cli',
		kind: 'Command line',
		blurb: 'The AWS command line, pointed at the Kofra endpoint.',
		code: `aws configure --profile kofra   # region: ${REGION}\naws configure set s3.addressing_style path --profile kofra\naws configure set s3.multipart_threshold 16MB --profile kofra\naws configure set s3.multipart_chunksize 16MB --profile kofra\naws configure set s3.max_concurrent_requests 16 --profile kofra\naws configure set s3.preferred_transfer_client classic --profile kofra\naws s3 sync ./photos s3://my-bucket/photos/ \\\n  --profile kofra --endpoint-url ${ENDPOINT}`
	},
	{
		id: 'rclone',
		name: 'rclone',
		kind: 'Sync and mount',
		blurb: 'Copy, sync and mount. Also moves files from other clouds.',
		code: `rclone config create kofra s3 provider=Other env_auth=true \\\n  endpoint=${ENDPOINT} region=${REGION} force_path_style=true \\\n  upload_cutoff=16M chunk_size=16M upload_concurrency=1 \\\n  disable_http2=true no_check_bucket=true\nrclone copy ./projects kofra:my-bucket/projects --transfers 16`
	},
	{
		id: 'restic',
		name: 'restic',
		kind: 'Backup',
		blurb: 'Encrypted, deduplicated backups of laptops and servers.',
		code: `export AWS_DEFAULT_REGION=${REGION}\nrestic -r s3:${ENDPOINT}/my-backups init\nrestic -r s3:${ENDPOINT}/my-backups backup ~/`
	},
	{
		id: 'cyberduck',
		name: 'Cyberduck',
		kind: 'Desktop app',
		blurb: 'A file browser for macOS and Windows, using path-style S3 requests.',
		code: `Connection type:   S3 (Deprecated path style requests)\nServer:            ${ENDPOINT_HOST}\nAccess Key ID:     your key ID\nSecret Access Key: your secret key`
	}
];

/* ---------------- Questions ---------------- */

export const FAQ_GENERAL: FaqItem[] = [
	{
		q: 'What is Kofra?',
		a: 'Kofra is cloud object storage with an S3-compatible API. You keep files in buckets and reach them with tools such as aws-cli, rclone and restic, or with any S3 SDK.'
	},
	SIGNUP_OPEN
		? {
				q: 'How do I sign up?',
				a: 'Create an account in the Kofra console. The Free plan needs no card. Then create a bucket and an access key, and follow the guide for your tool.'
			}
		: {
				q: 'Can I sign up now?',
				a: 'Not yet. Kofra is in early access and is not open for sign-ups. The early access page will say when accounts open.'
			},
	{
		q: 'Which tools and SDKs work with Kofra?',
		a: `Any client that supports S3 with a custom endpoint, including aws-cli, the AWS SDKs, rclone, restic, Cyberduck and most backup software. Set the endpoint to ${ENDPOINT_HOST}, the region to ${REGION}, use path-style requests and a Kofra access key.`
	},
	{
		q: 'Can I mount Kofra as a drive?',
		a: `WebDAV access, for mounting Kofra in Finder, File Explorer or a Linux file manager, is coming soon. WebDAV uploads files of up to ${PROFILE.webdavMaxUploadMiB} MiB. For larger files, and until WebDAV opens, rclone can mount a bucket as a drive.`
	},
	{
		q: 'How large can one file be?',
		a: `Up to ${PROFILE.maxObjectGiB} GiB, uploaded in parts of ${PROFILE.partMiB} MiB. A single upload request can carry up to ${PROFILE.maxRequestMiB} MiB, so larger files go in parts; aws-cli and rclone do this for you with the settings in the guides.`
	}
];

export const FAQ_PRICING: FaqItem[] = [
	{
		q: 'How is storage billed?',
		a: 'Kofra records how much you store each day and bills the monthly average at your plan’s price per TB. At the example price of $6 per TB, 2.4 TB comes to $14.40 for the month.'
	},
	{
		q: 'Do downloads or API requests cost extra?',
		a: 'API requests are not charged. Downloads are free up to three times the data you store each month; beyond that they cost $0.01 per GB (example price).'
	},
	{
		q: 'Is there a minimum storage duration?',
		a: 'No. Delete a file whenever you like and you stop paying for it.'
	}
];

export const FAQ_DATA: FaqItem[] = [
	{
		q: 'How is my data protected?',
		a: 'Objects are encrypted at rest, connections use HTTPS, and every upload is checked against its checksum. A trash that keeps deleted files for 30 days (90 days on Team) is planned for launch.'
	},
	{
		q: 'Can I move my data out again?',
		a: 'Yes. The same S3 tools copy data out as easily as in, and downloads within your allowance are free.'
	}
];

/** The short list on the home page; /faq has all of them. */
export const FAQ_HOME: FaqItem[] = [
	FAQ_GENERAL[0]!,
	FAQ_GENERAL[2]!,
	FAQ_PRICING[0]!,
	FAQ_PRICING[1]!,
	FAQ_DATA[0]!
];
