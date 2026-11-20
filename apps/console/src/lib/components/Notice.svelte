<script lang="ts">
	import type { Snippet } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Info from '@lucide/svelte/icons/info';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let {
		tone = 'info',
		title,
		live = false,
		children
	}: {
		tone?: 'info' | 'success' | 'warning' | 'danger';
		title?: string;
		/** Announce it (a result of the visitor's own action). */
		live?: boolean;
		children?: Snippet;
	} = $props();

	const Icon = $derived(
		{ info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert }[tone]
	);
</script>

<!-- Tone shows as an icon and a word-bearing title, never as colour alone. -->
<div class="notice {tone}" role={live ? (tone === 'danger' ? 'alert' : 'status') : undefined}>
	<Icon class="icon" aria-hidden="true" />
	<div class="body">
		{#if title}<p class="title">{title}</p>{/if}
		{#if children}<div class="text">{@render children()}</div>{/if}
	</div>
</div>

<style>
	.notice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--color-line);
		border-left-width: 4px;
		border-radius: var(--radius-md);
		background: var(--color-surface);
		font-size: var(--font-size-md);
	}
	.notice :global(.icon) {
		margin-top: 4px;
	}
	.info {
		border-left-color: var(--color-accent);
	}
	.info :global(.icon) {
		color: var(--color-accent-text);
	}
	.success {
		border-left-color: var(--color-success);
	}
	.success :global(.icon) {
		color: var(--color-success);
	}
	.warning {
		border-left-color: var(--color-warning);
	}
	.warning :global(.icon) {
		color: var(--color-warning);
	}
	.danger {
		border-left-color: var(--color-danger);
	}
	.danger :global(.icon) {
		color: var(--color-danger);
	}
	.body {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
	}
	.title {
		font-weight: var(--font-weight-semibold);
	}
	.text :global(p + p) {
		margin-top: var(--space-1);
	}
</style>
