<script lang="ts">
	import ProsePage from '#lib/components/ProsePage.svelte';
	import { RCLONE, RCLONE_BLOCKS } from '#lib/pages/rclone.js';
</script>

<ProsePage heading={RCLONE.heading} lead={RCLONE.lead} blocks={RCLONE_BLOCKS} toc />
