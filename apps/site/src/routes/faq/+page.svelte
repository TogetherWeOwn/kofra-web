<script lang="ts">
	import { FAQ } from '@kofra/ui';
	import PageHead from '#lib/components/PageHead.svelte';
	import { FAQ_DATA, FAQ_GENERAL, FAQ_PRICING } from '#lib/content.js';
	import { FAQ_PAGE } from '#lib/pages/misc.js';

	const groups = [
		{ id: 'general', heading: 'General', items: FAQ_GENERAL },
		{ id: 'pricing', heading: 'Pricing and billing', items: FAQ_PRICING },
		{ id: 'data', heading: 'Your data', items: FAQ_DATA }
	];
</script>

<PageHead heading={FAQ_PAGE.heading} lead={FAQ_PAGE.lead} />

<div class="wrap groups">
	{#each groups as g (g.id)}
		<section class="faq-grid" aria-labelledby="{g.id}-h">
			<div><h2 id="{g.id}-h">{g.heading}</h2></div>
			<FAQ items={g.items} />
		</section>
	{/each}
</div>

<style>
	.groups {
		display: grid;
		gap: var(--space-14);
		padding-top: var(--space-10);
		padding-bottom: var(--space-24);
	}
	h2 {
		margin: 0;
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-semibold);
		line-height: var(--font-line-height-snug);
	}
</style>
