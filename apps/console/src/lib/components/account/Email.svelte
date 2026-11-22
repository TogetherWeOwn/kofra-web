<script lang="ts">
	import { Button } from '@kofra/ui';
	import type { ShownProblem } from '#lib/types.js';
	import Notice from '../Notice.svelte';
	import ActionForm from './ActionForm.svelte';
	import Field from './Field.svelte';

	let {
		email,
		verified,
		csrf,
		result
	}: {
		email: string;
		verified: boolean;
		csrf?: string;
		result: { email?: string; field?: string; problem?: ShownProblem } | null;
	} = $props();
</script>

<section class="card pad" aria-labelledby="email-heading">
	<h2 id="email-heading">Email</h2>
	<p>Manage the address you use to sign in.</p>
	<p>{email} <span class="badge">{verified ? 'Verified' : 'Unverified'}</span></p>
	{#if result?.email}
		<Notice tone="success" live>
			<p>We sent a link to {result.email}. Your address changes when you open it.</p>
		</Notice>
	{/if}
	<ActionForm action="?/email" {csrf} {result}>
		<Field name="email" label="New email address" type="email" autocomplete="email" {result} />
		<div class="actions"><Button type="submit">Change email</Button></div>
	</ActionForm>
</section>
