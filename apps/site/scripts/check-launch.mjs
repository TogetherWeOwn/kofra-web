// CI check of the launch switches: run after
// `KOFRA_SIGNUP_OPEN=true KOFRA_STATUS_LIVE=true pnpm run build`.
// Fails if any page still asks for early access instead of linking the console sign-up, if the
// status page is not linked, or if the early-access wording survives the switch.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const CLIENT = '.svelte-kit/cloudflare/client';
const SIGN_UP = 'https://console.kofra.app/sign-up';
const SIGN_IN = 'https://console.kofra.app/sign-in';
const STATUS = 'https://status.kofra.app';

const walk = (d) =>
	readdirSync(d).flatMap((n) => {
		const f = path.join(d, n);
		return statSync(f).isDirectory() ? walk(f) : [f];
	});
const pages = walk(CLIENT).filter((f) => f.endsWith('.html') && !f.includes('/_app/'));
const problems = [];
if (!pages.length) problems.push(`no pages in ${CLIENT}`);
for (const f of pages) {
	const html = readFileSync(f, 'utf8');
	if (!html.includes(`href="${SIGN_UP}"`)) problems.push(`${f}: no link to ${SIGN_UP}`);
	if (!html.includes(`href="${SIGN_IN}"`)) problems.push(`${f}: no link to ${SIGN_IN}`);
	if (!html.includes(`href="${STATUS}"`)) problems.push(`${f}: no link to ${STATUS}`);
	if (/Get early access/.test(html)) problems.push(`${f}: still says "Get early access"`);
	if (/Kofra is in early access/.test(html))
		problems.push(`${f}: still says it is in early access`);
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
