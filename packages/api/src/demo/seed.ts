// The fixed starting point of the demo workspace. Dates are relative to "now", so the demo
// always looks current; sizes and counts are invented but add up across every screen.

const GB = 1_000_000_000;
const MB = 1_000_000;

export interface SeedBucket {
	name: string;
	/** Days before now. */
	createdDaysAgo: number;
	storedBytes: number;
	objectCount: number;
}

export const SEED_BUCKETS: SeedBucket[] = [
	{ name: 'backups', createdDaysAgo: 79, storedBytes: Math.round(268.4 * GB), objectCount: 4182 },
	{
		name: 'family-photos',
		createdDaysAgo: 64,
		storedBytes: Math.round(96.2 * GB),
		objectCount: 12604
	},
	{ name: 'projects', createdDaysAgo: 41, storedBytes: Math.round(51.7 * GB), objectCount: 1377 },
	{
		name: 'media-archive',
		createdDaysAgo: 18,
		storedBytes: Math.round(26.1 * GB),
		objectCount: 179
	},
	// Empty, so the demo has a bucket that can be deleted.
	{ name: 'shared-docs', createdDaysAgo: 2, storedBytes: 0, objectCount: 0 }
];

export interface SeedKey {
	id: string;
	name: string;
	grants: { bucket: string; access: 'read' | 'read_write' }[];
	createdDaysAgo: number;
	/** Hours before now, or null when never used. */
	lastUsedHoursAgo: number | null;
}

export const SEED_KEYS: SeedKey[] = [
	{
		id: 'KF7Q2M8X4T7R5N0B',
		name: 'nightly-backup',
		grants: [{ bucket: 'backups', access: 'read_write' }],
		createdDaysAgo: 78,
		lastUsedHoursAgo: 7
	},
	{
		id: 'KF3H9W2C6V1L8D4P',
		name: 'photo-sync',
		grants: [{ bucket: 'family-photos', access: 'read_write' }],
		createdDaysAgo: 63,
		lastUsedHoursAgo: 1
	},
	{
		id: 'KF5T1R8N3B6Y0J2M',
		name: 'laptop-read-only',
		grants: [
			{ bucket: 'family-photos', access: 'read' },
			{ bucket: 'projects', access: 'read' }
		],
		createdDaysAgo: 30,
		lastUsedHoursAgo: null
	}
];

/** Sample files shown in each seed bucket: [key, size, content type, days before now]. */
export const SEED_FILES: Record<string, [string, number, string, number][]> = {
	backups: [
		['laptop/2026-11-18.tar.zst', Math.round(18.4 * GB), 'application/zstd', 2],
		['laptop/2026-11-19.tar.zst', Math.round(18.5 * GB), 'application/zstd', 1],
		['server/db/2026-11-19.sql.gz', Math.round(2.1 * GB), 'application/gzip', 1],
		['server/db/2026-11-18.sql.gz', Math.round(2.1 * GB), 'application/gzip', 2],
		['server/etc.tar.gz', 41 * MB, 'application/gzip', 9],
		['README.txt', 1_204, 'text/plain', 79]
	],
	'family-photos': [
		['2026/summer/beach-001.jpg', 6_412_330, 'image/jpeg', 120],
		['2026/summer/beach-002.jpg', 5_980_114, 'image/jpeg', 120],
		['2026/summer/sunset.mov', 412 * MB, 'video/quicktime', 118],
		['2026/birthday/cake.jpg', 4_210_880, 'image/jpeg', 40],
		['2025/winter/snow.heic', 3_112_004, 'image/heic', 330],
		['albums.json', 18_442, 'application/json', 3]
	],
	projects: [
		['website/index.html', 12_480, 'text/html', 12],
		['website/styles.css', 6_204, 'text/css', 12],
		['reports/q3-summary.pdf', 2_480_112, 'application/pdf', 50],
		[
			'reports/q4-plan.docx',
			381_220,
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			6
		],
		['data/export.csv', 88 * MB, 'text/csv', 4]
	],
	'media-archive': [
		['films/home-movie-1998.mp4', Math.round(3.8 * GB), 'video/mp4', 18],
		['films/home-movie-2001.mp4', Math.round(4.2 * GB), 'video/mp4', 18],
		['music/live-set.flac', 920 * MB, 'audio/flac', 17]
	]
};

/** Account limits of the demo plan. */
export const DEMO_LIMITS = {
	storage_bytes: 1_099_511_627_776,
	upload_24h_bytes: 214_748_364_800,
	download_allowance_bytes: 1_099_511_627_776,
	active_keys: 20
};

/** Age of the demo workspace, in days. */
export const DEMO_WORKSPACE_CREATED_DAYS_AGO = 80;
