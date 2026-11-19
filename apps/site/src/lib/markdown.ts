// Markdown twins of the structured pages (home, pricing, FAQ, security, licences). Prose pages use
// toMarkdown(blocks) directly. Everything reads the same content modules as the HTML templates.
import { absolutise, toMarkdown, type Block, type Tone } from '#lib/blocks.js';
import {
	COMPARE,
	EARLY_ACCESS,
	EXAMPLE_BILL,
	EXAMPLE_NOTE,
	FAQ_DATA,
	FAQ_GENERAL,
	FAQ_HOME,
	FAQ_PRICING,
	FEATURES,
	PLANS,
	PLAN_SUMMARY,
	SECURITY,
	TOOL_EXAMPLES,
	TOOLS,
	money
} from '#lib/content.js';
import { HOME } from '#lib/pages/home.js';
import { FAQ_PAGE, LICENCES, SECURITY_BLOCKS, SECURITY_PAGE } from '#lib/pages/misc.js';
import { PRICING } from '#lib/pages/pricing.js';
import { SITE } from '#lib/site.js';

const O = SITE.origin;
const cell = (v: string | boolean) =>
	(v === true ? 'Included' : v === false ? 'Not included' : v).replace(/\|/g, '\\|');
const table = (head: string[], rows: string[][]) =>
	[
		`| ${head.join(' | ')} |`,
		`| ${head.map(() => '---').join(' | ')} |`,
		...rows.map((r) => `| ${r.join(' | ')} |`)
	].join('\n');
const faq = (items: { q: string; a: string }[], level = '###') =>
	items.map((f) => `${level} ${f.q}\n\n${f.a}`).join('\n\n');

/** The page title, its lead and the body, as one Markdown document. */
export const doc = (heading: string, lead: string | undefined, body: string) =>
	`# ${heading}\n\n${lead ? `${lead}\n\n` : ''}${body.trim()}\n`;

export const prose = (
	heading: string,
	lead: string | undefined,
	blocks: Block[],
	notice?: { tone: Tone; title: string; text: string }
) => doc(heading, lead, toMarkdown(notice ? [{ type: 'note', ...notice }, ...blocks] : blocks, O));

export function homeMarkdown(): string {
	const h = HOME;
	return doc(
		h.hero.heading,
		h.hero.lead,
		[
			h.hero.proof.map((p) => `- ${p}`).join('\n'),
			`_${h.hero.fine}_ [Get early access](${O}${EARLY_ACCESS}) · [Pricing](${O}/pricing)`,
			`## Works with\n\n${TOOLS.map((t) => `- ${t.name}${t.note ? ` (${t.note})` : ''}`).join('\n')}`,
			`## ${h.features.heading}\n\n${h.features.lead}\n\n${FEATURES.map((f) => `- **${f.title}:** ${f.body}`).join('\n')}`,
			`## ${h.s3.heading}\n\n${h.s3.lead}\n\n${h.s3.facts.map(([k, v]) => `- **${k}:** ${v}`).join('\n')}\n\n` +
				TOOL_EXAMPLES.map(
					(t) => `### ${t.name} (${t.kind})\n\n${t.blurb}\n\n\`\`\`sh\n${t.code}\n\`\`\``
				).join('\n\n') +
				`\n\nFull guides: [documentation](${O}/docs).`,
			`## ${h.pricing.heading}\n\n${h.pricing.lead} ${EXAMPLE_NOTE}\n\n` +
				table(
					['Plan', 'Storage', 'Downloads', 'API requests', 'Smallest bill'],
					PLAN_SUMMARY.map((r) => [r.label, ...r.values.map(cell)])
				) +
				`\n\nDetails: [pricing](${O}/pricing).`,
			`## ${h.security.heading}\n\n${h.security.lead}\n\n${SECURITY.map((s) => `- **${s.title}:** ${s.body}`).join('\n')}`,
			`## ${h.faq.heading}\n\n${faq(FAQ_HOME)}\n\nAll questions: [FAQ](${O}/faq).`,
			`## ${h.cta.heading}\n\n${h.cta.lead}`
		].join('\n\n')
	);
}

export function pricingMarkdown(): string {
	return doc(
		PRICING.heading,
		PRICING.lead,
		[
			`> ${EXAMPLE_NOTE}`,
			'## Plans',
			PLANS.map(
				(p) =>
					`### ${p.name}: ${p.price} ${p.unit}\n\n${p.blurb}\n\n${p.features.map((f) => `- ${f}`).join('\n')}`
			).join('\n\n'),
			'## Compare plans',
			table(
				['Feature', ...PLANS.map((p) => p.name)],
				COMPARE.map((r) => [r.label, ...r.values.map(cell)])
			),
			`## ${EXAMPLE_BILL.title}`,
			table(
				['Item', 'Usage', 'Amount'],
				[
					...EXAMPLE_BILL.lines.map((l) => [l.item, l.usage, money(l.amount)]),
					['**Total for the month**', '', `**${money(EXAMPLE_BILL.total)}**`]
				]
			),
			`## ${PRICING.how.heading}\n\n${PRICING.how.lines.map((l) => `- ${l}`).join('\n')}`,
			`## ${PRICING.faqHeading}\n\n${faq(FAQ_PRICING)}`
		].join('\n\n')
	);
}

export function faqMarkdown(): string {
	return doc(
		FAQ_PAGE.heading,
		absolutise(FAQ_PAGE.lead, O),
		[
			`## General\n\n${faq(FAQ_GENERAL)}`,
			`## Pricing and billing\n\n${faq(FAQ_PRICING)}`,
			`## Your data\n\n${faq(FAQ_DATA)}`
		].join('\n\n')
	);
}

export function securityMarkdown(): string {
	return doc(
		SECURITY_PAGE.heading,
		SECURITY_PAGE.lead,
		`## ${SECURITY_PAGE.protectionsHeading}\n\n${SECURITY.map((s) => `- **${s.title}:** ${s.body}`).join('\n')}\n\n` +
			toMarkdown(SECURITY_BLOCKS, O)
	);
}

export function licencesMarkdown(works: { name: string; use: string; licence: string }[]): string {
	return doc(
		LICENCES.heading,
		LICENCES.lead,
		works.map((w) => `- **${w.name}** (${w.use}): ${w.licence}`).join('\n') +
			`\n\nThe full licence texts are on the [licences page](${O}/licences).`
	);
}
