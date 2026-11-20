<script lang="ts">
	import { resolve } from '$app/paths';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	let { form } = $props();
	const unconfirmed = $derived(Boolean(form?.unconfirmed));
</script>

<svelte:head>
	<title>Reset demo data: Kofra console</title>
	<meta name="description" content="Confirm that you want to go back to the sample workspace." />
</svelte:head>

<div class="ph">
	<div>
		<h1>Reset demo data</h1>
		<p>
			Every bucket, access key and file you added is dropped, and the sample workspace comes back.
		</p>
	</div>
</div>

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
			<span>I want to drop my changes to the demo.</span>
		</label>
		{#if unconfirmed}<p class="err" id="confirm-err">
				<CircleAlert class="icon" aria-hidden="true" />Tick the box to confirm.
			</p>{/if}
	</div>
	<div class="actions">
		<button class="btn-danger" type="submit">Reset demo data</button>
		<a href={resolve('/(app)/settings')}>Cancel</a>
	</div>
</form>
