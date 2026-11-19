<script lang="ts">
	import { Callout } from '@kofra/ui';
	import ProsePage from '#lib/components/ProsePage.svelte';
	import { DRAFT_NOTICE, TERMS, TERMS_BLOCKS } from '#lib/pages/legal.js';
</script>

<ProsePage heading={TERMS.heading} lead={TERMS.lead} blocks={TERMS_BLOCKS}>
	{#snippet notice()}
		<Callout tone="draft" title="Draft, not in force."><p>{DRAFT_NOTICE}</p></Callout>
	{/snippet}
</ProsePage>
