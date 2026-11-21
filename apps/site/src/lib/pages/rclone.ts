// rclone guide: a Kofra remote with the measured upload settings, copy, sync and mount, moving
// data from another cloud, and checking a copy.
import type { Block } from '#lib/blocks.js';
import { ENDPOINT, PROFILE, REGION } from '#lib/content.js';
import { EARLY_NOTE, KEY_ENV } from '#lib/pages/docs.js';

export const RCLONE = {
	heading: 'Use Kofra with rclone',
	description: `Use rclone with Kofra: a remote with endpoint ${ENDPOINT}, path-style requests and ${PROFILE.partMiB} MiB parts, then copy, sync, mount and move data from other clouds.`,
	lead: 'rclone copies, syncs and mounts, and moves data from other cloud services. Set up a Kofra remote once, with the settings below.'
};

const M = `${PROFILE.partMiB}M`;

export const RCLONE_BLOCKS: Block[] = [
	...EARLY_NOTE,
	{ type: 'h2', text: 'Create the remote', id: 'remote' },
	{
		type: 'p',
		text: 'This creates a remote named `kofra` that reads the key from environment variables, so the secret is not written to the rclone config file.'
	},
	{
		type: 'code',
		title: 'Create the remote',
		lang: 'sh',
		code: `rclone config create kofra s3 provider=Other env_auth=true \\\n  endpoint=${ENDPOINT} region=${REGION} force_path_style=true \\\n  upload_cutoff=${M} chunk_size=${M} upload_concurrency=1 \\\n  disable_http2=true no_check_bucket=true`
	},
	{
		type: 'code',
		title: 'Set the key for this terminal session',
		lang: 'sh',
		code: KEY_ENV
	},
	{
		type: 'p',
		text: 'The remote in `rclone.conf` (`rclone config file` shows where it is) then looks like this:'
	},
	{
		type: 'code',
		title: 'rclone.conf',
		lang: 'ini',
		code: `[kofra]\ntype = s3\nprovider = Other\nenv_auth = true\nendpoint = ${ENDPOINT}\nregion = ${REGION}\nforce_path_style = true\nupload_cutoff = ${M}\nchunk_size = ${M}\nupload_concurrency = 1\ndisable_http2 = true\nno_check_bucket = true`
	},
	{
		type: 'ul',
		items: [
			`\`upload_cutoff\` and \`chunk_size\`: files of ${PROFILE.partMiB} MiB and more go up in ${PROFILE.partMiB} MiB parts. rclone’s own cutoff (200 MiB) is above the largest single request Kofra takes (${PROFILE.maxRequestMiB} MiB), so it must be lowered.`,
			'`disable_http2`: gives each request its own connection. With HTTP/2, rclone sends every request over one connection, and that connection limits the speed whatever the number of transfers.',
			'`no_check_bucket`: buckets are created in the Kofra console, so rclone does not try to create them.',
			`\`upload_concurrency = 1\` with \`--transfers ${PROFILE.concurrency}\` (below): up to ${PROFILE.concurrency} requests at once, one per file.`
		]
	},

	{ type: 'h2', text: 'Copy, sync and mount', id: 'use' },
	{
		type: 'code',
		title: 'Many files',
		lang: 'sh',
		code: `rclone lsd kofra:\nrclone copy ./projects kofra:my-bucket/projects --transfers ${PROFILE.concurrency} --progress\nrclone sync ./photos kofra:my-bucket/photos --transfers ${PROFILE.concurrency} --dry-run`
	},
	{
		type: 'p',
		text: '`rclone copy` only adds and updates files. `rclone sync` makes the bucket match the source, so it also **deletes** files in the bucket that are not in the source: run it with `--dry-run` first, as above, and remove that flag only when the list is right.'
	},
	{
		type: 'code',
		title: 'One large file',
		lang: 'sh',
		code: `rclone copy ./video.mkv kofra:my-bucket/videos \\\n  --transfers 1 --s3-upload-concurrency ${PROFILE.concurrency} --progress`
	},
	{
		type: 'p',
		text: `For a single large file, send its parts in parallel instead of several files at once. The largest object is ${PROFILE.maxObjectGiB} GiB with ${PROFILE.partMiB} MiB parts.`
	},
	{
		type: 'code',
		title: 'Mount a bucket as a drive',
		lang: 'sh',
		code: `# macOS and Linux: mount on an empty folder\nmkdir -p ~/kofra\nrclone mount kofra:my-bucket ~/kofra --vfs-cache-mode writes\n\n# Windows: mount as a drive letter\nrclone mount kofra:my-bucket X: --vfs-cache-mode writes`
	},
	{
		type: 'p',
		text: 'With `--vfs-cache-mode writes`, files open for writing are kept on your disk and uploaded when closed, so programs that edit files in place work. macOS needs macFUSE and Windows needs WinFsp for `rclone mount`.'
	},

	{ type: 'h2', text: 'Move data from another cloud', id: 'migrate' },
	{
		type: 'p',
		text: 'rclone can copy straight from another storage service to Kofra. Set up a remote for the other service first (`rclone config`), then copy and check. The example uses a Google Drive remote named `gdrive`.'
	},
	{
		type: 'code',
		title: 'Copy, then check',
		lang: 'sh',
		code: `rclone copy gdrive: kofra:my-bucket/drive --transfers ${PROFILE.concurrency} --progress\nrclone check gdrive: kofra:my-bucket/drive --one-way`
	},
	{
		type: 'p',
		text: '`rclone check` compares sizes and, where both services keep the same kind of checksum, checksums. Add `--download` to compare the full contents of every file; it reads everything from both sides, so it takes longer. Run `rclone copy` again after an interruption: it skips files that are already there.'
	},

	{ type: 'h2', text: 'Common problems', id: 'problems' },
	{
		type: 'table',
		caption: 'rclone problems and fixes',
		head: ['Problem', 'Fix'],
		rows: [
			[
				`Files between ${PROFILE.maxRequestMiB} MiB and 200 MiB fail to upload (\`EntityTooLarge\` or HTTP 413)`,
				`Set \`upload_cutoff = ${M}\` on the remote. rclone’s default sends files of up to 200 MiB in one request.`
			],
			[
				'Uploads are slow whatever `--transfers` is',
				'Set `disable_http2 = true` on the remote, or pass `--s3-disable-http2`.'
			],
			[
				'`AuthorizationHeaderMalformed`',
				`The region is wrong. Set \`region = ${REGION}\` on the remote.`
			],
			[
				'`InvalidRequest` about virtual-hosted-style requests',
				'Set `force_path_style = true` on the remote.'
			],
			[
				'A running `rclone rcd` or mount ignores new settings',
				'Restart it. It keeps the settings it started with; a restart stops the copies it is running.'
			]
		]
	}
];
