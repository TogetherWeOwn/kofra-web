<script lang="ts">
	import { resolve } from '$app/paths';
	import { keyRevokeHref } from '#lib/links.js';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@kofra/ui';
	import CopyField from '#lib/components/CopyField.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import { ago, count, date } from '#lib/format.js';
	import { grantSummary } from '#lib/grants.js';
	import { REGION } from '#lib/snippets.js';

	let { data } = $props();
	const full = $derived(data.keys.length >= data.limit);
</script>

<svelte:head>
	<title>Access keys: Kofra console</title>
	<meta
		name="description"
		content="Create and revoke the access keys S3 tools use to reach your buckets."
	/>
</svelte:head>

<div class="ph">
	<div>
		<h1>Access keys</h1>
		<p>Keys let S3 tools reach your buckets. The secret is shown once, when you create the key.</p>
	</div>
	<div class="ph-act">
		{#if full}
			<Button disabled>Create access key</Button>
		{:else}
			<Button href={resolve('/(app)/keys/new')}>
				<Plus aria-hidden="true" />Create access key
			</Button>
		{/if}
	</div>
</div>

{#if data.revoked}
	<Notice tone="success" title="Key revoked" live>
		<p>Requests signed with {data.revoked} are refused from now on.</p>
	</Notice>
{/if}
{#if full}
	<Notice tone="warning" title="Key limit reached">
		<p>A workspace can have {data.limit} active keys. Revoke one to create another.</p>
	</Notice>
{/if}

<section class="card pad conn" aria-labelledby="ep-h">
	<h2 id="ep-h" class="sr-only">Connection details</h2>
	<CopyField id="endpoint" label="S3 endpoint" value={data.endpoint} />
	<CopyField id="region" label="Region" value={REGION} />
</section>

<section class="card" aria-labelledby="keys-h">
	<div class="card-bar">
		<h2 id="keys-h" class="h3">Active keys</h2>
		<p class="muted">{count(data.keys.length)} of {count(data.limit)}</p>
	</div>
	{#if data.keys.length}
		<div class="table-wrap">
			<table class="tbl">
				<thead>
					<tr>
						<th scope="col">Name</th>
						<th scope="col" class="hs">Key ID</th>
						<th scope="col">Access</th>
						<th scope="col" class="hs">Created</th>
						<th scope="col" class="hs">Last used</th>
						<th scope="col"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.keys as k (k.id)}
						<tr>
							<th scope="row">{k.name ?? 'Unnamed key'}</th>
							<td class="hs mono">{k.id}</td>
							<td class="wrap-cell">{grantSummary(k.grants)}</td>
							<td class="hs">{date(k.created_at)}</td>
							<td class="hs">{k.last_used_at ? ago(k.last_used_at) : 'Never'}</td>
							<td class="act">
								<a
									class="link-danger"
									href={keyRevokeHref(k.id)}
									aria-label="Revoke key {k.name ?? k.id}"
								>
									Revoke
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="empty">
			<p>No access keys yet.</p>
			<Button href={resolve('/(app)/keys/new')}>
				<Plus aria-hidden="true" />Create access key
			</Button>
		</div>
	{/if}
</section>

<style>
	.conn {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4) var(--space-10);
	}
	.conn > :global(*) {
		margin-top: 0 !important;
	}
	.empty {
		padding: var(--space-8) var(--space-4);
		display: grid;
		gap: var(--space-4);
		justify-items: start;
	}
</style>
