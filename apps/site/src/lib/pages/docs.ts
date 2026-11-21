// Docs landing: connection settings, the recommended client settings, the guides, and short
// quick-starts for the tools without a page of their own. Rendered to HTML by Blocks.svelte and
// to Markdown by toMarkdown, from these blocks only.
import type { Block } from '#lib/blocks.js';
import { ENDPOINT, ENDPOINT_HOST, PROFILE, REGION } from '#lib/content.js';
import { CONSOLE_ORIGIN, SIGNUP_OPEN } from '#lib/site.js';

export const DOCS = {
	heading: 'Documentation',
	description: `Connect to Kofra with aws-cli, rclone, restic, Cyberduck, WebDAV or any S3 SDK. Endpoint ${ENDPOINT}, region ${REGION}, path-style requests.`,
	lead: 'Kofra speaks the S3 API. Point any S3 tool at the Kofra endpoint, use path-style requests and sign in with a Kofra access key.'
};

/** Shell lines that set the key for one terminal session, without writing it to a config file. */
export const KEY_ENV = `export AWS_ACCESS_KEY_ID="your-key-id"\nexport AWS_SECRET_ACCESS_KEY="your-secret-key"`;

/** The early access note on guides, while accounts are closed. */
export const EARLY_NOTE: Block[] = SIGNUP_OPEN
	? []
	: [
			{
				type: 'note',
				tone: 'info',
				title: 'Early access.',
				text: 'Kofra is not open for sign-ups yet. These guides show how the tools connect; you need a Kofra access key to run them.'
			}
		];

export const DOCS_BLOCKS: Block[] = [
	...EARLY_NOTE,
	{ type: 'h2', text: 'Before you start', id: 'start' },
	{
		type: 'ol',
		items: [
			`Sign in to the [Kofra console](${CONSOLE_ORIGIN}).`,
			'Create a bucket. The examples use a bucket named `my-bucket` (and `my-backups` for restic).',
			'Create an access key under **Access keys**. Copy the secret key when it is shown: it is shown only once.'
		]
	},

	{ type: 'h2', text: 'Connection settings', id: 'settings' },
	{
		type: 'p',
		text: 'Every S3 tool needs the same four settings. They are the same for every bucket and every plan.'
	},
	{
		type: 'dl',
		items: [
			['Endpoint', `\`${ENDPOINT}\``],
			['Region', `\`${REGION}\``],
			[
				'Addressing',
				`Path-style (\`${ENDPOINT}/my-bucket/key\`). Virtual-hosted style is not supported.`
			],
			[
				'Credentials',
				'A Kofra access key ID and secret key. The secret is shown once, when you create the key.'
			]
		]
	},
	{
		type: 'p',
		text: 'Keep the secret key out of scripts you share: the guides ask for it at a prompt or read it from environment variables.'
	},

	{ type: 'h2', text: 'Recommended upload settings', id: 'recommended' },
	{
		type: 'p',
		text: `These settings were measured with aws-cli and rclone against Kofra. They give the fastest uploads and the largest files.`
	},
	{
		type: 'ul',
		items: [
			`**Parts of ${PROFILE.partMiB} MiB, from ${PROFILE.partMiB} MiB.** Files of ${PROFILE.partMiB} MiB and more go up as a multipart upload in ${PROFILE.partMiB} MiB parts. This also allows the largest objects: ${PROFILE.maxObjectGiB} GiB.`,
			`**About ${PROFILE.concurrency} requests at once.** Uploads through Kofra gain a lot from parallel requests: in our tests, 16 at once was 1.3 to 3.6 times as fast as 4 at once, most for many small files.`,
			'**One connection per request (rclone).** By default rclone sends every request over one HTTP/2 connection, which limits its speed. Turn HTTP/2 off for the Kofra remote.'
		]
	},
	{
		type: 'p',
		text: 'The [aws-cli guide](/docs/aws-cli) and the [rclone guide](/docs/rclone) set all of these. Other tools: use the closest equivalents.'
	},

	{ type: 'h2', text: 'Guides', id: 'guides' },
	{
		type: 'ul',
		items: [
			'[aws-cli](/docs/aws-cli): the AWS command line, with a Kofra profile.',
			'[rclone](/docs/rclone): copy, sync and mount, and move data from other clouds.',
			'[WebDAV](/docs/webdav): connect Kofra as a network drive (coming soon).',
			'[S3 compatibility](/docs/s3-compatibility): supported operations, limits and error codes.'
		]
	},

	{ type: 'h2', text: 'restic', id: 'restic' },
	{
		type: 'p',
		text: 'restic makes encrypted, deduplicated backups. It encrypts on your computer before upload, so keep the repository password safe: Kofra cannot recover it.'
	},
	{
		type: 'code',
		title: 'Create a repository and back up',
		lang: 'sh',
		code: `${KEY_ENV}\nexport AWS_DEFAULT_REGION=${REGION}\nexport RESTIC_REPOSITORY=s3:${ENDPOINT}/my-backups\nrestic init\nrestic backup ~/Documents\nrestic snapshots`
	},
	{
		type: 'code',
		title: 'Restore',
		lang: 'sh',
		code: `restic restore latest --target ~/restore`
	},
	{
		type: 'p',
		text: '`restic init` asks for a new repository password, and every later command asks for it again (or reads `RESTIC_PASSWORD_FILE`). restic works with its default settings.'
	},

	{ type: 'h2', text: 'Cyberduck', id: 'cyberduck' },
	{
		type: 'p',
		text: 'Cyberduck is a file browser for macOS and Windows. Kofra needs its path-style S3 connection profile.'
	},
	{
		type: 'ol',
		items: [
			'Open **Preferences**, then **Profiles**, search for “path style” and tick **S3 (Deprecated path style requests)**.',
			'Choose **Open Connection** and select that profile as the connection type.',
			`Server: \`${ENDPOINT_HOST}\`, port \`443\`.`,
			'Access Key ID: your Kofra key ID. Secret Access Key: your Kofra secret key.',
			'Choose **Connect**. Your buckets appear as folders.'
		]
	},

	{ type: 'h2', text: 'Any S3 SDK', id: 'sdks' },
	{
		type: 'p',
		text: `The AWS SDKs and other S3 libraries work when you set three options: the endpoint \`${ENDPOINT}\`, the region \`${REGION}\`, and path-style addressing (often called \`forcePathStyle\`, \`force_path_style\` or \`addressing_style: path\`). For large files, use the SDK's multipart upload helper with ${PROFILE.partMiB} MiB parts.`
	},
	{
		type: 'code',
		title: 'Python (boto3)',
		lang: 'python',
		code: `import boto3\nfrom boto3.s3.transfer import TransferConfig\nfrom botocore.config import Config\n\ns3 = boto3.client(\n    "s3",\n    endpoint_url="${ENDPOINT}",\n    region_name="${REGION}",\n    config=Config(s3={"addressing_style": "path"}),\n)  # reads AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY\nprint(s3.list_buckets()["Buckets"])\n\nMiB = 1024 * 1024\nparts = TransferConfig(multipart_threshold=16 * MiB, multipart_chunksize=16 * MiB, max_concurrency=16)\ns3.upload_file("video.mp4", "my-bucket", "videos/video.mp4", Config=parts)`
	},
	{
		type: 'code',
		title: 'JavaScript (AWS SDK v3)',
		lang: 'js',
		code: `import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";\n\nconst s3 = new S3Client({\n  endpoint: "${ENDPOINT}",\n  region: "${REGION}",\n  forcePathStyle: true,\n}); // reads AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY\nconsole.log((await s3.send(new ListBucketsCommand({}))).Buckets);`
	}
];
