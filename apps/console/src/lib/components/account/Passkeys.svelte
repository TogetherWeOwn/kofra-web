<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '@kofra/ui';
	import { onMount, tick } from 'svelte';
	import { dateTime } from '#lib/format.js';
	import { createPasskey, passkeyCeremony, supportsPasskeys } from '#lib/passkeys.js';
	import type { Passkey } from '#lib/server/account/types.js';
	import type { ShownProblem } from '#lib/types.js';
	import Notice from '../Notice.svelte';
	import ProblemNotice from '../ProblemNotice.svelte';
	import ActionForm from './ActionForm.svelte';
	import Field from './Field.svelte';
	import RecoveryReveal from './RecoveryReveal.svelte';

	let {
		passkeys,
		defaultName,
		removeId,
		needsPassword,
		csrf,
		result
	}: {
		passkeys: Passkey[];
		/** No second factor yet: the first one needs the current password. */
		needsPassword: boolean;
		defaultName: string;
		removeId: string | null;
		csrf?: string;
		result: { saved?: boolean; problem?: ShownProblem } | null;
	} = $props();

	const accountUrl = resolve('/(app)/account');
	const removing = $derived(passkeys.find((key) => key.id === removeId));
	let supported = $state(false);
	let adding = $state(false);
	let renaming = $state('');
	$effect(() => {
		if (result?.saved) renaming = '';
	});
	let busy = $state(false);
	let problem = $state('');
	let codes = $state<string[] | null>(null);

	onMount(() => {
		supported = supportsPasskeys();
	});

	async function showName() {
		adding = true;
		await tick();
		document.getElementById('new-passkey-name')?.focus();
	}

	async function register(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !(event.currentTarget instanceof HTMLFormElement)) return;
		const data = new FormData(event.currentTarget);
		const name = String(data.get('name') ?? '').trim();
		const password = needsPassword ? String(data.get('password') ?? '') : undefined;
		if (needsPassword && !password) {
			problem = 'Enter your current password.';
			return;
		}
		if (!name) {
			problem = 'Enter a name for your passkey.';
			return;
		}
		busy = true;
		problem = '';
		try {
			const answer = await passkeyCeremony<
				PublicKeyCredentialCreationOptionsJSON,
				{
					recovery_codes: string[] | null;
				}
			>('/account/passkey', createPasskey, csrf, name, password);
			if (answer) {
				if (answer.recovery_codes) codes = answer.recovery_codes;
				adding = false;
				await invalidateAll();
			}
		} catch (err) {
			problem = err instanceof Error ? err.message : 'The passkey did not work. Try again.';
		} finally {
			busy = false;
		}
	}
</script>

<section class="card pad" aria-labelledby="passkeys">
	<h2 id="passkeys">Passkeys</h2>
	<p>Sign in with your fingerprint, face or device PIN instead of a password.</p>
	{#if codes}<RecoveryReveal {codes} />{/if}
	{#if result?.problem}<ProblemNotice problem={result.problem} />{/if}
	{#if result?.saved}<Notice tone="success" live><p>Passkey renamed.</p></Notice>{/if}
	{#if passkeys.length}
		<div class="table-wrap">
			<table class="tbl" aria-labelledby="passkeys">
				<thead>
					<tr>
						<th scope="col">Name</th>
						<th scope="col">Created</th>
						<th scope="col">Last used</th>
						<th scope="col">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each passkeys as key (key.id)}
						<tr>
							<td>
								{key.name}{#if key.synced}
									<span class="badge">Synced</span>{/if}
							</td>
							<td>{dateTime(key.created_at)}</td>
							<td>{key.last_used_at ? dateTime(key.last_used_at) : 'Never'}</td>
							<td>
								<button
									class="btn-plain btn-sm"
									type="button"
									aria-label="Rename {key.name}"
									aria-expanded={renaming === key.id}
									onclick={() => {
										renaming = key.id;
									}}
								>
									Rename
								</button>
								<a
									href="{accountUrl}?{new URLSearchParams({ removePasskey: key.id })}#passkeys"
									aria-label="Remove {key.name}"
								>
									Remove
								</a>
							</td>
						</tr>
						{#if renaming === key.id}
							<tr>
								<td colspan="4">
									<ActionForm action="?/renamePasskey" {csrf}>
										<input type="hidden" name="id" value={key.id} />
										<Field
											name="name"
											id="rename-passkey-name"
											label="Passkey name"
											value={key.name}
										/>
										<div class="actions">
											<Button type="submit">Save name</Button>
											<Button
												type="button"
												variant="secondary"
												onclick={() => {
													renaming = '';
												}}
											>
												Cancel
											</Button>
										</div>
									</ActionForm>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p>No passkeys yet.</p>
	{/if}
	{#if removing}
		<p>Remove {removing.name}?</p>
		<ActionForm
			action={'?/removePasskey&' + new URLSearchParams({ removePasskey: removing.id })}
			{csrf}
		>
			<input type="hidden" name="id" value={removing.id} />
			<div class="actions">
				<Button type="submit">Remove passkey</Button>
				<a href="{accountUrl}#passkeys">Cancel</a>
			</div>
		</ActionForm>
	{/if}
	{#if supported}
		{#if problem}<Notice tone="warning" live><p>{problem}</p></Notice>{/if}
		{#if adding}
			<form class="form" onsubmit={register}>
				<Field name="name" id="new-passkey-name" label="Passkey name" value={defaultName} />
				{#if needsPassword}
					<Field
						name="password"
						id="new-passkey-password"
						label="Current password"
						type="password"
						autocomplete="current-password"
						hint="Needed for your first passkey or authenticator app."
					/>
				{/if}
				<div class="actions">
					<Button type="submit" disabled={busy}>Create passkey</Button>
					<Button
						type="button"
						variant="secondary"
						disabled={busy}
						onclick={() => {
							adding = false;
							problem = '';
						}}
					>
						Cancel
					</Button>
				</div>
			</form>
		{:else}
			<div class="actions"><Button type="button" onclick={showName}>Add a passkey</Button></div>
		{/if}
	{/if}
</section>
