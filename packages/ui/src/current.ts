/**
 * True when `href` is the current page or a section that contains it.
 * The home link matches only the home page; `/docs` also matches `/docs/rclone`.
 * Trailing slashes, query strings and fragments are ignored.
 */
export function isCurrent(href: string, current: string): boolean {
	const norm = (p: string) => {
		const path = p.split(/[?#]/, 1)[0] ?? '';
		return path.length > 1 ? path.replace(/\/+$/, '') : path || '/';
	};
	if (/^[a-z]+:/i.test(href) || href.startsWith('#')) return false;
	const h = norm(href);
	const c = norm(current);
	if (h === '/') return c === '/';
	return c === h || c.startsWith(`${h}/`);
}
