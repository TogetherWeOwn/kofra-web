<script lang="ts">
	import { focusFirstInvalid } from '#lib/forms.js';
	import { resolve } from '$app/paths';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { enhance } from '$app/forms';
	import { Button } from '@kofra/ui';
	import KeyReveal from '#lib/components/KeyReveal.svelte';
	import ProblemNotice from '#lib/components/ProblemNotice.svelte';

	let { data, form } = $props();
	let busy = $state(false);
	const chosen = $derived((form && 'chosen' in form ? form.chosen : {}) as Record<string, string>);
	const invalid = $derived(form && 'invalid' in form ? form.invalid : null);
</script>

<svelte:head>
	<title>Create access key: Kofra console</title>
	<meta
		name="description"
		content="Create an access key for S3 tools, limited to the buckets you choose."
	/>
</svelte:head>

<div class="ph">
	<div>
		<h1>Create access key</h1>
		<p>
			Give the key only the buckets and access it needs. You can add access later; you cannot narrow
			it.
		</p>
	</div>
</div>

{#if form && 'created' in form && form.created}
	<KeyReveal created={form.created} />
{:else}
	{#if form && 'problem' in form && form.problem}<ProblemNotice problem={form.problem} />{/if}
	<form
		class="card pad form"
		method="POST"
		use:enhance={() => {
			busy = true;
			return async ({ update, result }) => {
				await update({ reset: false });
				busy = false;
				if (result.type === 'failure') await focusFirstInvalid();
			};
		}}
	>
		<div class="field">
			<label for="name">Name <span class="muted">(optional)</span></label>
			<input
				class="input"
				id="name"
				name="name"
				maxlength="64"
				autocomplete="off"
				value={form && 'name' in form ? form.name : ''}
				aria-describedby="name-help{invalid === 'name' ? ' name-err' : ''}"
				aria-invalid={invalid === 'name' ? 'true' : undefined}
			/>
			<p class="help" id="name-help">A label for you, such as the tool or computer that uses it.</p>
			{#if invalid === 'name'}<p class="err" id="name-err">
					<CircleAlert class="icon" aria-hidden="true" />Use at most 64 characters.
				</p>{/if}
		</div>
		<fieldset
			class="field"
			aria-describedby="grants-help{invalid === 'grants' ? ' grants-err' : ''}"
		>
			<legend>Bucket access</legend>
			<p class="help" id="grants-help">
				Every bucket starts with no access. Read only lists and downloads; read and write also
				uploads and deletes files.
			</p>
			{#if data.buckets.length}
				<ul class="grants">
					{#each data.buckets as b (b)}
						<li>
							<label class="mono" for="access-{b}">{b}</label>
							<select
								class="select"
								id="access-{b}"
								name="access:{b}"
								aria-invalid={invalid === 'grants' ? 'true' : undefined}
								aria-describedby={invalid === 'grants' ? 'grants-err' : undefined}
							>
								<option value="none" selected={!chosen[b]}>No access</option>
								<option value="read" selected={chosen[b] === 'read'}>Read only</option>
								<option value="read_write" selected={chosen[b] === 'read_write'}>
									Read and write
								</option>
							</select>
						</li>
					{/each}
				</ul>
			{:else}
				<p>
					There are no buckets yet. <a href={resolve('/(app)/buckets?create')}>Create a bucket</a> first.
				</p>
			{/if}
			{#if invalid === 'grants'}<p class="err" id="grants-err">
					<CircleAlert class="icon" aria-hidden="true" />Give the key access to at least one bucket.
				</p>{/if}
		</fieldset>
		<div class="actions">
			<Button type="submit" disabled={busy || data.buckets.length === 0}>
				{busy ? 'Creating…' : 'Create access key'}
			</Button>
			<a href={resolve('/(app)/keys')}>Cancel</a>
		</div>
	</form>
{/if}

<style>
	.grants {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.grants li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 220px);
		gap: var(--space-3);
		align-items: center;
		border-bottom: 1px solid var(--color-line);
		padding-bottom: var(--space-2);
	}
	.grants label {
		font-weight: var(--font-weight-regular);
		overflow-wrap: anywhere;
	}
</style>
