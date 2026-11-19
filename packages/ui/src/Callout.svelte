<script lang="ts">
	import type { Snippet } from 'svelte';
	import Info from '@lucide/svelte/icons/info';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import FilePen from '@lucide/svelte/icons/file-pen';

	type Props = {
		/** `info`: neutral note. `warning`: something to act on. `draft`: text that is not final. */
		tone?: 'info' | 'warning' | 'draft';
		/** Short bold lead-in, for example "Draft, not in force". */
		title?: string;
		children: Snippet;
	};

	let { tone = 'info', title, children }: Props = $props();
	const Icon = $derived({ info: Info, warning: TriangleAlert, draft: FilePen }[tone]);
</script>

<!-- A note beside the main content; the tone is in the words and the icon, never in colour alone. -->
<div class="callout {tone}" role="note">
	<Icon class="ic" size={18} strokeWidth={1.75} />
	<div class="body">
		{#if title}<strong>{title}</strong>{/if}
		{@render children()}
	</div>
</div>

<style>
	.callout {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 10px 14px;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-left: 3px solid var(--color-accent);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-sm);
		color: var(--color-ink-2);
	}
	.warning,
	.draft {
		border-left-color: var(--color-warning);
	}
	.callout :global(.ic) {
		flex: none;
		margin-top: 2px;
		color: var(--color-accent-text);
	}
	.warning :global(.ic),
	.draft :global(.ic) {
		color: var(--color-warning);
	}
	.body {
		display: grid;
		gap: 2px;
	}
	strong {
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
	}
	.body :global(p) {
		margin: 0;
	}
</style>
