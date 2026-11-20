<script lang="ts">
	import { resolve } from '$app/paths';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { enhance } from '$app/forms';
	import { Button } from '@kofra/ui';
	import ProblemNotice from '#lib/components/ProblemNotice.svelte';

	let { form } = $props();
	const fieldProblem = $derived(
		form?.problem &&
			['invalid_bucket_name', 'bucket_already_exists', 'validation_failed'].includes(
				form.problem.code ?? ''
			)
	);
	let busy = $state(false);
</script>

<svelte:head>
	<title>Create bucket: Kofra console</title>
	<meta name="description" content="Create a new bucket in your Kofra workspace." />
</svelte:head>

<div class="ph">
	<div>
		<h1>Create bucket</h1>
		<p>The name is part of every file's address, and cannot be changed later.</p>
	</div>
</div>

{#if form?.problem && !fieldProblem}<ProblemNotice problem={form.problem} />{/if}

<form
	class="card pad form"
	method="POST"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	<div class="field">
		<label for="name">Bucket name</label>
		<input
			class="input mono"
			id="name"
			name="name"
			required
			minlength="3"
			maxlength="63"
			autocomplete="off"
			autocapitalize="none"
			spellcheck="false"
			value={form?.name ?? ''}
			aria-describedby="name-help{fieldProblem ? ' name-err' : ''}"
			aria-invalid={fieldProblem ? 'true' : undefined}
		/>
		<p class="help" id="name-help">
			3 to 63 lowercase letters, digits or hyphens, starting and ending with a letter or digit. For
			example <code>family-photos</code>.
		</p>
		{#if fieldProblem && form?.problem}
			<p class="err" id="name-err">
				<CircleAlert class="icon" aria-hidden="true" />{form.problem.message}
			</p>
		{/if}
	</div>
	<div class="actions">
		<Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create bucket'}</Button>
		<a href={resolve('/(app)/buckets')}>Cancel</a>
	</div>
</form>
