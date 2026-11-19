<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { CodeBlock } from '@kofra/ui';
	import { TOOL_EXAMPLES } from '#lib/content.js';
</script>

<!--
	One example per tool, as an exclusive accordion of native disclosures (the first is open).
	Works without script; browsers without exclusive <details> simply allow several open.
-->
<div class="tools">
	{#each TOOL_EXAMPLES as tool, i (tool.id)}
		<details name="tool-example" open={i === 0}>
			<summary>
				<span class="name">{tool.name}</span><span class="kind">{tool.kind}</span><ChevronDown
					class="chev"
					size={18}
					strokeWidth={1.75}
				/>
			</summary>
			<div class="body">
				<p>{tool.blurb}</p>
				<CodeBlock code={tool.code} />
			</div>
		</details>
	{/each}
</div>

<style>
	.tools {
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	details + details {
		border-top: 1px solid var(--color-line);
	}
	summary {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		padding: 14px 18px;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover .name {
		text-decoration: underline;
	}
	.name {
		font-weight: var(--font-weight-semibold);
	}
	.kind {
		color: var(--color-muted);
		font-size: var(--font-size-sm);
	}
	summary :global(.chev) {
		margin-left: auto;
		align-self: center;
		color: var(--color-muted);
		flex: none;
	}
	details[open] summary :global(.chev) {
		transform: rotate(180deg);
	}
	.body {
		padding: 0 18px 18px;
	}
	.body p {
		margin: 0 0 14px;
		color: var(--color-ink-2);
		font-size: var(--font-size-md);
	}
</style>
