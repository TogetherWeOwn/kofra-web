<script lang="ts">
	import { Button } from '@kofra/ui';
	import ActionForm from '#lib/components/account/ActionForm.svelte';
	import Field from '#lib/components/account/Field.svelte';

	import PasskeySignIn from '#lib/components/account/PasskeySignIn.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Confirm it's you: Kofra console</title></svelte:head>
<h1>Confirm it's you</h1>
<p>For your security, enter your password again.</p>
<ActionForm csrf={data.csrf} result={form}>
	<Field
		name="password"
		label="Password"
		type="password"
		autocomplete="current-password"
		result={form}
	/>
	{#if data.totp || data.passkeys}
		<Field
			name="code"
			label={data.totp ? 'Code' : 'Recovery code'}
			autocomplete="one-time-code"
			inputmode={data.totp ? 'numeric' : 'text'}
			result={form}
		/>
	{/if}
	<div class="actions"><Button type="submit">Confirm</Button></div>
</ActionForm>
{#if data.passkeys}<PasskeySignIn
		endpoint="/confirm-identity/passkey"
		csrf={data.csrf}
		label="Use a passkey"
	/>{/if}
