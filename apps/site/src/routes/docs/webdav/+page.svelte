<script lang="ts">
	import ProsePage from '#lib/components/ProsePage.svelte';
	import { WEBDAV, WEBDAV_BLOCKS } from '#lib/pages/webdav.js';
</script>

<ProsePage heading={WEBDAV.heading} lead={WEBDAV.lead} blocks={WEBDAV_BLOCKS} toc />
