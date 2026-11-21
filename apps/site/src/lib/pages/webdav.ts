// WebDAV guide: the connection settings, the app password, each operating system's built-in
// client, rclone, and the limits. WebDAV is not open yet; the page says so first.
import type { Block } from '#lib/blocks.js';
import { PROFILE, WEBDAV_HOST, WEBDAV_URL } from '#lib/content.js';

export const WEBDAV = {
	heading: 'Connect over WebDAV',
	description: `Connect Kofra as a network drive over WebDAV at ${WEBDAV_URL}, from macOS Finder, Windows File Explorer, Linux file managers or rclone. Coming soon.`,
	lead: 'Mount your buckets as a network drive in Finder, File Explorer or a Linux file manager, with no extra software.'
};

export const WEBDAV_BLOCKS: Block[] = [
	{
		type: 'note',
		tone: 'info',
		title: 'Coming soon.',
		text: 'WebDAV is not open yet. This guide shows the settings it will use. Until it opens, [rclone mount](/docs/rclone#use) gives you a drive over S3.'
	},
	{ type: 'h2', text: 'Connection settings', id: 'settings' },
	{
		type: 'dl',
		items: [
			['Address', `\`${WEBDAV_URL}\` (HTTPS only)`],
			['Folders', `Each bucket is a folder: \`${WEBDAV_URL}/my-bucket/\`.`],
			['User name', 'The ID of a Kofra app password.'],
			['Password', 'The secret of that app password. It is shown once, when you create it.']
		]
	},
	{
		type: 'p',
		text: 'Create an app password in the Kofra console, under **App passwords**, and choose which buckets it can reach and whether it can write. An app password works for WebDAV only, and an S3 access key does not work for WebDAV, so you can revoke each on its own.'
	},

	{ type: 'h2', text: 'macOS Finder', id: 'macos' },
	{
		type: 'ol',
		items: [
			'In Finder, choose **Go**, then **Connect to Server**.',
			`Enter \`${WEBDAV_URL}/my-bucket/\` and choose **Connect**.`,
			'Choose **Registered User**, enter the app password ID and secret, and choose **Connect**.'
		]
	},

	{ type: 'h2', text: 'Windows File Explorer', id: 'windows' },
	{
		type: 'ol',
		items: [
			'In File Explorer, right-click **This PC** and choose **Map network drive**.',
			`Pick a drive letter, enter \`${WEBDAV_URL}/my-bucket/\` as the folder, and tick **Connect using different credentials**.`,
			'Enter the app password ID and secret.'
		]
	},
	{
		type: 'p',
		text: 'File Explorer refuses files larger than about 47 MiB (50,000,000 bytes) in either direction until you raise its limit. In the registry, under `HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\WebClient\\Parameters`, set `FileSizeLimitInBytes` to `4294967295` and restart the **WebClient** service. For large files, rclone is the better choice on Windows.'
	},

	{ type: 'h2', text: 'Linux', id: 'linux' },
	{
		type: 'p',
		text: `In GNOME Files or KDE Dolphin, connect to \`davs://${WEBDAV_HOST}/my-bucket/\` and enter the app password ID and secret.`
	},

	{ type: 'h2', text: 'rclone', id: 'rclone' },
	{
		type: 'code',
		lang: 'sh',
		code: `read -rsp 'App password secret: ' KOFRA_DAV_SECRET; echo\nrclone config create kofra-dav webdav url=${WEBDAV_URL} vendor=other \\\n  user=your-app-password-id pass="$(rclone obscure "$KOFRA_DAV_SECRET")"\nunset KOFRA_DAV_SECRET\nrclone mount kofra-dav:my-bucket ~/kofra --vfs-cache-mode writes`
	},
	{
		type: 'p',
		text: 'For files above the WebDAV upload limit, use the [S3 remote](/docs/rclone) instead.'
	},

	{ type: 'h2', text: 'Limits', id: 'limits' },
	{
		type: 'table',
		caption: 'WebDAV limits',
		head: ['Limit', 'Value', 'Notes'],
		rows: [
			[
				'Largest file you can upload',
				`${PROFILE.webdavMaxUploadMiB} MiB`,
				'A WebDAV client sends each file in one request. Upload larger files over S3, which sends them in parts.'
			],
			[
				'Largest file you can download',
				'No WebDAV limit',
				'Some clients have their own limit (see Windows above).'
			],
			[
				'Listing a whole tree at once',
				'Not supported',
				'Clients list one folder at a time, which all common clients do by default.'
			],
			['Locks', 'Supported', 'Locks apply to WebDAV clients. S3 tools are not blocked by them.']
		]
	}
];
