<script lang="ts">
	import ProsePage from '#lib/components/ProsePage.svelte';
	import { TERMS, TERMS_BLOCKS } from '#lib/pages/legal.js';
</script>

<ProsePage heading={TERMS.heading} lead={TERMS.lead} notice={TERMS.notice} blocks={TERMS_BLOCKS} />
