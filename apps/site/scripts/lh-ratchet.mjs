// Lighthouse ratchet (hard gate on regressions only). Reads the runs that `lhci collect` saved in
// .lighthouseci/, takes the median of each page's runs, prints a Markdown table, and fails only
// when a median falls below the committed baseline by more than the noise margin. Missing a
// target is reported by `lhci assert` as a warning, never here.
//
// Usage: node scripts/lh-ratchet.mjs            compare with lighthouse-baseline.json
//        node scripts/lh-ratchet.mjs --update   write the current medians as the new baseline
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';

const DIR = '.lighthouseci';
const BASELINE = 'lighthouse-baseline.json';
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
/** Allowed drop below the baseline before the gate fails, in score points (0-100). */
export const MARGIN = { performance: 5, accessibility: 0, 'best-practices': 2, seo: 2 };

const median = (xs) => {
	const s = [...xs].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function medians(lhrs) {
	const byPath = new Map();
	for (const lhr of lhrs) {
		const p = new URL(lhr.finalDisplayedUrl ?? lhr.requestedUrl).pathname;
		if (!byPath.has(p)) byPath.set(p, []);
		byPath.get(p).push(lhr);
	}
	const out = {};
	for (const [p, runs] of [...byPath].sort()) {
		const row = {};
		for (const c of CATEGORIES)
			row[c] = Math.round(median(runs.map((r) => r.categories[c].score)) * 100);
		row.lcpMs = Math.round(
			median(runs.map((r) => r.audits['largest-contentful-paint'].numericValue))
		);
		row.tbtMs = Math.round(median(runs.map((r) => r.audits['total-blocking-time'].numericValue)));
		row.cls = +median(runs.map((r) => r.audits['cumulative-layout-shift'].numericValue)).toFixed(3);
		row.runs = runs.length;
		out[p] = row;
	}
	return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const files = readdirSync(DIR).filter((f) => /^lhr-.*\.json$/.test(f));
	if (!files.length) {
		console.error(`no Lighthouse results in ${DIR}/; run lhci collect first`);
		process.exit(1);
	}
	const current = medians(files.map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'))));
	if (process.argv.includes('--update')) {
		writeFileSync(BASELINE, JSON.stringify(current, null, '\t') + '\n');
		console.log(`wrote ${BASELINE}`);
		process.exit(0);
	}
	const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
	console.log('| Page | Perf | A11y | Best pr. | SEO | LCP | TBT | CLS | Runs |');
	console.log('|---|---|---|---|---|---|---|---|---|');
	const regressions = [];
	for (const [p, r] of Object.entries(current)) {
		console.log(
			`| ${p} | ${r.performance} | ${r.accessibility} | ${r['best-practices']} | ${r.seo} | ${r.lcpMs} ms | ${r.tbtMs} ms | ${r.cls} | ${r.runs} |`
		);
		const b = base[p];
		if (!b) continue; // a new page sets its own baseline on the next --update
		for (const c of CATEGORIES) {
			if (r[c] < b[c] - MARGIN[c])
				regressions.push(`${p} ${c}: ${r[c]} < baseline ${b[c]} - ${MARGIN[c]}`);
		}
	}
	if (regressions.length) {
		console.error('\nLighthouse regressions beyond the noise margin:\n' + regressions.join('\n'));
		process.exit(1);
	}
	console.log('\nno regression beyond the noise margin');
}
