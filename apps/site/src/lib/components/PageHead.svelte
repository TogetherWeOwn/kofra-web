<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		heading: string;
		lead?: string;
		/** Content under the lead, for example a note. */
		children?: Snippet;
	};

	let { heading, lead, children }: Props = $props();
</script>

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
