<script lang="ts">
	import { Button } from '@kofra/ui';
	import ActionForm from '#lib/components/account/ActionForm.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Sign out: Kofra console</title></svelte:head>
<h1>Sign out</h1>
<ActionForm csrf={data.csrf} result={form}>
	<div class="actions"><Button type="submit">Sign out</Button></div>
</ActionForm>
