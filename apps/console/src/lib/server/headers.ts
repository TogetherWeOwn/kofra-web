import raw from '../../../_headers?raw';

/**
 * Headers of the catch-all `/*` rule in the `_headers` file, which static assets get from
 * the platform; the server hook adds the same to every rendered response.
 */
export function catchAllHeaders(text: string): [string, string][] {
	const out: [string, string][] = [];
	let inCatchAll = false;
	for (const line of text.split('\n')) {
		if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
		if (!/^\s/.test(line)) {
			inCatchAll = line.trim() === '/*';
			continue;
		}
		if (!inCatchAll) continue;
		const t = line.trim();
		const at = t.indexOf(':');
		if (at < 1) throw new Error(`_headers: not a header line: ${t}`);
		out.push([t.slice(0, at).trim(), t.slice(at + 1).trim()]);
	}
	return out;
}

export const CONSOLE_HEADERS = catchAllHeaders(raw);

/**
 * Adds the shared headers to a rendered response. Console pages show a workspace's own data,
 * so no shared cache may keep them.
 */
export function applyHeaders(response: Response): Response {
	for (const [name, value] of CONSOLE_HEADERS) response.headers.set(name, value);
	if (!response.headers.has('cache-control'))
		response.headers.set('cache-control', 'private, no-store');
	return response;
}
