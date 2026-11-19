// Content-Security-Policy for the one page that loads Cloudflare Turnstile (the waitlist form).
// Every other page keeps the strict site-wide policy from the `_headers` file.

// Plain JavaScript (types in JSDoc): scripts/postbuild.mjs and scripts/budgets.mjs import it.

/** The only third-party origin the site may load, and only on WAITLIST_FORM_PAGES. */
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/** Pages that render the waitlist form when the waitlist is enabled. */
export const WAITLIST_FORM_PAGES = ['/early-access'];

/**
 * True when built page HTML loads the Turnstile script, which only an enabled build renders.
 * @param {string} html
 */
export const loadsTurnstile = (html) => html.includes(`src="${TURNSTILE_ORIGIN}/`);

/**
 * The site policy plus Turnstile: its script and its challenge frame, nothing else.
 * @param {string} csp
 */
export function withTurnstile(csp) {
	const directives = csp
		.split(';')
		.map((d) => d.trim())
		.filter(Boolean);
	const names = directives.map((d) => d.split(/\s+/)[0]);
	const script = names.indexOf('script-src');
	if (script < 0) throw new Error('CSP has no script-src directive');
	if (names.includes('frame-src') || names.includes('child-src'))
		throw new Error('CSP already sets frame-src or child-src; review the Turnstile override');
	directives[script] += ` ${TURNSTILE_ORIGIN}`;
	directives.splice(script + 1, 0, `frame-src ${TURNSTILE_ORIGIN}`);
	return directives.join('; ');
}

/**
 * A `_headers` file with one more rule per path: it detaches the site-wide policy and sets the
 * Turnstile one. The rules go last, because a detach only removes what earlier rules added.
 * @param {string} text the built `_headers` file
 * @param {string[]} paths
 */
export function withTurnstileRules(text, paths) {
	let rule = '';
	/** @type {string[]} */
	const found = [];
	for (const line of text.split('\n')) {
		if (/^\S/.test(line) && !line.startsWith('#')) rule = line.trim();
		const m = /^\s+Content-Security-Policy:\s*(.+)$/i.exec(line);
		if (m?.[1] && rule === '/*') found.push(m[1].trim());
		else if (m) throw new Error(`_headers: unexpected Content-Security-Policy under ${rule}`);
	}
	const [csp] = found;
	if (!csp || found.length !== 1)
		throw new Error('_headers: expected exactly one Content-Security-Policy under /*');
	const rules = paths.map(
		(p) => `${p}\n  ! Content-Security-Policy\n  Content-Security-Policy: ${withTurnstile(csp)}\n`
	);
	return `${text.replace(/\n*$/, '\n')}\n# Added by scripts/postbuild.mjs: the waitlist form loads Cloudflare Turnstile.\n${rules.join('\n')}`;
}
