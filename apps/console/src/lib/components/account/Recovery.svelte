<script lang="ts">
	import { Button } from '@kofra/ui';
	import type { ShownProblem } from '#lib/types.js';
	import ActionForm from './ActionForm.svelte';
	import RecoveryReveal from './RecoveryReveal.svelte';

	let {
		enabled,
		count,
		csrf,
		result
	}: {
		enabled: boolean;
		count: number;
		csrf?: string;
		result: { codes?: string[] | null; field?: string; problem?: ShownProblem } | null;
	} = $props();
</script>

<section class="card pad" aria-labelledby="recovery">
	<h2 id="recovery">Recovery codes</h2>
	<p>Use a recovery code if you lose access to your authenticator app or passkey.</p>
	<p>{count} left</p>
	{#if result?.codes}<RecoveryReveal codes={result.codes} />{/if}
	{#if enabled}
		<ActionForm action="?/recovery" {csrf} {result}>
			<div class="actions"><Button type="submit">Create new codes</Button></div>
		</ActionForm>
	{/if}
</section>
