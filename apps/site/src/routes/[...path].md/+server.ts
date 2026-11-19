// Markdown twins: every page is also served as clean Markdown at <path>.md ("/" at /index.md).
// Prerendered from the same content modules as the HTML (see src/lib/registry.ts).
import { error } from '@sveltejs/kit';
import { PAGES, twinDocument, twinPath } from '#lib/registry.js';

export const prerender = true;

const byTwin = new Map(PAGES.map((p) => [twinPath(p.path), p]));

export function entries() {
	return PAGES.map((p) => ({ path: twinPath(p.path).slice(1, -'.md'.length) }));
}

export function GET({ params }: { params: { path: string } }) {
	const entry = byTwin.get(`/${params.path}.md`);
	if (!entry) error(404, 'Not found');
	return new Response(twinDocument(entry), {
		headers: { 'content-type': 'text/markdown; charset=utf-8' }
	});
}
