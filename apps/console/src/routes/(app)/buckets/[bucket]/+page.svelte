<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		bucketConnectHref,
		bucketDeleteHref,
		bucketHref,
		bucketPageHref,
		deleteFilesAction,
		downloadHref
	} from '#lib/links.js';
	import Download from '@lucide/svelte/icons/download';
	import FileIcon from '@lucide/svelte/icons/file';
	import Folder from '@lucide/svelte/icons/folder';
	import Trash from '@lucide/svelte/icons/trash-2';
	import Notice from '#lib/components/Notice.svelte';
	import Uploader from '#lib/components/Uploader.svelte';
	import { bytes, count, date, dateTime } from '#lib/format.js';

	let { data } = $props();
	const b = $derived(data.bucket);
	const empty = $derived(data.listing.folders.length === 0 && data.listing.files.length === 0);
	const parent = $derived(
		data.folders.length > 1 ? data.folders[data.folders.length - 2]!.prefix : ''
	);
	const cols = $derived(data.canDelete ? 6 : 5);
	const r = $derived(data.removed);
	const plural = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? '' : 's'}`;
</script>

<svelte:head>
	<title>{b.name}: Kofra console</title>
	<meta
		name="description"
		content="Browse, upload and download the files in the bucket {b.name}."
	/>
</svelte:head>

<div class="ph">
	<div>
		<h1>{b.name}</h1>
		<p>
			{bytes(b.stored_bytes)} in {plural(b.object_count, 'file')}{data.countsComplete
				? ''
				: ' so far (still being counted)'}. Created {date(b.created_at)}.
		</p>
	</div>
	{#if (data.canWrite || data.sample) && !data.isProtected}
		<div class="ph-act">
			<a class="btn-plain link-danger" href={bucketDeleteHref(b.name)}>Delete bucket</a>
		</div>
	{/if}
</div>

{#if data.created}
	<Notice tone="success" title="Bucket created" live>
		<p>
			Upload files below, or point an S3 tool at it with an <a href={resolve('/(app)/keys/new')}>
				access key
			</a>.
		</p>
	</Notice>
{/if}

{#if r.deleted || r.skipped || r.failed}
	<Notice tone={r.failed ? 'warning' : 'success'} title="Files deleted" live>
		<p>{plural(r.deleted, 'file')} deleted.</p>
		{#if r.skipped}
			<p>
				{plural(r.skipped, 'file')} kept: changed after you confirmed, or already gone.
			</p>
		{/if}
		{#if r.failed}<p>{plural(r.failed, 'file')} could not be deleted. Try again.</p>{/if}
	</Notice>
{/if}

{#if data.access === 'read'}
	<Notice tone="info" title="Browse and download only">
		<p>
			The console cannot change anything in this bucket.
			{#if data.connect}<a href={bucketConnectHref(b.name)}>Allow uploads and deletes</a>{/if}
		</p>
	</Notice>
{/if}

{#if data.canWrite}<Uploader bucket={b.name} prefix={data.prefix} sample={data.sample} />{/if}

<section class="card" aria-labelledby="files-h">
	<div class="card-bar">
		<h2 id="files-h" class="h3">{data.prefix ? `Files in ${data.prefix}` : 'Files'}</h2>
		{#if data.sample}<p class="muted">Sample files: the demo shows a few per bucket.</p>{/if}
	</div>
	<form method="GET" action={deleteFilesAction(b.name)} id="selection">
		<input type="hidden" name="prefix" value={data.prefix} />
	</form>
	<div class="table-wrap">
		<table class="tbl">
			<thead>
				<tr>
					{#if data.canDelete}<th scope="col" class="sel">
							<span class="sr-only">Select</span>
						</th>{/if}
					<th scope="col">Name</th>
					<th scope="col" class="num">Size</th>
					<th scope="col" class="hs">Type</th>
					<th scope="col" class="hs">Modified</th>
					<th scope="col"><span class="sr-only">Download</span></th>
				</tr>
			</thead>
			<tbody>
				{#if data.prefix}
					<tr>
						<th scope="row" colspan={cols}>
							<a class="cell-link" href={bucketHref(b.name, parent)}>
								<Folder class="icon" aria-hidden="true" />Up one level
							</a>
						</th>
					</tr>
				{/if}
				{#each data.listing.folders as f (f.prefix)}
					<tr>
						{#if data.canDelete}<td class="sel"></td>{/if}
						<th scope="row">
							<a class="cell-link" href={bucketHref(b.name, f.prefix)}>
								<Folder class="icon" aria-hidden="true" />{f.name}/
							</a>
						</th>
						<td class="num muted">–</td>
						<td class="hs muted">Folder</td>
						<td class="hs muted">–</td>
						<td class="act"></td>
					</tr>
				{/each}
				{#each data.listing.files as f (f.key)}
					<tr>
						{#if data.canDelete}
							<td class="sel">
								<input
									type="checkbox"
									name="key"
									value={f.key}
									form="selection"
									aria-label="Select {f.name}"
								/>
							</td>
						{/if}
						<th scope="row" class="wrap-cell">
							<span class="fname"><FileIcon class="icon" aria-hidden="true" />{f.name}</span>
						</th>
						<td class="num">{bytes(f.size)}</td>
						<td class="hs mono">{f.type || '–'}</td>
						<td class="hs">{f.modified ? dateTime(f.modified) : '–'}</td>
						<td class="act">
							<a
								class="btn-plain btn-sm"
								href={downloadHref(b.name, f.key)}
								aria-label="Download {f.name}"
								data-sveltekit-reload
							>
								<Download class="icon" aria-hidden="true" />Download
							</a>
						</td>
					</tr>
				{/each}
				{#if empty}
					<tr><td colspan={cols} class="muted">This folder is empty.</td></tr>
				{/if}
			</tbody>
		</table>
	</div>
	{#if data.canDelete || data.listing.next || data.cursor}
		<div class="card-foot">
			{#if data.canDelete && data.listing.files.length}
				<button class="btn-plain btn-sm link-danger" type="submit" form="selection">
					<Trash class="icon" aria-hidden="true" />Delete selected
				</button>
			{/if}
			<span class="pager">
				{#if data.cursor}<a href={bucketHref(b.name, data.prefix)}>First page</a>{/if}
				{#if data.listing.next}
					<a href={bucketPageHref(b.name, data.prefix, data.listing.next)}>Next page</a>
				{/if}
			</span>
		</div>
	{/if}
</section>

<style>
	.fname {
		display: inline-flex;
		gap: var(--space-2);
		align-items: center;
	}
	.fname :global(.icon) {
		color: var(--color-muted);
	}
	.sel {
		width: 44px;
	}
	.sel input {
		width: 18px;
		height: 18px;
		accent-color: var(--color-accent);
	}
	.card-foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--color-line);
	}
	.pager {
		display: inline-flex;
		gap: var(--space-4);
		margin-left: auto;
	}
</style>
