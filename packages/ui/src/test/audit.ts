// Test helper: renders a component on the server, places it in a small valid
// page and runs axe-core on it in jsdom. jsdom has no layout, so colour
// contrast is not checked here: the token contrast tests and the site's
// Playwright axe run (real browser, both themes) cover it.
import axe from 'axe-core';
import { JSDOM } from 'jsdom';
import { createRawSnippet, type Component, type Snippet } from 'svelte';
import { render } from 'svelte/server';

export interface Audit {
	document: Document;
	html: string;
	/** axe violations as "rule-id (impact): first failing node" strings, so failures read well. */
	violations: string[];
}

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** A snippet that renders fixed HTML, for children and other snippet props. */
export const html = (markup: string): Snippet => createRawSnippet(() => ({ render: () => markup }));

export async function audit<P extends Record<string, unknown>>(
	component: Component<P>,
	props: P,
	opts: { landmark?: 'main' | 'page' } = {}
): Promise<Audit> {
	const { body } = render(component as Component<Record<string, unknown>>, { props });
	// `main`: the component sits inside <main> after the page heading.
	// `page`: the component is itself a landmark (header, footer) and sits beside <main>.
	const content =
		opts.landmark === 'page'
			? `${body}<main><h1>Test page</h1></main>`
			: `<main><h1>Test page</h1>${body}</main>`;
	const dom = new JSDOM(
		`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Test page</title></head><body>${content}</body></html>`,
		{ runScripts: 'outside-only', pretendToBeVisual: true }
	);
	const win = dom.window as unknown as Window & { eval(src: string): void; axe: typeof axe };
	win.eval(axe.source);
	const results = await win.axe.run(win.document, {
		runOnly: { type: 'tag', values: TAGS },
		rules: { 'color-contrast': { enabled: false } }
	});
	return {
		document: win.document,
		html: body,
		violations: results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes[0]?.html ?? ''}`)
	};
}
