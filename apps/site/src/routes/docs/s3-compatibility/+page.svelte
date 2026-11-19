<script lang="ts">
	import ProsePage from '#lib/components/ProsePage.svelte';
	import { S3, S3_BLOCKS } from '#lib/pages/s3.js';
</script>

<ProsePage
	heading={S3.heading}
	description={S3.description}
	lead={S3.lead}
	blocks={S3_BLOCKS}
	toc
/>
