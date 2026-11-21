<script lang="ts">
	import Csrf from '#lib/components/account/Csrf.svelte';
	import { focusFirstInvalid } from '#lib/forms.js';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button } from '@kofra/ui';
	import ProblemNotice from './ProblemNotice.svelte';
	import type { ShownProblem } from '#lib/types.js';

	let { form }: { form: { name?: string; problem?: ShownProblem } | null } = $props();
	const fieldProblem = $derived(
		Boolean(
			form?.problem &&
			['invalid_bucket_name', 'bucket_already_exists', 'validation_failed'].includes(
				form.problem.code ?? ''
			)
		)
	);
	let busy = $state(false);
</script>

<section class="card pad" aria-labelledby="create-h">
	<h2 id="create-h">Create bucket</h2>
	<p class="muted">The name is part of every file's address and cannot be changed later.</p>
	{#if form?.problem && !fieldProblem}<ProblemNotice problem={form.problem} />{/if}
	<form
		class="form"
		method="POST"
		action="?/create"
		use:enhance={() => {
			busy = true;
			return async ({ update, result }) => {
				await update({ reset: false });
				busy = false;
				if (result.type === 'failure') await focusFirstInvalid();
			};
		}}
	>
		<Csrf />
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
				3 to 63 lowercase letters, digits or hyphens, starting and ending with a letter or digit.
				For example <code>family-photos</code>.
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
</section>
