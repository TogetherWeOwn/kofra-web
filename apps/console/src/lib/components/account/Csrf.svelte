<script lang="ts">
	import { page } from '$app/state';
</script>

{#if page.data.csrf}<input type="hidden" name="_csrf" value={page.data.csrf} />{/if}
