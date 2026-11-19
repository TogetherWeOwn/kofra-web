// CI check of the production flip: run after `KOFRA_INDEXABLE=true pnpm run build`.
// Fails if any page or the site-wide header rule still says noindex, or robots.txt still blocks.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const CLIENT = '.svelte-kit/cloudflare/client';
const walk = (d) =>
	readdirSync(d).flatMap((n) => {
		const f = path.join(d, n);
		return statSync(f).isDirectory() ? walk(f) : [f];
	});
const problems = [];
// Waitlist result pages are deliberately noindex in every build.
const alwaysNoindex = /\/early-access\/(sent|try-again|confirmed|link-expired)\.html$/;
for (const f of walk(CLIENT).filter((f) => f.endsWith('.html'))) {
	if (alwaysNoindex.test(f)) continue;
	if (/noindex/.test(readFileSync(f, 'utf8'))) problems.push(`${f}: still noindex`);
}
let rule = '';
for (const line of readFileSync(path.join(CLIENT, '_headers'), 'utf8').split('\n')) {
	if (/^\S/.test(line)) rule = line.trim();
	if (rule === '/*' && /X-Robots-Tag/i.test(line))
		problems.push('_headers: /* still sets X-Robots-Tag');
}
const robots = readFileSync(path.join(CLIENT, 'robots.txt'), 'utf8');
if (/Disallow/.test(robots)) problems.push('robots.txt still disallows');
if (!/^Sitemap: https:\/\/kofra\.app\/sitemap\.xml$/m.test(robots))
	problems.push('robots.txt has no Sitemap line');
if (problems.length) {
	console.error(problems.join('\n'));
	process.exit(1);
}
console.log('indexable build: no noindex on pages, robots.txt allows and links the sitemap');
