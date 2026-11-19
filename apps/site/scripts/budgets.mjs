// Hard gate: JavaScript and CSS bytes (gzip) that each prerendered page loads.
// Usage: node scripts/budgets.mjs [client-dir]   (default: the adapter output)
// Deterministic: it reads the build output, not a browser. Exit 1 when a page is over budget.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Set from the first full build (JS 1.0 KB, CSS 6.3 KB at most, 2026-11-19) plus headroom.
// Raise them only with a reason in the PR; a regression should be fixed, not absorbed.
export const BUDGET = { js: 4 * 1024, css: 12 * 1024 };

/** Third-party origins a page may load scripts from (none today). */
const ALLOWED_EXTERNAL = new Set([]);

/** Every .html file under dir, as [file, url path]. */
function pages(dir, base = dir) {
	return readdirSync(dir).flatMap((name) => {
		const file = path.join(dir, name);
		if (statSync(file).isDirectory()) return pages(file, base);
		if (!name.endsWith('.html')) return [];
		const rel = '/' + path.relative(base, file).replace(/\\/g, '/');
		const url = rel === '/index.html' ? '/' : rel.replace(/\.html$/, '');
		return [[file, url]];
	});
}

/** Gzip size of each script and stylesheet a page references. */
export function measure(clientDir) {
	return pages(clientDir).map(([file, url]) => {
		const html = readFileSync(file, 'utf8');
		const refs = (re) => [...html.matchAll(re)].map((m) => m[1]);
		const resolve = (ref) => {
			if (/^(https?:)?\/\//.test(ref)) {
				const host = new URL(ref, 'https://x').host;
				if (!ALLOWED_EXTERNAL.has(host))
					throw new Error(`${url}: external asset ${ref} is not allowed`);
				return null;
			}
			const abs = new URL(ref, `https://x${url}`).pathname; // relative to the page URL
			return path.join(clientDir, decodeURIComponent(abs));
		};
		const size = (list) =>
			list.reduce((sum, ref) => {
				const f = resolve(ref);
				return f ? sum + gzipSync(readFileSync(f), { level: 9 }).length : sum;
			}, 0);
		const js = [
			...refs(/<script[^>]*\ssrc="([^"]+)"/g),
			...[...html.matchAll(/<link\b[^>]*>/g)]
				.map((m) => m[0])
				.filter((tag) => /rel="modulepreload"/.test(tag))
				.map((tag) => /href="([^"]+)"/.exec(tag)?.[1])
				.filter(Boolean)
		];
		// Inline code counts too (JSON-LD data blocks are not code and are excluded).
		const inline = (re) =>
			[...html.matchAll(re)].reduce((n, m) => n + gzipSync(m[1], { level: 9 }).length, 0);
		const inlineJs = inline(
			/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g
		);
		const inlineCss = inline(/<style[^>]*>([\s\S]*?)<\/style>/g);
		const css = [...html.matchAll(/<link\b[^>]*>/g)]
			.map((m) => m[0])
			.filter((tag) => /rel="stylesheet"/.test(tag))
			.map((tag) => /href="([^"]+)"/.exec(tag)?.[1])
			.filter(Boolean);
		return { url, js: size(js) + inlineJs, css: size(css) + inlineCss };
	});
}

// import.meta.main needs Node 24.2; this works on every Node the engines field allows.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const dir = process.argv[2] ?? '.svelte-kit/cloudflare/client';
	const rows = measure(dir).sort((a, b) => a.url.localeCompare(b.url));
	const kb = (n) => (n / 1024).toFixed(1).padStart(5);
	console.log(
		`page                              JS gz   CSS gz   (budget JS ${BUDGET.js / 1024} KB, CSS ${BUDGET.css / 1024} KB)`
	);
	let failed = 0;
	for (const r of rows) {
		const over = r.js > BUDGET.js || r.css > BUDGET.css;
		if (over) failed++;
		console.log(`${r.url.padEnd(32)} ${kb(r.js)} KB ${kb(r.css)} KB${over ? '  OVER BUDGET' : ''}`);
	}
	if (!rows.length) {
		console.error('no pages found in', dir);
		process.exit(1);
	}
	process.exit(failed ? 1 : 0);
}
