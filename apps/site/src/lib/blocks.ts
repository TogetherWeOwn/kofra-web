// A small content model for prose pages (docs, security, legal). The same blocks render to HTML
// (Blocks.svelte) and to Markdown (toMarkdown), so the two can never drift apart.
//
// Inline text supports three marks only: `code`, [text](href) and **bold**.

export type Tone = 'info' | 'warning' | 'draft';

export type Block =
	| { type: 'h2'; text: string; id?: string }
	| { type: 'h3'; text: string; id?: string }
	| { type: 'p'; text: string }
	| { type: 'ul'; items: string[] }
	| { type: 'ol'; items: string[] }
	| { type: 'code'; code: string; title?: string; lang?: string }
	| { type: 'table'; caption: string; head: string[]; rows: string[][] }
	| { type: 'note'; tone: Tone; title?: string; text: string }
	| { type: 'dl'; items: [term: string, value: string][] };

export type Inline =
	| { t: 'text'; v: string }
	| { t: 'code'; v: string }
	| { t: 'strong'; v: string }
	| { t: 'link'; v: string; href: string };

const INLINE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;

/** Splits inline text into text, code, strong and link tokens. */
export function parseInline(src: string): Inline[] {
	const out: Inline[] = [];
	let last = 0;
	for (const m of src.matchAll(INLINE)) {
		const at = m.index;
		if (at > last) out.push({ t: 'text', v: src.slice(last, at) });
		if (m[1] !== undefined) out.push({ t: 'code', v: m[1] });
		else if (m[2] !== undefined && m[3] !== undefined) out.push({ t: 'link', v: m[2], href: m[3] });
		else if (m[4] !== undefined) out.push({ t: 'strong', v: m[4] });
		last = at + m[0].length;
	}
	if (last < src.length) out.push({ t: 'text', v: src.slice(last) });
	return out;
}

/** Plain text of inline markup, for headings in navigation and structured data. */
export const plain = (src: string) =>
	parseInline(src)
		.map((tok) => tok.v)
		.join('');

/** Slug for a heading id: lower case, words joined by hyphens. */
export const slug = (text: string) =>
	plain(text)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

export const headingId = (b: { text: string; id?: string }) => b.id ?? slug(b.text);

/** Turns a site-relative link into an absolute one, so Markdown read on its own still resolves. */
export function absolutise(src: string, origin: string): string {
	return src.replace(/\]\((\/[^)\s]*)\)/g, (_, path: string) => `](${origin}${path})`);
}

/** A GFM table cell: backslashes and pipes are escaped (backslash first), newlines become spaces. */
export const cell = (s: string) => s.replace(/[\\|]/g, '\\$&').replace(/\n/g, ' ');

/** Markdown for a list of blocks. Inline markup is already Markdown, so it passes through. */
export function toMarkdown(blocks: Block[], origin: string): string {
	const inline = (s: string) => absolutise(s, origin);
	return blocks
		.map((b) => {
			switch (b.type) {
				case 'h2':
					return `## ${inline(b.text)}`;
				case 'h3':
					return `### ${inline(b.text)}`;
				case 'p':
					return inline(b.text);
				case 'ul':
					return b.items.map((i) => `- ${inline(i)}`).join('\n');
				case 'ol':
					return b.items.map((i, n) => `${n + 1}. ${inline(i)}`).join('\n');
				case 'code':
					return `${b.title ? `${b.title}:\n\n` : ''}\`\`\`${b.lang ?? ''}\n${b.code}\n\`\`\``;
				case 'table':
					return [
						`| ${b.head.map(cell).join(' | ')} |`,
						`| ${b.head.map(() => '---').join(' | ')} |`,
						...b.rows.map((r) => `| ${r.map((c) => cell(inline(c))).join(' | ')} |`)
					].join('\n');
				case 'note':
					return `> ${b.title ? `**${b.title}** ` : ''}${inline(b.text)}`;
				case 'dl':
					return b.items.map(([t, v]) => `- **${t}:** ${inline(v)}`).join('\n');
			}
		})
		.join('\n\n');
}
