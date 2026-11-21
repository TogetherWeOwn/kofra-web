// aws-cli guide: a Kofra profile with the measured upload settings, everyday commands, large
// files, presigned links and common errors.
import type { Block } from '#lib/blocks.js';
import { ENDPOINT, PROFILE, REGION } from '#lib/content.js';
import { EARLY_NOTE } from '#lib/pages/docs.js';

export const AWS_CLI = {
	heading: 'Use Kofra with aws-cli',
	description: `Use aws-cli with Kofra: a profile with endpoint ${ENDPOINT}, region ${REGION}, path-style requests and ${PROFILE.partMiB} MiB parts, commands and common errors.`,
	lead: 'Set up the AWS command line (version 2) for Kofra once, then use the usual aws s3 commands.'
};

const P = '--profile kofra';

export const AWS_CLI_BLOCKS: Block[] = [
	...EARLY_NOTE,
	{ type: 'h2', text: 'Create the profile', id: 'profile' },
	{
		type: 'p',
		text: '`aws configure` asks for the key, so the secret never appears in your shell history. It stores the key in `~/.aws/credentials`.'
	},
	{
		type: 'code',
		title: 'Enter the key',
		lang: 'sh',
		code: `aws configure ${P}\n# AWS Access Key ID:     your Kofra key ID\n# AWS Secret Access Key: your Kofra secret key\n# Default region name:   ${REGION}\n# Default output format:  (press Enter)`
	},
	{
		type: 'code',
		title: 'Set the endpoint and the upload settings',
		lang: 'sh',
		code: [
			`aws configure set endpoint_url ${ENDPOINT} ${P}`,
			`aws configure set s3.addressing_style path ${P}`,
			`aws configure set s3.multipart_threshold ${PROFILE.partMiB}MB ${P}`,
			`aws configure set s3.multipart_chunksize ${PROFILE.partMiB}MB ${P}`,
			`aws configure set s3.max_concurrent_requests ${PROFILE.concurrency} ${P}`,
			`aws configure set s3.preferred_transfer_client classic ${P}`
		].join('\n')
	},
	{
		type: 'p',
		text: 'The profile in `~/.aws/config` then looks like this. You can also write it by hand.'
	},
	{
		type: 'code',
		title: '~/.aws/config',
		lang: 'ini',
		code: `[profile kofra]\nregion = ${REGION}\nendpoint_url = ${ENDPOINT}\ns3 =\n  addressing_style = path\n  multipart_threshold = ${PROFILE.partMiB}MB\n  multipart_chunksize = ${PROFILE.partMiB}MB\n  max_concurrent_requests = ${PROFILE.concurrency}\n  preferred_transfer_client = classic`
	},
	{
		type: 'ul',
		items: [
			`\`multipart_threshold\` and \`multipart_chunksize\`: files of ${PROFILE.partMiB} MiB and more go up in ${PROFILE.partMiB} MiB parts (aws-cli’s \`MB\` means MiB). The default, 8 MiB, works but allows smaller files at most (see [Large files](/docs/aws-cli#large-files)).`,
			`\`max_concurrent_requests\`: ${PROFILE.concurrency} requests at once instead of 10. Uploads through Kofra gain a lot from parallel requests.`,
			'`preferred_transfer_client = classic`: keeps the three settings above in force. On some computers aws-cli picks a different transfer client that ignores them.',
			'`endpoint_url` in a profile needs aws-cli 2.13 or later. On an older version, add `--endpoint-url ' +
				ENDPOINT +
				'` to every command.'
		]
	},

	{ type: 'h2', text: 'Everyday commands', id: 'commands' },
	{
		type: 'code',
		title: 'List, upload, sync and download',
		lang: 'sh',
		code: `aws s3 ls ${P}\naws s3 ls s3://my-bucket/reports/ ${P}\naws s3 cp ./report.pdf s3://my-bucket/reports/ ${P}\naws s3 sync ./photos s3://my-bucket/photos/ ${P}\naws s3 cp s3://my-bucket/reports/report.pdf . ${P}`
	},
	{
		type: 'p',
		text: '`aws s3 sync` copies new and changed files only. With `--delete` it also removes files in the bucket that are not in the source: run it with `--dryrun` first.'
	},
	{
		type: 'code',
		title: 'Delete',
		lang: 'sh',
		code: `aws s3 rm s3://my-bucket/reports/old.pdf ${P}\naws s3 rm s3://my-bucket/tmp/ --recursive --dryrun ${P}`
	},

	{ type: 'h2', text: 'Large files', id: 'large-files' },
	{
		type: 'p',
		text: `aws-cli splits large files into parts by itself. The largest object depends on the part size:`
	},
	{
		type: 'table',
		caption: 'Largest object by part size',
		head: ['Part size', 'Largest object'],
		rows: [
			[`${PROFILE.partMiB} MiB (recommended)`, `${PROFILE.maxObjectGiB} GiB`],
			[`8 MiB (aws-cli default)`, `${PROFILE.maxObjectGiB / 2} GiB`],
			[
				`Above ${PROFILE.partMiB} MiB, up to ${PROFILE.maxRequestMiB} MiB`,
				`${PROFILE.maxObjectLargePartsGiB} GiB`
			]
		]
	},
	{
		type: 'p',
		text: `Keep the part size at ${PROFILE.partMiB} MiB: larger parts do not raise the limit. A file above ${PROFILE.maxObjectGiB} GiB does not fit in one object; split it first (for example with \`split -b 100G\`).`
	},

	{ type: 'h2', text: 'Share a file with a link', id: 'presign' },
	{
		type: 'p',
		text: 'A presigned link lets anyone with the link download one file until it expires, without a key. The longest lifetime is 7 days (604800 seconds).'
	},
	{
		type: 'code',
		lang: 'sh',
		code: `aws s3 presign s3://my-bucket/reports/report.pdf --expires-in 3600 ${P}`
	},

	{ type: 'h2', text: 'Common errors', id: 'errors' },
	{
		type: 'table',
		caption: 'aws-cli errors and fixes',
		head: ['Error', 'Fix'],
		rows: [
			[
				'`AccessDenied` on every request',
				`Check that the profile uses region \`${REGION}\` and \`addressing_style = path\`.`
			],
			[
				'`SignatureDoesNotMatch`',
				'The secret key is wrong. Run `aws configure --profile kofra` again.'
			],
			['`RequestTimeTooSkewed`', 'Your computer’s clock is wrong. Synchronise it and retry.'],
			[
				'`EntityTooLarge`',
				`The file is above the limit for its part size; see [Large files](/docs/aws-cli#large-files).`
			],
			[
				'`SlowDown` (503)',
				'Kofra is busy for a moment. aws-cli retries by itself; if the command stops, run it again.'
			],
			['Uploads ignore the settings', 'Set `preferred_transfer_client = classic` in the profile.']
		]
	},
	{
		type: 'p',
		text: 'More error codes are on the [S3 compatibility](/docs/s3-compatibility#errors) page.'
	}
];
