// CI check of the launch switches: run after
// `KOFRA_SIGNUP_OPEN=true KOFRA_STATUS_LIVE=true pnpm run build`.
// Fails if any page does not link the console sign-up, sign-in and the status page, if any page
// still links /early-access, or if any page, twin or discovery file still says Kofra is in early
// access or not open for sign-ups. The legal drafts are skipped: they are replaced as a whole
// before launch (their own notice says so).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const CLIENT = '.svelte-kit/cloudflare/client';
const SIGN_UP = 'https://console.kofra.app/sign-up';
const SIGN_IN = 'https://console.kofra.app/sign-in';
const STATUS = 'https://status.kofra.app';
/** Wording that must be gone once accounts are open. */
const CLOSED =
	/early access|not (yet )?open for sign-ups|opens for sign-ups|not accepting customers/i;

const walk = (d) =>
	readdirSync(d).flatMap((n) => {
		const f = path.join(d, n);
		return statSync(f).isDirectory() ? walk(f) : [f];
	});
const files = walk(CLIENT).filter((f) => !f.includes(`${path.sep}_app${path.sep}`));
const rel = (f) => path.relative(CLIENT, f);
const legal = (f) => rel(f).startsWith(`legal${path.sep}`);
const pages = files.filter((f) => f.endsWith('.html'));
const problems = [];
if (!pages.length) problems.push(`no pages in ${CLIENT}`);

for (const f of pages) {
	const html = readFileSync(f, 'utf8');
	for (const href of [SIGN_UP, SIGN_IN, STATUS])
		if (!html.includes(`href="${href}"`)) problems.push(`${rel(f)}: no link to ${href}`);
	if (html.includes('href="/early-access"')) problems.push(`${rel(f)}: still links /early-access`);
}

for (const f of files.filter((f) => /\.(html|md|txt|xml)$/.test(f) && !legal(f))) {
	let text = readFileSync(f, 'utf8');
	// llms-full.txt concatenates every twin; drop the legal drafts' sections from it.
	if (rel(f) === 'llms-full.txt')
		text = text
			.split('\n---\n')
			.filter((s) => !/^\s*<!-- Kofra: https:\/\/kofra\.app\/legal\//.test(s))
			.join('\n---\n');
	const m = CLOSED.exec(text);
	if (m) problems.push(`${rel(f)}: still says "${m[0]}"`);
}

for (const twin of ['index.md', 'pricing.md']) {
	const md = readFileSync(path.join(CLIENT, twin), 'utf8');
	if (!md.includes(`](${SIGN_UP})`)) problems.push(`${twin}: no link to ${SIGN_UP}`);
}

if (problems.length) {
	console.error(problems.join('\n'));
	process.exit(1);
}
console.log(
	`launch build: ${pages.length} pages link sign-up, sign-in and status; no early-access wording`
);
