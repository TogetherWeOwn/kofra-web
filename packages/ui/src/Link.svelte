<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';

	type Props = Omit<HTMLAnchorAttributes, 'class' | 'children'> & {
		href: string;
		/** `arrow`: a standalone call to action with a trailing arrow, underlined on hover only. */
		variant?: 'inline' | 'arrow';
		children: Snippet;
		class?: string;
	};

	let { href, variant = 'inline', children, class: cls = '', ...rest }: Props = $props();
</script>

<a {href} class={[variant, cls].filter(Boolean).join(' ')} {...rest}>
	{@render children()}{#if variant === 'arrow'}<ArrowRight size={16} strokeWidth={1.75} />{/if}
</a>

<style>
	a {
		color: var(--color-accent-text);
		text-underline-offset: 0.18em;
	}
	.arrow {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: var(--font-weight-medium);
		text-decoration: none;
	}
	.arrow:hover {
		text-decoration: underline;
	}
	.arrow :global(svg) {
		flex: none;
	}
</style>
