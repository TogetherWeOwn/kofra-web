<script lang="ts">
	import { resolve } from '$app/paths';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import PlanSummary from '#lib/components/PlanSummary.svelte';
	import ProblemNotice from '#lib/components/ProblemNotice.svelte';

	let { data, form } = $props();
	const label = $derived(data.name ?? data.id);
	const unconfirmed = $derived(Boolean(form && 'unconfirmed' in form));
</script>

<svelte:head>
	<title>Revoke {label}: Kofra console</title>
	<meta name="description" content="Confirm that you want to revoke the access key {label}." />
</svelte:head>

<div class="ph">
	<div>
		<h1>Revoke access key {label}</h1>
		<p>Tools that use this key stop working at once. Revoking cannot be undone.</p>
	</div>
</div>

{#if form && 'problem' in form && form.problem}<ProblemNotice problem={form.problem} />{/if}

<section class="card pad" aria-labelledby="plan-h">
	<h2 id="plan-h">What happens</h2>
	<PlanSummary plan={data.plan} />
</section>

<form class="card pad form" method="POST">
	<div class="field">
		<label class="check">
			<input
				type="checkbox"
				name="confirm"
				value="yes"
				required
				aria-describedby={unconfirmed ? 'confirm-err' : undefined}
				aria-invalid={unconfirmed ? 'true' : undefined}
			/>
			<span>
				I understand that tools using <span class="mono">{data.id}</span> will stop working.
			</span>
		</label>
		{#if unconfirmed}<p class="err" id="confirm-err">
				<CircleAlert class="icon" aria-hidden="true" />Tick the box to confirm.
			</p>{/if}
	</div>
	<div class="actions">
		<button class="btn-danger" type="submit">Revoke key</button>
		<a href={resolve('/(app)/keys')}>Cancel</a>
	</div>
</form>
