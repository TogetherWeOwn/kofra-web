<script lang="ts">
	import ProsePage from '#lib/components/ProsePage.svelte';
	import WaitlistForm from '#lib/components/WaitlistForm.svelte';
	import { EARLY, EARLY_BLOCKS } from '#lib/pages/misc.js';
	import { WAITLIST } from '#lib/site.js';
</script>

<ProsePage heading={EARLY.heading} lead={EARLY.lead} blocks={EARLY_BLOCKS} />
{#if WAITLIST}
	<div class="wrap"><WaitlistForm /></div>
{/if}
