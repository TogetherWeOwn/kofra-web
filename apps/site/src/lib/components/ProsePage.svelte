<script lang="ts">
	import { Callout } from '@kofra/ui';
	import { headingId, plain, type Block, type Tone } from '#lib/blocks.js';
	import Blocks from './Blocks.svelte';
	import PageHead from './PageHead.svelte';

	type Props = {
		heading: string;
		lead?: string;
		blocks: Block[];
		/** Show an "On this page" list of the h2 sections beside the text (wide screens) or above it. */
		toc?: boolean;
		/** A note under the lead, for example the draft notice. Also in the Markdown twin. */
		notice?: { tone: Tone; title: string; text: string };
	};

	let { heading, lead, blocks, toc = false, notice }: Props = $props();
	const sections = $derived(
		blocks.flatMap((b) => (b.type === 'h2' ? [{ id: headingId(b), text: plain(b.text) }] : []))
	);
</script>

<PageHead {heading} {lead}>
	{#if notice}<Callout tone={notice.tone} title={notice.title}><p>{notice.text}</p></Callout>{/if}
</PageHead>

<div class="wrap body" class:with-toc={toc}>
	{#if toc}
		<nav class="toc" aria-label="On this page" data-twin-skip>
			<p class="toc-h">On this page</p>
			<ul>
				{#each sections as s (s.id)}<li><a href="#{s.id}">{s.text}</a></li>{/each}
			</ul>
		</nav>
	{/if}
	<div class="prose">
		<Blocks {blocks} />
	</div>
</div>

<style>
	.body {
		padding-top: var(--space-8);
		padding-bottom: var(--space-24);
	}
	.with-toc {
		display: grid;
		grid-template-columns: 220px minmax(0, 1fr);
		gap: var(--space-14);
		align-items: start;
	}
	.toc {
		position: sticky;
		top: var(--space-6);
		font-size: var(--font-size-sm);
	}
	.toc-h {
		margin: 0 0 var(--space-2);
		font-weight: var(--font-weight-semibold);
		color: var(--color-muted);
	}
	.toc ul {
		margin: 0;
		padding: 0;
		list-style: none;
		border-left: 1px solid var(--color-line);
	}
	.toc a {
		display: block;
		padding: 6px 0 6px var(--space-3);
		color: var(--color-ink-2);
		text-decoration: none;
	}
	.toc a:hover {
		color: var(--color-ink);
		text-decoration: underline;
	}
	.prose :global(h2:first-child),
	.prose :global(.note:first-child + h2) {
		margin-top: var(--space-6);
	}
	.prose :global(h2),
	.prose :global(h3) {
		scroll-margin-top: var(--space-6);
	}
	@media (max-width: 860px) {
		.with-toc {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-6);
		}
		.toc {
			position: static;
		}
	}
</style>
