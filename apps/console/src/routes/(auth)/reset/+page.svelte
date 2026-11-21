<script lang="ts">
	import { Button } from '@kofra/ui';
	import Notice from '#lib/components/Notice.svelte';
	import ActionForm from '#lib/components/account/ActionForm.svelte';
	import Field from '#lib/components/account/Field.svelte';

	let { form } = $props();
</script>

<svelte:head><title>Reset your password: Kofra console</title></svelte:head>
<h1>Reset your password</h1>
{#if form?.sent}
	<Notice tone="success" live>
		<p>If an account exists for that address, we sent a link. It works for 30 minutes.</p>
	</Notice>
{:else}
	<ActionForm result={form}>
		<Field
			name="email"
			label="Email"
			type="email"
			autocomplete="email"
			defaultValue={form?.email ?? ''}
			result={form}
		/>
		<div class="actions"><Button type="submit">Send reset link</Button></div>
	</ActionForm>
{/if}
