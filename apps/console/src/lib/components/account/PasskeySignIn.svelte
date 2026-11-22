<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '@kofra/ui';
	import { getPasskey, passkeyCeremony, supportsPasskeys } from '#lib/passkeys.js';
	import Notice from '../Notice.svelte';

	let {
		endpoint,
		csrf,
		label,
		link = false,
		separator = false
	}: {
		endpoint: string;
		csrf?: string;
		label: string;
		link?: boolean;
		separator?: boolean;
	} = $props();
	let supported = $state(false);
	let busy = $state(false);
	let problem = $state('');

	onMount(() => {
		supported = supportsPasskeys();
	});

	async function usePasskey(event: MouseEvent) {
		event.preventDefault();
		if (busy) return;
		busy = true;
		problem = '';
		try {
			const result = await passkeyCeremony<PublicKeyCredentialRequestOptionsJSON, { next: string }>(
				endpoint,
				getPasskey,
				csrf
			);
			if (result) window.location.assign(result.next);
		} catch (err) {
			problem = err instanceof Error ? err.message : 'The passkey did not work. Try again.';
		} finally {
			busy = false;
		}
	}
</script>

{#if supported}
	{#if separator}<div class="separator">
			<hr />
			<span>or</span>
			<hr />
		</div>{/if}
	{#if problem}<Notice tone="warning" live><p>{problem}</p></Notice>{/if}
	{#if link}
		<p id="use-passkey">
			<a href="#use-passkey" aria-disabled={busy} onclick={usePasskey}>{label}</a>
		</p>
	{:else}
		<div class="actions">
			<Button type="button" variant="secondary" disabled={busy} onclick={usePasskey}>
				{label}
			</Button>
		</div>
	{/if}
{/if}

<style>
	.separator {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-block: 1rem;
	}
	hr {
		flex: 1;
		border: 0;
		border-top: 1px solid currentColor;
		opacity: 0.25;
	}
</style>
