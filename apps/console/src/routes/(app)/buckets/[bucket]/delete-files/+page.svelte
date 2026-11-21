<script lang="ts">
	import Csrf from '#lib/components/account/Csrf.svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Notice from '#lib/components/Notice.svelte';
	import ProblemNotice from '#lib/components/ProblemNotice.svelte';
	import { bytes, count, dateTime } from '#lib/format.js';

	let { data, form } = $props();
	const n = $derived(data.items.length);
	const files = $derived(`${count(n)} file${n === 1 ? '' : 's'}`);
</script>

<svelte:head>
	<title>Delete files from {data.bucket.name}: Kofra console</title>
	<meta name="description" content="Confirm which files to delete from {data.bucket.name}." />
</svelte:head>

<div class="ph">
	<div>
		<h1>Delete {files} from {data.bucket.name}</h1>
		<p>Deleted files cannot be brought back. Check the list before you confirm.</p>
	</div>
</div>

{#if form && 'problem' in form && form.problem}<ProblemNotice problem={form.problem} />{/if}

{#if data.missing.length}
	<Notice tone="info" title="Already gone">
		<p>
			{count(data.missing.length)} of the chosen files no longer exist, so there is nothing to delete
			for them:
		</p>
		<ul class="plain mono">
			{#each data.missing as key (key)}<li>{key}</li>{/each}
		</ul>
	</Notice>
{/if}

{#if n === 0}
	<p><a href={data.back}>Back to {data.bucket.name}</a></p>
{:else}
	<section class="card" aria-labelledby="list-h">
		<div class="card-bar">
			<h2 id="list-h" class="h3">These files will be deleted</h2>
			<p class="muted">{files}, {bytes(data.total)} in total</p>
		</div>
		<div class="table-wrap">
			<table class="tbl">
				<thead>
					<tr>
						<th scope="col">File</th>
						<th scope="col" class="num">Size</th>
						<th scope="col" class="hs">Modified</th>
					</tr>
				</thead>
				<tbody>
					{#each data.items as item (item.key)}
						<tr>
							<th scope="row" class="wrap-cell mono">{item.key}</th>
							<td class="num">{bytes(item.size)}</td>
							<td class="hs">{item.modified ? dateTime(item.modified) : '–'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<form class="card pad form" method="POST">
		<Csrf />
		<input type="hidden" name="token" value={data.token} />
		<input type="hidden" name="prefix" value={data.prefix} />
		{#each data.items as item (item.key)}
			<input type="hidden" name="key" value={item.key} />
			<input type="hidden" name="etag" value={item.etag} />
		{/each}
		<div class="check">
			<input
				id="confirm"
				name="confirm"
				type="checkbox"
				value="yes"
				required
				aria-describedby={form && 'unconfirmed' in form ? 'confirm-err' : undefined}
				aria-invalid={form && 'unconfirmed' in form ? 'true' : undefined}
			/>
			<label for="confirm">I understand that these {files} are deleted for good.</label>
		</div>
		{#if form && 'unconfirmed' in form}
			<p class="err" id="confirm-err">
				<CircleAlert class="icon" aria-hidden="true" />Tick the box to confirm.
			</p>
		{/if}
		<p class="muted">
			A file that changed after this page was shown is kept, and the result says so.
		</p>
		<div class="actions">
			<button class="btn-danger" type="submit">Delete {files}</button>
			<a href={data.back}>Cancel</a>
		</div>
	</form>
{/if}

<style>
	.plain {
		display: grid;
		gap: var(--space-1);
		overflow-wrap: anywhere;
	}
</style>
