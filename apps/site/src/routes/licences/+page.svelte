<script lang="ts">
	import PageHead from '#lib/components/PageHead.svelte';
	import { LICENCES } from '#lib/pages/misc.js';
	import plexSans from '#lib/licences/ibm-plex-sans.txt?raw';
	import plexMono from '#lib/licences/ibm-plex-mono.txt?raw';
	import lucide from '#lib/licences/lucide.txt?raw';

	const works = [
		{
			id: 'plex-sans',
			name: 'IBM Plex Sans',
			use: 'Text typeface',
			licence: 'SIL Open Font License 1.1',
			text: plexSans
		},
		{
			id: 'plex-mono',
			name: 'IBM Plex Mono',
			use: 'Code typeface',
			licence: 'SIL Open Font License 1.1',
			text: plexMono
		},
		{ id: 'lucide', name: 'Lucide', use: 'Icons', licence: 'ISC License', text: lucide }
	];
</script>

<PageHead heading={LICENCES.heading} description={LICENCES.description} lead={LICENCES.lead} />

<div class="wrap body">
	{#each works as w (w.id)}
		<section aria-labelledby="{w.id}-h">
			<h2 id="{w.id}-h">{w.name}</h2>
			<p>{w.use}. {w.licence}.</p>
			<pre>{w.text}</pre>
		</section>
	{/each}
</div>

<style>
	.body {
		display: grid;
		gap: var(--space-10);
		padding-top: var(--space-8);
		padding-bottom: var(--space-24);
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-semibold);
	}
	p {
		margin: 0 0 var(--space-3);
		color: var(--color-ink-2);
	}
	pre {
		margin: 0;
		padding: var(--space-4);
		max-width: 80ch;
		background: var(--color-band);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		font-size: var(--font-size-xs);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
