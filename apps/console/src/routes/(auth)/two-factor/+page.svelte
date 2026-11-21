<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@kofra/ui';
	import ActionForm from '#lib/components/account/ActionForm.svelte';
	import Field from '#lib/components/account/Field.svelte';

	import PasskeySignIn from '#lib/components/account/PasskeySignIn.svelte';

	let { data, form } = $props();
	const toggle = $derived(
		new URLSearchParams({
			next: data.next,
			...(data.recovery ? {} : { recovery: '1' })
		}).toString()
	);
</script>

<svelte:head><title>Two-step verification: Kofra console</title></svelte:head>
<h1>Two-step verification</h1>
{#if !data.recovery}<p>Enter the 6-digit code from your authenticator app.</p>{/if}
<ActionForm csrf={data.csrf} result={form}>
	<Field
		name="code"
		label={data.recovery ? 'Recovery code' : 'Code'}
		autocomplete="one-time-code"
		inputmode={data.recovery ? 'text' : 'numeric'}
		result={form}
	/>
	<div class="actions"><Button type="submit">Continue</Button></div>
</ActionForm>
{#if data.passkeys}<PasskeySignIn
		endpoint="/two-factor/passkey"
		csrf={data.csrf}
		label="Use a passkey instead"
		link
	/>{/if}
{#if data.totp}<p>
		<a href="{resolve('/(auth)/two-factor')}?{toggle}">
			{data.recovery ? 'Use an authenticator code instead' : 'Use a recovery code instead'}
		</a>
	</p>{/if}
<p><a href={resolve('/(auth)/sign-out')}>Sign out</a></p>
