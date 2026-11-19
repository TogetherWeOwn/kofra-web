<script lang="ts">
	import { FeatureGrid } from '@kofra/ui';
	import Blocks from '#lib/components/Blocks.svelte';
	import PageHead from '#lib/components/PageHead.svelte';
	import { SECURITY } from '#lib/content.js';
	import { SECURITY_BLOCKS, SECURITY_PAGE } from '#lib/pages/misc.js';
</script>

<PageHead heading={SECURITY_PAGE.heading} lead={SECURITY_PAGE.lead} />

<section class="sec sec-tight" aria-labelledby="prot-h">
	<div class="wrap">
		<h2 id="prot-h" class="h2-sm">{SECURITY_PAGE.protectionsHeading}</h2>
		<FeatureGrid items={SECURITY} />
	</div>
</section>

<div class="wrap prose tail">
	<Blocks blocks={SECURITY_BLOCKS} />
</div>

<style>
	.tail {
		padding-bottom: var(--space-24);
	}
</style>
