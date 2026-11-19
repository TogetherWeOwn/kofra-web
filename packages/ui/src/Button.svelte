<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Common = {
		variant?: 'primary' | 'secondary';
		size?: 'md' | 'lg';
		/** Full width of the container. */
		block?: boolean;
		children: Snippet;
		class?: string;
	};
	type Props =
		| (Common & { href: string } & Omit<HTMLAnchorAttributes, 'href' | 'class' | 'children'>)
		| (Common & { href?: undefined } & Omit<HTMLButtonAttributes, 'class' | 'children'>);

	let {
		variant = 'primary',
		size = 'md',
		block = false,
		children,
		class: cls = '',
		...rest
	}: Props = $props();

	const classes = $derived(['btn', variant, size, block && 'block', cls].filter(Boolean).join(' '));
</script>

<!-- A link when it navigates, a button when it acts; never a link styled as a button that acts. -->
{#if rest.href !== undefined}
	<a class={classes} {...rest as HTMLAnchorAttributes}>{@render children()}</a>
{:else}
	<button type="button" class={classes} {...rest as HTMLButtonAttributes}>
		{@render children()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--size-control-md);
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-medium);
		line-height: var(--font-line-height-snug);
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
	}
	.btn :global(svg) {
		width: 16px;
		height: 16px;
		flex: none;
	}
	.lg {
		min-height: var(--size-control-lg);
		padding: 10px var(--space-5);
		font-size: var(--font-size-base);
	}
	.block {
		width: 100%;
	}
	.primary {
		background: var(--color-accent);
		color: var(--color-accent-ink);
	}
	.primary:hover {
		background: var(--color-accent-hover);
	}
	.secondary {
		background: var(--color-surface);
		color: var(--color-ink);
		border-color: var(--color-border-strong);
	}
	.secondary:hover {
		border-color: var(--color-ink);
	}
	button:disabled {
		color: var(--color-muted);
		border-color: var(--color-line);
		background: var(--color-surface);
		cursor: not-allowed;
	}
	@media (forced-colors: active) {
		.btn {
			border: 1px solid ButtonText;
		}
	}
</style>
