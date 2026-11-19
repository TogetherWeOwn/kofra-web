<script lang="ts">
	import ProsePage from '#lib/components/ProsePage.svelte';
	import { PRIVACY, PRIVACY_BLOCKS } from '#lib/pages/legal.js';
</script>

<ProsePage
	heading={PRIVACY.heading}
	lead={PRIVACY.lead}
	notice={PRIVACY.notice}
	blocks={PRIVACY_BLOCKS}
/>
