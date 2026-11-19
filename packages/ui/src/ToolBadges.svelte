<script lang="ts">
	import type { Tool } from './types.js';

	type Props = {
		tools: Tool[];
		/** Visible heading of the strip. */
		heading?: string;
		/** id for the heading, so the surrounding section can be labelled by it. */
		headingId?: string;
	};

	let { tools, heading = 'Works with', headingId }: Props = $props();
</script>

<!-- Tool names set in type with a generic icon: no third-party logos. -->
<div class="strip">
	<h2 id={headingId}>{heading}</h2>
	<ul>
		{#each tools as tool (tool.name)}
			{@const Icon = tool.icon}
			<li>
				<Icon size={18} strokeWidth={1.75} /><span>{tool.name}</span>{#if tool.note}<span
						class="note"
					>
						({tool.note})
					</span>{/if}
			</li>
		{/each}
	</ul>
</div>

<style>
	.strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-8);
	}
	h2 {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--color-muted);
		line-height: var(--font-line-height-body);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3) var(--space-8);
	}
	li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: var(--font-weight-medium);
		font-size: var(--font-size-base);
	}
	li :global(svg) {
		flex: none;
		color: var(--color-muted);
	}
	.note {
		color: var(--color-muted);
		font-weight: var(--font-weight-regular);
		font-size: var(--font-size-sm);
	}
</style>
