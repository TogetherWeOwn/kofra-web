<script lang="ts">
	import { resolve } from '$app/paths';
	import { bucketConnectHref, bucketHref } from '#lib/links.js';
	import Download from '@lucide/svelte/icons/download';
	import DailyChart from '#lib/charts/DailyChart.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import UsageTile from '#lib/components/UsageTile.svelte';
	import { bytes, count, dateTime, percent, shortDay } from '#lib/format.js';

	let { data } = $props();
	const traffic = $derived(data.ws.features.traffic);
	const u = $derived(data.usage);
	const dl = $derived(u.downloads);
	const periodStart = $derived(u.downloads.period_start.slice(0, 10));
	const stored = $derived(
		data.days.map((d) => ({
			day: d.day,
			value: d.peak_stored_bytes,
			provisional: d.status !== 'final'
		}))
	);
	const downloads = $derived(
		data.days.map((d) => ({
			day: d.day,
			value: d.downloaded_bytes,
			provisional: d.status !== 'final',
			current: d.day >= periodStart
		}))
	);
	const requests = $derived(data.days.reduce((n, d) => n + d.requests_approx, 0));
	const totalStored = $derived(data.buckets.reduce((n, b) => n + b.stored_bytes, 0));
	const sorted = $derived([...data.buckets].sort((a, b) => b.stored_bytes - a.stored_bytes));
	const range = $derived(
		data.days.length
			? `${data.days.length} days to ${shortDay(data.days.at(-1)!.day)}`
			: 'No days yet'
	);
</script>

<svelte:head>
	<title>Usage: Kofra console</title>
	<meta
		name="description"
		content="Daily storage, downloads and per-bucket usage for your Kofra workspace."
	/>
</svelte:head>

<div class="ph">
	<div>
		<h1>Usage</h1>
		{#if traffic}
			<p>
				Updated {dateTime(u.as_of)}. Figures for the last two days are provisional and can still
				change.
			</p>
		{:else}
			<p>
				Updated {dateTime(u.as_of)}. Stored amounts only: uploads, downloads and requests are not
				measured for this workspace yet.
			</p>
		{/if}
	</div>
	{#if traffic}
		<div class="ph-act">
			<a class="btn-plain" href={resolve('/(app)/usage/export.csv')} download>
				<Download class="icon" aria-hidden="true" />Download CSV
			</a>
		</div>
	{/if}
</div>

{#if !data.countsComplete}
	<Notice tone="info" title="Still counting">
		<p>
			Stored amounts are being recounted after an update and may be lower than the real figures for
			a while.
		</p>
	</Notice>
{/if}

<ul class="tiles">
	<UsageTile
		label="Stored now"
		used={u.stored_bytes}
		limit={u.storage_limit_bytes}
		meterLabel="Storage used of the plan"
	/>
	{#if traffic}
		<UsageTile
			label="Uploads, last 24 hours"
			used={u.upload_24h.used_bytes}
			limit={u.upload_24h.limit_bytes}
			meterLabel="Uploads used of the 24-hour limit"
			detail="Resets {dateTime(u.upload_24h.resets_at)}"
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
			<p class="tile-l">Requests, last {data.days.length} days</p>
			<p class="tile-v">{count(requests)}</p>
			<p class="tile-s">Approximate. Requests are not charged.</p>
		</li>
	{:else}
		<li class="tile">
			<p class="tile-l">Files</p>
			<p class="tile-v">{count(u.object_count)}</p>
			<p class="tile-s">
				In {count(data.buckets.length)} bucket{data.buckets.length === 1 ? '' : 's'}
			</p>
		</li>
	{/if}
</ul>

{#if traffic}
	<section class="card pad" aria-label="Stored per day">
		<DailyChart
			id="stored"
			kind="step"
			title="Stored per day"
			description="Highest amount stored each day, {range}. Billing uses the monthly average."
			valueLabel="Stored"
			days={stored}
			reference={u.storage_limit_bytes === null
				? null
				: { value: u.storage_limit_bytes, label: `Plan limit ${bytes(u.storage_limit_bytes)}` }}
		/>
	</section>

	<section class="card pad" aria-label="Downloads per day">
		<DailyChart
			id="downloads"
			kind="columns"
			title="Downloads per day"
			description="Bytes downloaded each day, {range}."
			valueLabel="Downloaded"
			days={downloads}
			legend={{ current: 'This month', context: 'Earlier' }}
		/>
	</section>
{/if}

<section class="card" aria-labelledby="pb-h">
	<div class="card-bar">
		<h2 id="pb-h" class="h3">By bucket</h2>
		<p class="muted">
			{bytes(totalStored)} in {count(data.buckets.length)} bucket{data.buckets.length === 1
				? ''
				: 's'}
		</p>
	</div>
	<div class="table-wrap">
		<table class="tbl">
			<thead>
				<tr>
					<th scope="col">Bucket</th>
					<th scope="col" class="num">Stored</th>
					<th scope="col" class="hs">Share</th>
					<th scope="col" class="num hs">Files</th>
				</tr>
			</thead>
			<tbody>
				{#each sorted as b (b.bucket)}
					<tr>
						<th scope="row">
							{#if !data.open || data.open.includes(b.bucket)}
								<a class="cell-link" href={bucketHref(b.bucket)}>{b.bucket}</a>
							{:else}
								<a class="cell-link" href={bucketConnectHref(b.bucket)}>{b.bucket}</a>
							{/if}
						</th>
						<td class="num">{bytes(b.stored_bytes)}</td>
						<td class="hs">
							<span class="share">
								<svg width="120" height="8" aria-hidden="true">
									<rect class="share-track" width="120" height="8" rx="4" /><rect
										class="share-fill"
										width={Math.max(
											b.stored_bytes > 0 ? 2 : 0,
											(totalStored > 0 ? b.stored_bytes / totalStored : 0) * 120
										)}
										height="8"
										rx="4"
									/>
								</svg>
								<span>{percent(b.stored_bytes, totalStored)}</span>
							</span>
						</td>
						<td class="num hs">{count(b.object_count)}</td>
					</tr>
				{:else}
					<tr><td colspan="4" class="muted">No buckets yet.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.share {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.share-track {
		fill: var(--color-accent-soft);
	}
	.share-fill {
		fill: var(--color-accent);
	}
</style>
