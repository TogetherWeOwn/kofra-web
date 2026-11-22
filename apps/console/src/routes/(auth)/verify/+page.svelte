<script lang="ts">
	import { Button } from '@kofra/ui';
	import { resolve } from '$app/paths';
	import Notice from '#lib/components/Notice.svelte';
	import ActionForm from '#lib/components/account/ActionForm.svelte';
	import Field from '#lib/components/account/Field.svelte';

	let { data, form } = $props();
	const email = $derived(form?.email ?? data.email);
	const invalid = $derived(form?.problem?.code === 'token_invalid');
</script>

<svelte:head>
	<title>{data.token ? 'Confirm your email address' : 'Check your inbox'}: Kofra console</title>
</svelte:head>
<h1>{data.token ? 'Confirm your email address' : 'Check your inbox'}</h1>
{#if data.changed || form?.changed}
	<Notice tone="success" live><p>Your new email address is confirmed.</p></Notice>
	<p><a href={resolve('/(auth)/sign-in')}>Sign in</a></p>
{:else if data.token && !invalid && !form?.sent && !form?.resend}
	<ActionForm
		action={'?/confirm&' + new URLSearchParams({ token: data.token })}
		csrf={data.csrf}
		result={form}
	>
		<input type="hidden" name="token" value={data.token} />
		<Field
			name="password"
			label="Password"
			type="password"
			autocomplete="current-password"
			hint="Enter the password you chose for this account. Not needed for a change of address."
			required={false}
			result={form}
		/>
		<div class="actions"><Button type="submit">Confirm email address</Button></div>
	</ActionForm>
{:else}
	{#if email && !invalid}<p>
			We sent a link to {email}. Open it to confirm your email address.
		</p>{/if}
	{#if form?.sent}<Notice tone="success" live><p>Sent. It can take a minute.</p></Notice>{/if}
	<ActionForm action={'?/resend&' + new URLSearchParams({ email })} csrf={data.csrf} result={form}>
		{#if data.email && !invalid && form?.field !== 'email'}
			<input type="hidden" name="email" value={email} />
		{:else}
			<Field
				name="email"
				label="Email"
				type="email"
				autocomplete="email"
				value={email}
				result={form}
			/>
		{/if}
		<div class="actions"><Button type="submit">Send it again</Button></div>
	</ActionForm>
	{#if data.signedIn}
		<p><a href={resolve('/(auth)/sign-out')}>Sign out</a> to use another address.</p>
	{/if}
{/if}
