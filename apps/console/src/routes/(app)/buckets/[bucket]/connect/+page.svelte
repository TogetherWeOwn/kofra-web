<script lang="ts">
	import Csrf from '#lib/components/account/Csrf.svelte';
	import { resolve } from '$app/paths';
	import { Button } from '@kofra/ui';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import ProblemNotice from '#lib/components/ProblemNotice.svelte';
	import { bytes, count } from '#lib/format.js';

	let { data, form } = $props();
	const widen = $derived(data.current === 'read');
</script>

<svelte:head>
	<title>Open {data.name}: Kofra console</title>
	<meta name="description" content="Let the console open the bucket {data.name}." />
</svelte:head>

<div class="ph">
	<div>
		<h1>{widen ? `Allow changes in ${data.name}` : `Open ${data.name} in the console`}</h1>
		<p>
			{#if widen}
				The console can browse and download files in this bucket. It can also be allowed to upload
				and delete them.
			{:else}
				{#if data.other}
					This bucket belongs to your workspace, but the console has no access to it yet. It holds
					{bytes(data.other.stored_bytes)} in
					{count(data.other.object_count)} file{data.other.object_count === 1 ? '' : 's'}.
				{:else}
					The console has no access to this bucket yet.
				{/if}
			{/if}
		</p>
	</div>
</div>

{#if form && 'problem' in form && form.problem}<ProblemNotice problem={form.problem} />{/if}

<form class="card pad form" method="POST">
	<Csrf />
	<fieldset class="field">
		<legend>What the console may do in {data.name}</legend>
		{#if !widen}
			<label class="choice">
				<input type="radio" name="access" value="read" checked />
				<span>
					<strong>Browse and download</strong>
					<span class="muted">Nothing in the bucket can be changed from the console.</span>
				</span>
			</label>
		{/if}
		<label class="choice">
			<input type="radio" name="access" value="read_write" checked={widen} />
			<span>
				<strong>Browse, download, upload and delete</strong>
				<span class="muted">Deleting files always asks for a confirmation first.</span>
			</span>
		</label>
		{#if form && 'unchosen' in form}
			<p class="err"><CircleAlert class="icon" aria-hidden="true" />Choose one.</p>
		{/if}
	</fieldset>
	<p class="muted">
		Access the console is given can be widened later but not taken back here. Apps and tools that
		use this bucket keep working as before.
	</p>
	<div class="actions">
		<Button type="submit">{widen ? 'Allow changes' : 'Open bucket'}</Button>
		<a href={resolve('/(app)/buckets')}>Cancel</a>
	</div>
</form>

<style>
	fieldset {
		display: grid;
		gap: var(--space-3);
	}
	legend {
		margin-bottom: var(--space-2);
	}
	.choice {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}
	.choice input {
		width: 18px;
		height: 18px;
		margin-top: 3px;
		accent-color: var(--color-accent);
		flex: none;
	}
	.choice span {
		display: grid;
		gap: var(--space-1);
	}
</style>
