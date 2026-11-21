<script lang="ts">
	import { Button } from '@kofra/ui';
	import { resolve } from '$app/paths';
	import ActionForm from '#lib/components/account/ActionForm.svelte';
	import Field from '#lib/components/account/Field.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>{data.workspace ? 'Protect your account' : 'Name your workspace'}: Kofra console</title>
</svelte:head>
{#if data.workspace}
	<h1>Protect your account</h1>
	<p>Add a second step to sign-in so a stolen password is not enough.</p>
	<p class="actions">
		<Button href="{resolve('/(app)/account')}#two-step">Set up an authenticator app</Button>
		<a href={resolve('/(app)')}>Not now</a>
	</p>
{:else}
	<h1>Name your workspace</h1>
	<ActionForm csrf={data.csrf} result={form}>
		<Field name="name" label="Workspace name" defaultValue={form?.name ?? data.name} />
		<div class="actions"><Button type="submit">Create workspace</Button></div>
	</ActionForm>
{/if}
