// Console links, built with SvelteKit's resolve() so they follow the app's base path.
// resolve() inserts parameters as given: bucket names (lowercase letters, digits, hyphens)
// and key IDs (capitals and digits) need no escaping; object keys and cursors go in the
// query string, escaped here.
import { resolve } from '$app/paths';

const q = (v: string) => encodeURIComponent(v);

export const bucketHref = (bucket: string, prefix = '') =>
	prefix
		? resolve(`/(app)/buckets/[bucket]?prefix=${q(prefix)}`, { bucket })
		: resolve('/(app)/buckets/[bucket]', { bucket });
export const bucketDeleteHref = (bucket: string) =>
	resolve('/(app)/buckets/[bucket]/delete', { bucket });
export const downloadHref = (bucket: string, key: string) =>
	resolve(`/(app)/buckets/[bucket]/download?key=${q(key)}`, { bucket });
export const bucketsPageHref = (cursor: string) => resolve(`/(app)/buckets?cursor=${q(cursor)}`);
export const keyRevokeHref = (id: string) => resolve('/(app)/keys/[id]/revoke', { id });
export const bucketConnectHref = (bucket: string) =>
	resolve('/(app)/buckets/[bucket]/connect', { bucket });
export const deleteFilesAction = (bucket: string) =>
	resolve('/(app)/buckets/[bucket]/delete-files', { bucket });
export const bucketPageHref = (bucket: string, prefix: string, cursor: string) =>
	resolve(`/(app)/buckets/[bucket]?${prefix ? `prefix=${q(prefix)}&` : ''}cursor=${q(cursor)}`, {
		bucket
	});
