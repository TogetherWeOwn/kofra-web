<script lang="ts">
	import type { Snippet } from 'svelte';
	import { pageTitle } from '#lib/site.js';

	type Props = {
		/** The h1, also used in the document title. */
		heading: string;
		description: string;
		lead?: string;
		/** Content under the lead, for example a note. */
		children?: Snippet;
	};

	let { heading, description, lead, children }: Props = $props();
</script>

<svelte:head>
	<title>{pageTitle(heading)}</title>
	<meta name="description" content={description} />
</svelte:head>

<section class="page-head">
	<div class="wrap">
		<h1>{heading}</h1>
		{#if lead}<p class="lead">{lead}</p>{/if}
		{#if children}<div class="extra">{@render children()}</div>{/if}
	</div>
</section>

<style>
	.extra {
		margin-top: var(--space-5);
		display: flex;
	}
</style>
