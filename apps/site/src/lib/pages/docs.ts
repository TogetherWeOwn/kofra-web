// Docs landing: connection settings and one quick-start per tool. Rendered to HTML by
// Blocks.svelte and to Markdown by toMarkdown, from these blocks only.
import type { Block } from '#lib/blocks.js';
import { ENDPOINT, ENDPOINT_HOST, REGION } from '#lib/content.js';

export const DOCS = {
	heading: 'Documentation',
	description: `Connect to Kofra with aws-cli, rclone, restic or Cyberduck. Endpoint ${ENDPOINT}, region ${REGION}, path-style requests.`,
	lead: 'Kofra speaks the S3 API. Point any S3 tool at the Kofra endpoint, use path-style requests and sign in with a Kofra access key.'
};

/** Shell lines that set the key for one terminal session, without writing it to a config file. */
const KEY_ENV = `export AWS_ACCESS_KEY_ID="your-key-id"\nexport AWS_SECRET_ACCESS_KEY="your-secret-key"`;

export const DOCS_BLOCKS: Block[] = [
	{
		type: 'note',
		tone: 'info',
		title: 'Early access.',
		text: 'Kofra is not open for sign-ups yet. These guides show how the tools connect; you need a Kofra access key to run them.'
	},
	{ type: 'h2', text: 'Connection settings', id: 'settings' },
	{
		type: 'p',
		text: 'Every tool needs the same four settings. They are the same for every bucket and every plan. Buckets are created in the Kofra console; the examples use a bucket named `my-bucket` (and `my-backups` for restic).'
	},
	{
		type: 'dl',
		items: [
			['Endpoint', `\`${ENDPOINT}\``],
			['Region', `\`${REGION}\``],
			[
				'Addressing',
				'Path-style (`https://s3.kofra.app/bucket/key`). Virtual-hosted style is not supported.'
			],
			[
				'Credentials',
				'A Kofra access key ID and secret key. The secret is shown once, when you create the key.'
			]
		]
	},
	{
		type: 'p',
		text: 'Keep the secret key out of scripts you share: the examples below ask for it at a prompt or read it from environment variables. See [S3 compatibility](/docs/s3-compatibility) for supported operations, limits and error codes.'
	},

	{ type: 'h2', text: 'aws-cli', id: 'aws-cli' },
	{
		type: 'p',
		text: 'The AWS command line (version 2). Create a profile for Kofra once: `aws configure` asks for the key, so the secret never appears in your shell history. Then add `--profile kofra --endpoint-url` to each command.'
	},
	{
		type: 'code',
		title: 'Create the profile',
		lang: 'sh',
		code: `aws configure --profile kofra\n# AWS Access Key ID:     your Kofra key ID\n# AWS Secret Access Key: your Kofra secret key\n# Default region name:   ${REGION}\n# Default output format:  (press Enter)\naws configure set s3.addressing_style path --profile kofra`
	},
	{
		type: 'code',
		title: 'List, upload, sync and download',
		lang: 'sh',
		code: `aws s3 ls \\
  --profile kofra --endpoint-url ${ENDPOINT}\naws s3 cp ./report.pdf s3://my-bucket/reports/ \\
  --profile kofra --endpoint-url ${ENDPOINT}\naws s3 sync ./photos s3://my-bucket/photos/ \\
  --profile kofra --endpoint-url ${ENDPOINT}\naws s3 cp s3://my-bucket/reports/report.pdf . \\
  --profile kofra --endpoint-url ${ENDPOINT}`
	},
	{
		type: 'p',
		text: 'aws-cli uploads large files in parts automatically. Its default part sizes work for files up to 625 GiB; for larger files, set a fixed part size of 90 MiB with `aws configure set s3.multipart_chunksize 90MB --profile kofra`.'
	},

	{ type: 'h2', text: 'rclone', id: 'rclone' },
	{
		type: 'p',
		text: 'rclone copies, syncs and mounts, and can move data from other cloud services. Create a remote named `kofra` that reads the key from the environment.'
	},
	{
		type: 'code',
		title: 'Create the remote',
		lang: 'sh',
		code: `rclone config create kofra s3 provider=Other env_auth=true \\\n  endpoint=${ENDPOINT} region=${REGION} \\\n  force_path_style=true upload_cutoff=95M`
	},
	{
		type: 'code',
		title: 'Use it',
		lang: 'sh',
		code: `${KEY_ENV}\nrclone lsd kofra:\nrclone copy ./projects kofra:my-bucket/projects --progress\nrclone sync ./photos kofra:my-bucket/photos --dry-run\nrclone mount kofra:my-bucket ~/kofra --vfs-cache-mode writes`
	},
	{
		type: 'p',
		text: '`rclone copy` only adds and updates files. `rclone sync` makes the bucket match the source, so it also **deletes** files in the bucket that are not in the source: run it with `--dry-run` first, as above, and remove that flag only when the list is right. `upload_cutoff=95M` makes rclone send files over 95 MiB in parts. Kofra refuses a single upload request larger than 100 MB, and rclone’s own default cutoff (200 MiB) is above that.'
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
		text: '`restic init` asks for a new repository password, and every later command asks for it again (or reads `RESTIC_PASSWORD_FILE`).'
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

	{ type: 'h2', text: 'WebDAV (coming soon)', id: 'webdav' },
	{
		type: 'p',
		text: 'WebDAV access, for mounting Kofra as a network drive in Finder, File Explorer or a Linux file manager, is coming soon. Until then, `rclone mount` (above) gives you a drive.'
	},

	{ type: 'h2', text: 'Any S3 SDK', id: 'sdks' },
	{
		type: 'p',
		text: `The AWS SDKs and other S3 libraries work when you set three options: the endpoint \`${ENDPOINT}\`, the region \`${REGION}\`, and path-style addressing (often called \`forcePathStyle\`, \`force_path_style\` or \`addressing_style: path\`).`
	},
	{
		type: 'code',
		title: 'Python (boto3)',
		lang: 'python',
		code: `import boto3\nfrom botocore.config import Config\n\ns3 = boto3.client(\n    "s3",\n    endpoint_url="${ENDPOINT}",\n    region_name="${REGION}",\n    config=Config(s3={"addressing_style": "path"}),\n)  # reads AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY\nprint(s3.list_buckets()["Buckets"])`
	},
	{
		type: 'code',
		title: 'JavaScript (AWS SDK v3)',
		lang: 'js',
		code: `import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";\n\nconst s3 = new S3Client({\n  endpoint: "${ENDPOINT}",\n  region: "${REGION}",\n  forcePathStyle: true,\n}); // reads AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY\nconsole.log((await s3.send(new ListBucketsCommand({}))).Buckets);`
	}
];
