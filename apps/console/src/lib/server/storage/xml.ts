// Minimal readers for the flat XML answers of the S3 API. Workers have no DOMParser; the
// response shapes are fixed and none of the elements read here nest inside themselves.

export function decodeEntities(s: string): string {
	return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
		switch (e) {
			case 'amp':
				return '&';
			case 'lt':
				return '<';
			case 'gt':
				return '>';
			case 'quot':
				return '"';
			case 'apos':
				return "'";
			default: {
				const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
				try {
					return String.fromCodePoint(cp);
				} catch {
					return '';
				}
			}
		}
	});
}

/** Inner text of every `<tag>...</tag>` (raw, not decoded). */
export function blocks(xml: string, tag: string): string[] {
	const out: string[] = [];
	const open = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'g');
	const close = `</${tag}>`;
	let m: RegExpExecArray | null;
	while ((m = open.exec(xml))) {
		const start = m.index + m[0].length;
		const end = xml.indexOf(close, start);
		if (end < 0) break;
		out.push(xml.slice(start, end));
		open.lastIndex = end + close.length;
	}
	return out;
}

/** Decoded text of the first `<tag>`, or `undefined`. */
export function text(xml: string, tag: string): string | undefined {
	const b = blocks(xml, tag);
	return b.length ? decodeEntities(b[0]!) : undefined;
}

export function escapeXml(s: string): string {
	return s.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!
	);
}

/** Removes every `<tag>...</tag>` block (to read top-level fields). */
export function strip(xml: string, tag: string): string {
	return xml.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, 'g'), '');
}
