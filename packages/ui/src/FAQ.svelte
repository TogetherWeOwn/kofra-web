<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import type { FaqItem } from './types.js';

	let { items }: { items: FaqItem[] } = $props();
</script>

<!-- Native disclosure widgets: keyboard, screen-reader state and find-in-page work without script. -->
<div class="faq">
	{#each items as item (item.q)}
		<details>
			<summary>
				<span>{item.q}</span><ChevronDown class="chev" size={18} strokeWidth={1.75} />
			</summary>
			<p>{item.a}</p>
		</details>
	{/each}
</div>

<style>
	.faq {
		border-top: 1px solid var(--color-line);
	}
	details {
		border-bottom: 1px solid var(--color-line);
	}
	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		padding: 18px 0;
		font-weight: var(--font-weight-medium);
		font-size: var(--font-size-lg);
		line-height: var(--font-line-height-heading);
		list-style: none;
		cursor: pointer;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover span {
		text-decoration: underline;
	}
	summary :global(.chev) {
		flex: none;
		color: var(--color-muted);
	}
	details[open] summary :global(.chev) {
		transform: rotate(180deg);
	}
	p {
		margin: 0;
		padding: 0 0 var(--space-5);
		color: var(--color-ink-2);
		max-width: 44em;
	}
</style>
