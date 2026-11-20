<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick, type Snippet } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import LogIn from '@lucide/svelte/icons/log-in';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { Logo, ThemeToggle } from '@kofra/ui';
	import { currentEntry, DOCS_URL, LICENCES_URL, NAV, type Crumb } from '#lib/nav.js';

	let {
		path,
		crumbs = [],
		workspace,
		children
	}: { path: string; crumbs?: Crumb[]; workspace: string; children: Snippet } = $props();

	let open = $state(false);
	let menuButton = $state<HTMLButtonElement>();
	let side = $state<HTMLElement>();

	// On phones the menu opens above the page: move focus into it, and back to the button
	// when Escape closes it, so keyboard users never lose their place.
	async function toggle() {
		open = !open;
		if (open) {
			await tick();
			side?.querySelector<HTMLElement>('nav a')?.focus();
		}
	}
	function onKey(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !open || e.defaultPrevented) return;
		// Only when focus is in the menu or on its button: Escape elsewhere belongs to the page.
		const at = document.activeElement;
		if (at !== menuButton && !(at && side?.contains(at))) return;
		open = false;
		menuButton?.focus();
	}
	const current = $derived(currentEntry(path));
	afterNavigate(() => (open = false));
</script>

<svelte:window onkeydown={onKey} />

<a class="skip-link" href="#main">Skip to content</a>
<div class="app">
	<aside class="side" class:open id="side" aria-label="Console" bind:this={side}>
		<div class="side-top">
			<Logo href={resolve('/(app)')} />
		</div>
		<div class="side-acct">
			<span class="side-acct-l">Workspace</span>
			<span class="side-acct-n">{workspace}</span>
			<span class="side-acct-p">Sample data</span>
		</div>
		<nav aria-label="Console sections">
			<ul>
				{#each NAV as item (item.href)}
					<li>
						<a href={item.href} aria-current={current === item ? 'page' : undefined}>
							<item.icon class="icon" aria-hidden="true" />{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
		<ul class="side-foot">
			<li>
				<a href={DOCS_URL} rel="external">
					<BookOpen class="icon" aria-hidden="true" />Documentation
				</a>
			</li>
			<li><a href={LICENCES_URL} rel="external">Licences</a></li>
			<li>
				<a href={resolve('/(auth)/sign-in')}><LogIn class="icon" aria-hidden="true" />Sign in</a>
			</li>
		</ul>
	</aside>
	<div class="app-main">
		<header class="topbar">
			<button
				class="side-btn"
				type="button"
				aria-expanded={open}
				aria-controls="side"
				onclick={toggle}
				bind:this={menuButton}
			>
				{#if open}<X class="icon" aria-hidden="true" />{:else}<Menu
						class="icon"
						aria-hidden="true"
					/>{/if}
				<span>Menu</span>
			</button>
			{#if crumbs.length}
				<nav class="crumbs" aria-label="Breadcrumb">
					<ol>
						{#each crumbs as c, i (i)}
							<li>
								{#if c.href && i < crumbs.length - 1}<a href={c.href}>{c.label}</a>
								{:else}<span aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
										{c.label}
									</span>{/if}
							</li>
						{/each}
					</ol>
				</nav>
			{/if}
			<div class="top-r"><ThemeToggle /></div>
		</header>
		<main id="main" class="app-content" tabindex="-1">
			{@render children()}
		</main>
	</div>
</div>

<style>
	.app {
		display: grid;
		grid-template-columns: 248px minmax(0, 1fr);
		min-height: 100vh;
		/* The sidebar column keeps its surface below the sticky panel on long pages. */
		background-image: linear-gradient(
			to right,
			var(--color-surface) 247px,
			var(--color-line) 247px,
			var(--color-line) 248px,
			transparent 248px
		);
	}
	.side {
		background: var(--color-surface);
		border-right: 1px solid var(--color-line);
		padding: 18px 14px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		position: sticky;
		top: 0;
		height: 100vh;
		overflow-y: auto;
	}
	.side-top {
		padding: 0 6px;
	}
	.side-acct {
		display: grid;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		padding: 10px 12px;
		font-size: var(--font-size-sm);
	}
	.side-acct-l,
	.side-acct-p {
		font-size: var(--font-size-xs);
		color: var(--color-muted);
	}
	.side-acct-n {
		font-weight: var(--font-weight-semibold);
	}
	.side nav ul,
	.side-foot {
		display: grid;
		gap: 2px;
	}
	.side nav a,
	.side-foot a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: var(--space-2) 10px;
		min-height: 40px;
		border-radius: var(--radius-sm);
		color: var(--color-ink-2);
		text-decoration: none;
		font-size: var(--font-size-md);
	}
	.side nav a:hover,
	.side-foot a:hover {
		background: var(--color-band);
		color: var(--color-ink);
	}
	.side nav a[aria-current='page'] {
		background: var(--color-accent-soft);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
		box-shadow: inset 3px 0 0 var(--color-accent);
	}
	.side-foot {
		margin-top: auto;
		border-top: 1px solid var(--color-line);
		padding-top: var(--space-3);
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		min-height: 56px;
		padding: var(--space-2) var(--space-7);
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-line);
	}
	.side-btn {
		display: none;
		align-items: center;
		gap: 6px;
		background: var(--color-surface);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-sm);
		min-height: 40px;
		padding: 0 var(--space-3);
		cursor: pointer;
	}
	.crumbs ol {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		font-size: var(--font-size-sm);
	}
	.crumbs li {
		overflow-wrap: anywhere;
	}
	.crumbs li + li::before {
		content: '/';
		color: var(--color-muted);
		margin-right: 6px;
	}
	.crumbs a {
		color: var(--color-ink-2);
	}
	.crumbs [aria-current] {
		color: var(--color-ink);
		font-weight: var(--font-weight-medium);
	}
	.top-r {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.app-content {
		padding: var(--space-7);
		display: grid;
		gap: var(--space-5);
		align-content: start;
		max-width: 1280px;
		min-width: 0;
	}
	.app-content:focus {
		outline: none;
	}
	@media (max-width: 900px) {
		.app {
			grid-template-columns: minmax(0, 1fr);
			background-image: none;
		}
		.side {
			position: static;
			height: auto;
			border-right: 0;
			border-bottom: 1px solid var(--color-line);
		}
		/* Once the page is interactive, the menu button shows and hides the navigation;
		   until then (or without script) the navigation stays open. */
		:global(html[data-ready]) .side:not(.open) {
			display: none;
		}
		:global(html[data-ready]) .side-btn {
			display: inline-flex;
		}
		.side-foot {
			margin-top: 0;
		}
		.topbar {
			padding: var(--space-2) var(--space-4);
			flex-wrap: wrap;
		}
		.app-content {
			padding: var(--space-4);
		}
	}
</style>
