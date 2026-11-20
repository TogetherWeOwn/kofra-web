// Hard gate: JavaScript and CSS bytes (gzip) the console ships. The console is rendered by the
// Worker, so there are no HTML files to measure; this reads the client build instead and
// checks (1) each route: the start-up code, its layouts, its page and their imports, and
// (2) the whole client.
// Deterministic: it reads the build output, not a browser. Exit 1 when over budget.
// Usage: node scripts/budgets.mjs [client output dir]   (default: .svelte-kit/output/client)
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('..', import.meta.url));

// Set from the first full build (2026-11-20: largest route 54.6 KB of JS and 5.9 KB of CSS,
// all client JS 82.5 KB) plus headroom. Raise them only with a reason in the PR.
export const BUDGET = { routeJs: 80 * 1024, totalJs: 120 * 1024, routeCss: 12 * 1024 };

const dir = process.argv[2]
	? path.resolve(process.argv[2])
	: path.join(APP, '.svelte-kit/output/client');
const manifest = JSON.parse(readFileSync(path.join(dir, '.vite/manifest.json'), 'utf8'));
const gz = (file) => gzipSync(readFileSync(path.join(dir, file)), { level: 9 }).length;

/** Every file a manifest entry loads, following static imports. */
function closure(key, seen = new Set()) {
	if (seen.has(key)) return seen;
	seen.add(key);
	for (const dep of manifest[key]?.imports ?? []) closure(dep, seen);
	return seen;
}

const start = Object.keys(manifest).find(
	(k) => manifest[k].name === 'entry/start' || k.endsWith('/entry/start.js')
);
const app = Object.keys(manifest).find(
	(k) => manifest[k].name === 'entry/app' || k.endsWith('/entry/app.js')
);
const nodeKey = (n) => Object.keys(manifest).find((k) => k.endsWith(`/nodes/${n}.js`));
const base = new Set([...(start ? closure(start) : []), ...(app ? closure(app) : [])]);

// Each route loads the root layout (node 0), its own layouts and its page: read them from the
// route dictionary SvelteKit generates, e.g. "/(app)/billing": [~4,[2]].
const generated = readFileSync(
	path.join(APP, '.svelte-kit/generated/build/client-optimized/app.js'),
	'utf8'
);
const routes = [...generated.matchAll(/"([^"]+)":\s*\[~?(\d+)(?:,\s*\[([\d,\s]*)\])?/g)].map(
	(m) => ({
		id: m[1],
		nodes: [0, Number(m[2]), ...(m[3] ?? '').split(',').filter(Boolean).map(Number)]
	})
);

let failed = false;
const rows = [];
for (const route of routes) {
	const keys = new Set(base);
	for (const n of route.nodes) {
		const k = nodeKey(n);
		if (!k) throw new Error(`node ${n} of ${route.id} is not in the manifest`);
		closure(k, keys);
	}
	let js = 0;
	let css = 0;
	for (const k of keys) {
		const e = manifest[k];
		if (e.file?.endsWith('.js')) js += gz(e.file);
		for (const c of e.css ?? []) css += gz(c);
	}
	const over = js > BUDGET.routeJs || css > BUDGET.routeCss;
	failed ||= over;
	rows.push(
		`${over ? 'OVER' : 'ok  '} ${route.id}: JS ${(js / 1024).toFixed(1)} KB, CSS ${(css / 1024).toFixed(1)} KB`
	);
}
const allJs = [
	...new Set(
		Object.values(manifest)
			.map((e) => e.file)
			.filter((f) => f?.endsWith('.js'))
	)
];
const total = allJs.reduce((n, f) => n + gz(f), 0);
if (total > BUDGET.totalJs) failed = true;
console.log(rows.join('\n'));
console.log(
	`${total > BUDGET.totalJs ? 'OVER' : 'ok  '} all client JS: ${(total / 1024).toFixed(1)} KB (budget ${BUDGET.totalJs / 1024} KB)`
);
if (!routes.length) {
	console.error('no routes found in the generated route dictionary');
	failed = true;
}
process.exit(failed ? 1 : 0);
