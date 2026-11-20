<script lang="ts">
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '@kofra/ui';
	import CopyField from '#lib/components/CopyField.svelte';
	import UsageTile from '#lib/components/UsageTile.svelte';
	import { describeEvent } from '#lib/events.js';
	import { ago, bytes, count, dateTime, percent } from '#lib/format.js';
	import { REGION } from '#lib/snippets.js';

	let { data } = $props();
	const u = $derived(data.usage);
	const dl = $derived(u.downloads);
</script>

<svelte:head>
	<title>Overview: Kofra console</title>
	<meta name="description" content="Storage, uploads and downloads for your Kofra workspace." />
</svelte:head>

<div class="ph">
	<div>
		<h1>Overview</h1>
		<p>Updated {dateTime(u.as_of)}.</p>
	</div>
	<div class="ph-act">
		<Button href={resolve('/(app)/buckets/new')}><Plus aria-hidden="true" />Create bucket</Button>
		<Button href={resolve('/(app)/keys/new')} variant="secondary">
			<Plus aria-hidden="true" />Create access key
		</Button>
	</div>
</div>

<ul class="tiles">
	<UsageTile
		label="Stored"
		used={u.stored_bytes}
		limit={u.storage_limit_bytes}
		meterLabel="Storage used of the plan"
	/>
	<UsageTile
		label="Uploads, last 24 hours"
		used={u.upload_24h.used_bytes}
		limit={u.upload_24h.limit_bytes}
		meterLabel="Uploads used of the 24-hour limit"
		detail="{bytes(u.upload_24h.remaining_bytes ?? 0)} left until {dateTime(
			u.upload_24h.resets_at
		)}"
	/>
	<UsageTile
		label="Downloads this month"
		used={dl.used_bytes}
		limit={dl.allowance_bytes}
		meterLabel="Downloads used of the included allowance"
		detail={dl.allowance_bytes === null
			? undefined
			: `${percent(dl.used_bytes, dl.allowance_bytes)} of ${bytes(dl.allowance_bytes)} included`}
		noLimit="No download allowance applies"
	/>
	<li class="tile">
		<p class="tile-l">Files</p>
		<p class="tile-v">{count(u.object_count)}</p>
		<p class="tile-s">
			In {count(data.bucketCount)}{data.moreBuckets ? '+' : ''} bucket{data.bucketCount === 1
				? ''
				: 's'}, with
			{count(data.keyCount)} access key{data.keyCount === 1 ? '' : 's'}
		</p>
	</li>
</ul>

<div class="two">
	<section class="card pad" aria-labelledby="connect-h">
		<h2 id="connect-h">Connect a tool</h2>
		<p class="muted">
			Use these with rclone, the AWS CLI, restic or any S3 SDK, plus an access key.
		</p>
		<CopyField id="endpoint" label="S3 endpoint" value={data.account.s3_endpoint} />
		<CopyField id="region" label="Region" value={REGION} />
		<p><a href={resolve('/(app)/keys/new')}>Create an access key</a></p>
	</section>
	<section class="card pad" aria-labelledby="recent-h">
		<h2 id="recent-h">Recent activity</h2>
		{#if data.recent.length}
			<ul class="events">
				{#each data.recent as e (e.id)}
					<li>
						<span>{describeEvent(e)}</span><time class="muted" datetime={e.created_at}>
							{ago(e.created_at)}
						</time>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">Nothing has happened in this workspace yet.</p>
		{/if}
	</section>
</div>

<style>
	.events {
		display: grid;
		gap: var(--space-2);
		font-size: var(--font-size-sm);
	}
	.events li {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		border-bottom: 1px solid var(--color-line);
		padding-bottom: var(--space-2);
	}
	.events li:last-child {
		border-bottom: 0;
	}
	.events time {
		white-space: nowrap;
	}
</style>
