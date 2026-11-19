<script lang="ts">
	import type { Snippet } from 'svelte';
	import Logo from './Logo.svelte';
	import type { FooterColumn } from './types.js';

	type Props = {
		columns: FooterColumn[];
		tagline: string;
		homeHref?: string;
		/** The bottom row: copyright and small print. */
		bottom?: Snippet;
	};

	let { columns, tagline, homeHref = '/', bottom }: Props = $props();
</script>

<footer class="ft">
	<div class="in">
		<div class="grid">
			<div class="brand">
				<Logo href={homeHref} />
				<p>{tagline}</p>
			</div>
			{#each columns as col (col.heading)}
				<div>
					<h2>{col.heading}</h2>
					<ul>
						{#each col.links as link (link.href)}
							<li><a href={link.href}>{link.label}</a></li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
		{#if bottom}<div class="bottom">{@render bottom()}</div>{/if}
	</div>
</footer>

<style>
	.ft {
		background: var(--color-band);
		border-top: 1px solid var(--color-line);
		padding: var(--space-14) 0 var(--space-8);
		font-size: var(--font-size-sm);
	}
	.in {
		max-width: var(--size-container);
		margin: 0 auto;
		padding: 0 var(--space-6);
	}
	.grid {
		display: grid;
		/* The brand column is twice as wide; one equal column per link group, however many there are. */
		grid-template-columns: 2fr;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: var(--space-8);
	}
	.brand p {
		color: var(--color-muted);
		margin: var(--space-3) 0 0;
	}
	h2 {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		margin: 0 0 var(--space-3);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--space-2);
	}
	a {
		color: var(--color-ink-2);
		text-decoration: none;
	}
	a:hover {
		color: var(--color-ink);
		text-decoration: underline;
	}
	.bottom {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
		margin-top: var(--space-12);
		padding-top: var(--space-6);
		border-top: 1px solid var(--color-line);
		color: var(--color-muted);
	}
	.bottom :global(p) {
		margin: 0;
	}
	.bottom :global(a) {
		color: var(--color-ink-2);
	}
	@media (max-width: 1000px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			grid-auto-flow: row;
		}
		.brand {
			grid-column: 1 / -1;
		}
	}
	@media (max-width: 640px) {
		.in {
			padding: 0 var(--space-5);
		}
		.bottom {
			flex-direction: column;
		}
	}
</style>
