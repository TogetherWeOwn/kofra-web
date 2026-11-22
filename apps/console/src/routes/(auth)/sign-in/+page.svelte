<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@kofra/ui';
	import { DOCS_URL } from '#lib/nav.js';
	import Notice from '#lib/components/Notice.svelte';
	import ActionForm from '#lib/components/account/ActionForm.svelte';
	import Field from '#lib/components/account/Field.svelte';

	import PasskeySignIn from '#lib/components/account/PasskeySignIn.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Sign in: Kofra console</title>
	<meta name="description" content="Sign in to the Kofra console." />
</svelte:head>

<h1>Sign in</h1>
{#if data.mode !== 'live' && data.mode !== 'live-fake'}
	<p>
		Sign-in is not available yet. Accounts with email and password, passkeys and two-factor
		authentication come with the first release.
	</p>
	<p>Until then, the console runs as a demo with sample data that only you can see.</p>
	<p class="actions">
		<a class="btn-plain" href={resolve('/(app)')}>Open the demo workspace</a>
		<a href={DOCS_URL} rel="external">Read the documentation</a>
	</p>
{:else}
	{#if data.verified}
		<Notice tone="success"><p>Your email address is confirmed. Sign in to continue.</p></Notice>
	{/if}
	{#if data.reset}
		<Notice tone="success"><p>Your password was changed. Sign in with the new one.</p></Notice>
	{/if}
	<ActionForm csrf={data.csrf} result={form}>
		<Field
			name="email"
			label="Email"
			type="email"
			autocomplete="username"
			defaultValue={form?.email ?? ''}
			result={form}
		/>
		<Field name="password" label="Password" type="password" autocomplete="current-password" />
		<div class="actions"><Button type="submit">Sign in</Button></div>
	</ActionForm>
	<PasskeySignIn
		endpoint="/sign-in/passkey"
		csrf={data.csrf}
		label="Sign in with a passkey"
		separator
	/>
	<p><a href={resolve('/(auth)/reset')}>Forgot your password?</a></p>
	<p>Kofra is invite-only for now.</p>
{/if}
