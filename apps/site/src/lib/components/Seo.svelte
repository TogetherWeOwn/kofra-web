<script lang="ts">
	import { graphFor, serialise } from '#lib/jsonld.js';
	import { canonical, twinPath, type PageEntry } from '#lib/registry.js';
	import { INDEXABLE, SITE } from '#lib/site.js';

	let { entry }: { entry: PageEntry } = $props();

	const url = $derived(canonical(entry.path));
	const image = `${SITE.origin}${SITE.ogImage}`;
	// Inline data block, not script: CSP script-src does not apply and browsers never run it.
	// The closing tag is split so the Svelte parser does not end this <script> block early.
	const jsonLd = $derived(
		`<script type="application/ld+json">${serialise(graphFor(entry))}<${'/'}script>`
	);
</script>

<svelte:head>
	<title>{entry.title}</title>
	<meta name="description" content={entry.description} />
	{#if !INDEXABLE}<meta name="robots" content="noindex" />{/if}
	<link rel="canonical" href={url} />
	<link rel="alternate" type="text/markdown" href={twinPath(entry.path)} title="Markdown version" />
	<meta property="og:type" content={entry.kind === 'docs' ? 'article' : 'website'} />
	<meta property="og:site_name" content={SITE.name} />
	<meta property="og:title" content={entry.title} />
	<meta property="og:description" content={entry.description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Kofra: S3-compatible cloud storage" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={entry.title} />
	<meta name="twitter:description" content={entry.description} />
	<meta name="twitter:image" content={image} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD built from our own content; "<" is escaped by serialise() -->
	{@html jsonLd}
</svelte:head>
