// Object keys and folder prefixes in the file browser.

/** Most bytes in an object key (the S3 limit). */
export const MAX_KEY_BYTES = 1024;

const byteLength = (s: string) => new TextEncoder().encode(s).length;
/** True when the text holds a control character (U+0000 to U+001F, or U+007F). */
const hasControl = (s: string) =>
	[...s].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f);

/** "" or a path of non-empty segments ending in "/". */
export function validPrefix(prefix: string): boolean {
	if (prefix === '') return true;
	return (
		prefix.endsWith('/') &&
		!prefix.startsWith('/') &&
		!prefix.includes('//') &&
		byteLength(prefix) < MAX_KEY_BYTES &&
		!hasControl(prefix)
	);
}

/** A key the console will upload to: no empty segments, no control characters. */
export function validKey(key: string): boolean {
	return (
		key.length > 0 &&
		!key.startsWith('/') &&
		!key.endsWith('/') &&
		!key.includes('//') &&
		byteLength(key) <= MAX_KEY_BYTES &&
		!hasControl(key) &&
		!key.split('/').some((s) => s === '.' || s === '..')
	);
}

/** "a/b/" → [{name: "a", prefix: "a/"}, {name: "b", prefix: "a/b/"}]. */
export function folderCrumbs(prefix: string): { name: string; prefix: string }[] {
	const parts = prefix.split('/').filter(Boolean);
	return parts.map((name, i) => ({ name, prefix: `${parts.slice(0, i + 1).join('/')}/` }));
}

/** The key for a file picked or dropped while browsing `prefix`; folders keep their path. */
export function uploadKey(prefix: string, relativePath: string): string {
	return `${prefix}${relativePath.replace(/^\/+/, '')}`;
}
