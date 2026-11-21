<script lang="ts">
	import { Button } from '@kofra/ui';
	import type { ShownProblem } from '#lib/types.js';
	import Notice from '../Notice.svelte';
	import ActionForm from './ActionForm.svelte';
	import Field from './Field.svelte';

	let {
		name,
		csrf,
		result
	}: {
		name: string;
		csrf?: string;
		result: { saved?: boolean; field?: string; problem?: ShownProblem } | null;
	} = $props();
</script>

<section class="card pad" aria-labelledby="profile">
	<h2 id="profile">Profile</h2>
	<p>Update the name on your account.</p>
	{#if result?.saved}<Notice tone="success" live><p>Profile saved.</p></Notice>{/if}
	<ActionForm action="?/profile" {csrf} {result}>
		<Field name="name" label="Name" autocomplete="name" value={name} {result} />
		<div class="actions"><Button type="submit">Save</Button></div>
	</ActionForm>
</section>
