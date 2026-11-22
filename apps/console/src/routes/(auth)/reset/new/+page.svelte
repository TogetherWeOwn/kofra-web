<script lang="ts">
	import { Button } from '@kofra/ui';
	import { resolve } from '$app/paths';
	import ProblemNotice from '#lib/components/ProblemNotice.svelte';
	import ActionForm from '#lib/components/account/ActionForm.svelte';
	import Field from '#lib/components/account/Field.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Choose a new password: Kofra console</title></svelte:head>
<h1>Choose a new password</h1>
{#if data.ready}
	<ActionForm csrf={data.csrf} result={form}>
		<Field
			name="password"
			label="New password"
			type="password"
			autocomplete="new-password"
			minlength={12}
			result={form}
		/>
		{#if data.secondFactor}
			<Field
				name="code"
				label="Code from your authenticator app or a recovery code"
				autocomplete="one-time-code"
				result={form}
			/>
		{/if}
		<div class="actions"><Button type="submit">Set password</Button></div>
	</ActionForm>
	{#if form?.problem?.code === 'code_invalid'}
		<!-- A wrong code spends the link, so the person needs a new one. -->
		<p><a href={resolve('/(auth)/reset')}>Request a new link</a></p>
	{/if}
{:else if data.problem}
	<ProblemNotice problem={data.problem} />
	<p><a href={resolve('/(auth)/reset')}>Request a new link</a></p>
{/if}
