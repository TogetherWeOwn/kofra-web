/** Path without query, fragment or trailing slash; "/" stays "/". Linear time on any input. */
function norm(p: string): string {
	const path = p.split(/[?#]/, 1)[0] ?? '';
	let end = path.length;
	while (end > 1 && path.charCodeAt(end - 1) === 47 /* "/" */) end--;
	return path.slice(0, end) || '/';
}

/** Absolute URLs (any scheme), protocol-relative URLs and bare fragments are never "current". */
const isForeign = (href: string) =>
	/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href) || href.startsWith('#');

/**
 * True when `href` is the current page or a section that contains it.
 * The home link matches only the home page; `/docs` also matches `/docs/rclone`.
 * Trailing slashes, query strings and fragments are ignored.
 */
export function isCurrent(href: string, current: string): boolean {
	if (isForeign(href)) return false;
	const h = norm(href);
	const c = norm(current);
	if (h === '/') return c === '/';
	return c === h || c.startsWith(`${h}/`);
}

/**
 * The aria-current value for a navigation link: "page" for the current page itself,
 * "true" for a section that contains it, undefined otherwise.
 */
export function currentState(href: string, current: string): 'page' | 'true' | undefined {
	if (!isCurrent(href, current)) return undefined;
	return norm(href) === norm(current) ? 'page' : 'true';
}
