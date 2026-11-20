<script lang="ts">
	import { resolve } from '$app/paths';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import PlanSummary from '#lib/components/PlanSummary.svelte';
	import ProblemNotice from '#lib/components/ProblemNotice.svelte';

	let { data, form } = $props();
	const id = $derived(data.account.id);
	const mismatch = $derived(Boolean(form && 'mismatch' in form));
</script>

<svelte:head>
	<title>Delete workspace: Kofra console</title>
	<meta name="description" content="Confirm that you want to request deletion of this workspace." />
</svelte:head>

<div class="ph">
	<div>
		<h1>Delete workspace</h1>
		<p>
			This requests deletion. An Owner then confirms it, and the data is erased after a waiting
			period.
		</p>
	</div>
</div>

{#if form && 'problem' in form && form.problem}<ProblemNotice problem={form.problem} />{/if}

<section class="card pad" aria-labelledby="plan-h">
	<h2 id="plan-h">What happens</h2>
	<PlanSummary plan={data.plan} />
</section>

<form class="card pad form" method="POST">
	<div class="field">
		<label for="confirm">Type the workspace ID <code>{id}</code> to confirm</label>
		<input
			class="input mono"
			id="confirm"
			name="confirm"
			required
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
			aria-describedby={mismatch ? 'confirm-err' : undefined}
			aria-invalid={mismatch ? 'true' : undefined}
		/>
		{#if mismatch}<p class="err" id="confirm-err">
				<CircleAlert class="icon" aria-hidden="true" />The ID you typed does not match.
			</p>{/if}
	</div>
	<div class="actions">
		<button class="btn-danger" type="submit">Request deletion</button>
		<a href={resolve('/(app)/settings')}>Cancel</a>
	</div>
</form>
