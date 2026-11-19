<script lang="ts">
	import type { Feature, HeadingLevel } from './types.js';

	type Props = {
		items: Feature[];
		/** `cards`: bordered cards with the icon on top. `list`: icon beside the text, no border. */
		variant?: 'cards' | 'list';
		headingLevel?: HeadingLevel;
	};

	let { items, variant = 'cards', headingLevel = 3 }: Props = $props();
</script>

<ul class="grid {variant}">
	{#each items as item (item.title)}
		{@const Icon = item.icon}
		<li>
			<Icon class="ic" size={variant === 'cards' ? 24 : 22} strokeWidth={1.75} />
			<div>
				<svelte:element this={`h${headingLevel}`}>{item.title}</svelte:element>
				<p>{item.body}</p>
			</div>
		</li>
	{/each}
</ul>

<style>
	.grid {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.cards {
		gap: var(--space-6);
	}
	.cards li {
		padding: var(--space-6);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
	}
	.cards :global(.ic) {
		margin-bottom: var(--space-4);
	}
	.list {
		gap: var(--space-8) var(--space-10);
	}
	.list li {
		display: flex;
		gap: 14px;
	}
	.list :global(.ic) {
		margin-top: 2px;
	}
	li :global(.ic) {
		display: block;
		flex: none;
		color: var(--color-accent);
	}
	li > div > :global(*:first-child) {
		margin: 0 0 6px;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		line-height: var(--font-line-height-heading);
	}
	p {
		margin: 0;
		color: var(--color-ink-2);
		font-size: var(--font-size-md);
	}
	@media (max-width: 1000px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 640px) {
		.grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
