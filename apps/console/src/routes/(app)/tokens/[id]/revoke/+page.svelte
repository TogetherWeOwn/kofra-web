<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@kofra/ui';
	import ActionForm from '#lib/components/account/ActionForm.svelte';

	let { data } = $props();
</script>

<svelte:head><title>Revoke token: Kofra console</title></svelte:head>
<h1>Revoke {data.token.name}?</h1>
<div class="card pad">
	<p>Scripts that use it stop working at once.</p>
	<ActionForm csrf={data.csrf}>
		<div class="actions">
			<Button type="submit">Revoke token</Button>
			<a href={resolve('/(app)/tokens')}>Cancel</a>
		</div>
	</ActionForm>
</div>
