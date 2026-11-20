<script lang="ts">
	import { resolve } from '$app/paths';
	import { bucketDeleteHref, bucketHref, bucketsPageHref } from '#lib/links.js';
	import Database from '@lucide/svelte/icons/database';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@kofra/ui';
	import Notice from '#lib/components/Notice.svelte';
	import { bytes, count, date } from '#lib/format.js';

	let { data } = $props();
	const total = $derived(data.buckets.reduce((n, b) => n + b.stored_bytes, 0));
</script>

<svelte:head>
	<title>Buckets: Kofra console</title>
	<meta
		name="description"
		content="Create, browse and delete the buckets in your Kofra workspace."
	/>
</svelte:head>

<div class="ph">
	<div>
		<h1>Buckets</h1>
		<p>A bucket holds files. Reach it with any S3 tool, or browse it here.</p>
	</div>
	<div class="ph-act">
		<Button href={resolve('/(app)/buckets/new')}><Plus aria-hidden="true" />Create bucket</Button>
	</div>
</div>

{#if data.deleted}
	<Notice tone="success" title="Bucket deleted" live>
		<p>The bucket {data.deleted} is gone.</p>
	</Notice>
{/if}

<section class="card" aria-labelledby="list-h">
	<div class="card-bar">
		<h2 id="list-h" class="h3">All buckets</h2>
		<p class="muted">
			{count(data.buckets.length)}{data.next ? '+' : ''} bucket{data.buckets.length === 1
				? ''
				: 's'}{#if !data.paged && !data.next}, {bytes(total)} stored{/if}
		</p>
	</div>
	{#if data.buckets.length}
		<div class="table-wrap">
			<table class="tbl">
				<thead>
					<tr>
						<th scope="col">Name</th>
						<th scope="col" class="num">Size</th>
						<th scope="col" class="num hs">Files</th>
						<th scope="col" class="hs">Created</th>
						<th scope="col"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.buckets as b (b.name)}
						<tr>
							<th scope="row">
								<a class="cell-link" href={bucketHref(b.name)}>
									<Database class="icon" aria-hidden="true" />{b.name}
								</a>
							</th>
							<td class="num">{bytes(b.stored_bytes)}</td>
							<td class="num hs">{count(b.object_count)}</td>
							<td class="hs">{date(b.created_at)}</td>
							<td class="act">
								<a
									class="link-danger"
									href={bucketDeleteHref(b.name)}
									aria-label="Delete bucket {b.name}"
								>
									Delete
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if data.next || data.paged}
			<p class="pager">
				{#if data.paged}<a href={resolve('/(app)/buckets')}>First page</a>{/if}
				{#if data.next}<a href={bucketsPageHref(data.next)}>Next page</a>{/if}
			</p>
		{/if}
	{:else}
		<div class="empty">
			<p>No buckets yet. Create one to start storing files.</p>
			<Button href={resolve('/(app)/buckets/new')}><Plus aria-hidden="true" />Create bucket</Button>
		</div>
	{/if}
</section>

<style>
	.empty {
		padding: var(--space-8) var(--space-4);
		display: grid;
		gap: var(--space-4);
		justify-items: start;
	}
	.pager {
		display: flex;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--color-line);
	}
</style>
