<script lang="ts">
	import { Button } from '@kofra/ui';
	import ActionForm from '#lib/components/account/ActionForm.svelte';
	import Field from '#lib/components/account/Field.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Create your account: Kofra console</title></svelte:head>
<h1>Create your account</h1>
{#if !data.invite}
	<p>Kofra is invite-only for now. Ask the person who invited you for a new link.</p>
{:else}
	<ActionForm csrf={data.csrf} result={form}>
		<Field name="name" label="Name" autocomplete="name" defaultValue={form?.name ?? ''} />
		<Field
			name="email"
			label="Email"
			type="email"
			autocomplete="email"
			defaultValue={form?.email ?? ''}
			result={form}
		/>
		<Field
			name="password"
			label="Password"
			type="password"
			autocomplete="new-password"
			hint="At least 12 characters."
			minlength={12}
			result={form}
		/>
		<div class="actions"><Button type="submit">Create account</Button></div>
	</ActionForm>
{/if}
