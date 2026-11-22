<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@kofra/ui';
	import ActionForm from '#lib/components/account/ActionForm.svelte';
	import Field from '#lib/components/account/Field.svelte';
	import TokenReveal from '#lib/components/TokenReveal.svelte';
	import { scopeGroups } from '#lib/token-scopes.js';

	let { data, form } = $props();
	const input = $derived(form?.input);
	const scopeProblem = $derived(form?.field === 'scopes' ? form.problem : undefined);
	const expiryProblem = $derived(form?.field === 'expiry' ? form.problem : undefined);
	let expiry = $derived(input?.expiry ?? '90');
</script>

<svelte:head><title>Create token: Kofra console</title></svelte:head>
<h1>Create token</h1>

{#if form?.created}
	<TokenReveal token={form.created} sample={data.mode !== 'live'} />
{:else}
	<div class="card pad">
		<ActionForm csrf={data.csrf} result={form}>
			<Field name="name" label="Name" defaultValue={input?.name ?? ''} result={form} />
			{#if scopeProblem}<p class="err" id="scopes-error">{scopeProblem.message}</p>{/if}
			{#each scopeGroups as group, i (group.label)}
				<fieldset class="field">
					<legend>{group.label}</legend>
					{#each Object.entries(group.scopes) as [scope, label], j (scope)}
						<label class="check">
							<input
								type="checkbox"
								name="scopes"
								value={scope}
								checked={input?.scopes.includes(scope)}
								aria-invalid={scopeProblem && i === 0 && j === 0 ? 'true' : undefined}
								aria-describedby={scopeProblem ? 'scopes-error' : undefined}
							/>
							{label}
						</label>
					{/each}
				</fieldset>
			{/each}
			<Field
				name="buckets"
				label="Buckets (optional)"
				hint="Separate bucket names with commas."
				required={false}
				defaultValue={input?.buckets ?? ''}
			/>
			<div class="field">
				<label for="addresses">Allowed addresses (optional)</label>
				<textarea
					class="input"
					id="addresses"
					name="addresses"
					rows={3}
					aria-describedby="addresses-help">{input?.addresses ?? ''}</textarea
				>
				<p class="help" id="addresses-help">Enter one IP address per line.</p>
			</div>
			<div class="field">
				<label for="expiry">Expires</label>
				<select
					class="input"
					id="expiry"
					name="expiry"
					bind:value={expiry}
					aria-invalid={expiryProblem ? 'true' : undefined}
					aria-describedby={expiryProblem ? 'expiry-help expiry-error' : 'expiry-help'}
				>
					<option value="30">30 days</option>
					<option value="90">90 days</option>
					<option value="365">1 year</option>
					<option value="1000">1,000 days (the longest)</option>
				</select>
				<p class="help" id="expiry-help">
					Every token expires. Make a new one before then, or revoke it sooner.
				</p>
				{#if expiryProblem}<p class="err" id="expiry-error">{expiryProblem.message}</p>{/if}
			</div>
			<div class="actions">
				<Button type="submit">Create token</Button>
				<a href={resolve('/(app)/tokens')}>Cancel</a>
			</div>
		</ActionForm>
	</div>
{/if}
