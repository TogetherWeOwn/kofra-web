<script lang="ts">
	import ProsePage from '#lib/components/ProsePage.svelte';
	import { DOCS, DOCS_BLOCKS } from '#lib/pages/docs.js';
</script>

<ProsePage heading={DOCS.heading} lead={DOCS.lead} blocks={DOCS_BLOCKS} toc />
