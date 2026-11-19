<script lang="ts">
	import { Callout } from '@kofra/ui';
	import ProsePage from '#lib/components/ProsePage.svelte';
	import { DRAFT_NOTICE, PRIVACY, PRIVACY_BLOCKS } from '#lib/pages/legal.js';
</script>

<ProsePage heading={PRIVACY.heading} lead={PRIVACY.lead} blocks={PRIVACY_BLOCKS}>
	{#snippet notice()}
		<Callout tone="draft" title="Draft, not in force."><p>{DRAFT_NOTICE}</p></Callout>
	{/snippet}
</ProsePage>
