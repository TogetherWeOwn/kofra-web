<script lang="ts">
	import { Button } from '@kofra/ui';
	import type { ShownProblem } from '#lib/types.js';
	import Notice from '../Notice.svelte';
	import ActionForm from './ActionForm.svelte';
	import Field from './Field.svelte';

	let {
		csrf,
		changed,
		passwordOptional,
		result
	}: {
		csrf?: string;
		changed: boolean;
		passwordOptional: boolean;
		result: { field?: string; problem?: ShownProblem } | null;
	} = $props();
</script>

<section class="card pad" aria-labelledby="password-heading">
	<h2 id="password-heading">Password</h2>
	<p>Changing your password signs out your other devices.</p>
	{#if changed}<Notice tone="success" live><p>Password changed.</p></Notice>{/if}
	<ActionForm action="?/password" {csrf} {result}>
		{#if passwordOptional}
			<p>You signed in with a passkey, so your current password is not needed.</p>
		{:else}
			<Field
				name="current"
				label="Current password"
				type="password"
				autocomplete="current-password"
				{result}
			/>
		{/if}
		<Field
			name="password"
			label="New password"
			type="password"
			autocomplete="new-password"
			minlength={12}
			{result}
		/>
		<div class="actions"><Button type="submit">Change</Button></div>
	</ActionForm>
</section>
