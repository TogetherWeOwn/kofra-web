<script lang="ts">
	import type { Snippet } from 'svelte';
	import Menu from '@lucide/svelte/icons/menu';
	import Logo from './Logo.svelte';
	import { currentState } from './current.js';
	import type { NavItem } from './types.js';

	type Props = {
		items: NavItem[];
		/** Path of the current page: its link gets aria-current="page", a containing section "true". */
		current: string;
		homeHref?: string;
		/**
		 * Calls to action at the right (for example the primary button). Rendered twice, in the bar and
		 * in the phone menu (only one is visible at a time), so it must not contain `id` attributes.
		 */
		actions?: Snippet;
		/** Small controls that stay in the bar on every width (for example the theme toggle). */
		utility?: Snippet;
	};

	let { items, current, homeHref = '/', actions, utility }: Props = $props();
</script>

{#snippet list()}
	<ul>
		{#each items as item (item.href)}
			<li>
				<a href={item.href} aria-current={currentState(item.href, current)}>
					{item.label}
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

<!-- One top bar. Desktop shows the links inline; phones get a native disclosure, so the menu needs no script. -->
<header class="hd">
	<div class="in">
		<Logo href={homeHref} />
		<nav class="desk links" aria-label="Main">{@render list()}</nav>
		<div class="right">
			{#if actions}<div class="desk act">{@render actions()}</div>{/if}
			{#if utility}{@render utility()}{/if}
			<details class="mob">
				<summary><Menu size={18} strokeWidth={1.75} /><span>Menu</span></summary>
				<div class="panel">
					<nav class="links" aria-label="Main">{@render list()}</nav>
					{#if actions}<div class="act">{@render actions()}</div>{/if}
				</div>
			</details>
		</div>
	</div>
</header>

<style>
	.hd {
		position: relative;
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-line);
	}
	.in {
		display: flex;
		align-items: center;
		gap: 40px;
		min-height: var(--size-header);
		max-width: var(--size-container);
		margin: 0 auto;
		padding: 0 var(--space-6);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		gap: 28px;
	}
	.links a {
		color: var(--color-ink-2);
		text-decoration: none;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-medium);
		padding: var(--space-2) 0;
	}
	.links a:hover,
	.links a[aria-current] {
		color: var(--color-ink);
		text-decoration: underline;
		text-underline-offset: 6px;
	}
	.right {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		margin-left: auto;
	}
	.act {
		display: flex;
		align-items: center;
		gap: var(--space-5);
	}
	.mob {
		display: none;
	}
	summary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: var(--size-control-md);
		padding: 6px 10px;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-sm);
		font-weight: var(--font-weight-medium);
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		border-color: var(--color-ink);
	}

	@media (max-width: 860px) {
		.in {
			gap: var(--space-2);
			padding: 0 var(--space-5);
		}
		.desk {
			display: none;
		}
		.right {
			gap: var(--space-2);
		}
		.mob {
			display: block;
		}
		.panel {
			position: absolute;
			z-index: 20;
			top: 100%;
			left: 0;
			right: 0;
			padding: var(--space-2) var(--space-5) var(--space-5);
			background: var(--color-bg);
			border-bottom: 1px solid var(--color-border-strong);
		}
		.panel ul {
			flex-direction: column;
			gap: 0;
		}
		.panel .links a {
			display: block;
			padding: var(--space-3) 0;
			border-bottom: 1px solid var(--color-line);
		}
		.panel .act {
			margin: var(--space-4) 0 0;
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-3);
		}
	}
</style>
