<script lang="ts">
	import { resolve } from '$app/paths';
	import { bucketDeleteHref, bucketHref, downloadHref } from '#lib/links.js';
	import Download from '@lucide/svelte/icons/download';
	import FileIcon from '@lucide/svelte/icons/file';
	import Folder from '@lucide/svelte/icons/folder';
	import Notice from '#lib/components/Notice.svelte';
	import Uploader from '#lib/components/Uploader.svelte';
	import { bytes, count, date, dateTime } from '#lib/format.js';

	let { data } = $props();
	const b = $derived(data.bucket);
	const empty = $derived(data.listing.folders.length === 0 && data.listing.files.length === 0);
	const parent = $derived(
		data.folders.length > 1 ? data.folders[data.folders.length - 2]!.prefix : ''
	);
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
			{bytes(b.stored_bytes)} in {count(b.object_count)} file{b.object_count === 1 ? '' : 's'}.
			Created {date(b.created_at)}.
		</p>
	</div>
	<div class="ph-act">
		<a class="btn-plain link-danger" href={bucketDeleteHref(b.name)}>Delete bucket</a>
	</div>
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

<Uploader bucket={b.name} prefix={data.prefix} />

<section class="card" aria-labelledby="files-h">
	<div class="card-bar">
		<h2 id="files-h" class="h3">{data.prefix ? `Files in ${data.prefix}` : 'Files'}</h2>
		<p class="muted">Sample files: the demo shows a few per bucket.</p>
	</div>
	<div class="table-wrap">
		<table class="tbl">
			<thead>
				<tr>
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
						<th scope="row" colspan="5">
							<a class="cell-link" href={bucketHref(b.name, parent)}>
								<Folder class="icon" aria-hidden="true" />Up one level
							</a>
						</th>
					</tr>
				{/if}
				{#each data.listing.folders as f (f.prefix)}
					<tr>
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
						<th scope="row" class="wrap-cell">
							<span class="fname"><FileIcon class="icon" aria-hidden="true" />{f.name}</span>
						</th>
						<td class="num">{bytes(f.size)}</td>
						<td class="hs mono">{f.type}</td>
						<td class="hs">{dateTime(f.modified)}</td>
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
					<tr><td colspan="5" class="muted">This folder is empty.</td></tr>
				{/if}
			</tbody>
		</table>
	</div>
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
</style>
