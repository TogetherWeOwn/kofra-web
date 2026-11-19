<script lang="ts">
	import PageHead from '#lib/components/PageHead.svelte';
	import { LICENCE_WORKS, LICENCES } from '#lib/pages/misc.js';
	const works = LICENCE_WORKS;
</script>

<PageHead heading={LICENCES.heading} lead={LICENCES.lead} />

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
