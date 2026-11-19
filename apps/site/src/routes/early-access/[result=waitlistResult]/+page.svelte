<script lang="ts">
	import { Link } from '@kofra/ui';
	import { RESULTS } from '#lib/pages/waitlist.js';
	import { pageTitle } from '#lib/site.js';

	let { data } = $props();
	const r = $derived(RESULTS[data.result]);
</script>

<svelte:head>
	<title>{pageTitle(r.heading)}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="page-head">
	<div class="wrap">
		<h1>{r.heading}</h1>
		<p class="lead">{r.lead}</p>
		<p class="back">
			<Link href={data.result === 'confirmed' ? '/legal/privacy' : '/early-access'} variant="arrow">
				{data.result === 'confirmed' ? 'Privacy policy' : 'Back to early access'}
			</Link>
		</p>
	</div>
</section>
<div class="spacer"></div>

<style>
	.back {
		margin: var(--space-6) 0 0;
	}
	.spacer {
		height: var(--space-24);
	}
</style>
