<script lang="ts">
	import Csrf from '#lib/components/account/Csrf.svelte';
	import { bucketHref, stopUploadsAction } from '#lib/links.js';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Notice from '#lib/components/Notice.svelte';
	import PlanSummary from '#lib/components/PlanSummary.svelte';
	import ProblemNotice from '#lib/components/ProblemNotice.svelte';

	let { data, form } = $props();
	const name = $derived(data.bucket.name);
	const back = $derived(bucketHref(name));
</script>

<svelte:head>
	<title>Delete {name}: Kofra console</title>
	<meta name="description" content="Confirm that you want to delete the bucket {name}." />
</svelte:head>

<div class="ph">
	<div>
		<h1>Delete bucket {name}</h1>
		<p>Deleting a bucket cannot be undone.</p>
	</div>
</div>

{#if data.blocked}
	<Notice tone="warning" title={data.blockedTitle ?? 'This bucket cannot be deleted'}>
		<p>{data.blocked.message}</p>
		{#if data.blocked.hint}<p>{data.blocked.hint}</p>{/if}
		{#if data.recentUploads}
			<p>
				{data.recentUploads} upload{data.recentUploads === 1 ? ' was' : 's were'} started in the last
				13 hours and may still be sending. One left behind by a closed page can be stopped here once it
				is 13 hours old.
			</p>
		{/if}
		{#if data.unreachableUploads}
			<p>
				{data.unreachableUploads} unfinished upload{data.unreachableUploads === 1
					? ' has a name'
					: 's have names'} the console cannot address. Stop {data.unreachableUploads === 1
					? 'it'
					: 'them'} with an S3 tool (for example: aws s3api abort-multipart-upload).
			</p>
		{/if}
	</Notice>
	{#if data.uploads}
		<form class="card pad form" method="POST" action={stopUploadsAction(name)}>
			<Csrf />
			<p>
				{data.uploads} upload{data.uploads === 1 ? ' was' : 's were'} started in this bucket more than
				13 hours ago and never finished, for example when a page was closed during an upload. Stopping
				{data.uploads === 1 ? 'it' : 'them'} drops the parts sent so far; finished files are not touched.
			</p>
			<input type="hidden" name="token" value={data.uploadsToken} />
			<label class="check">
				<input type="checkbox" name="confirm" value="yes" required />
				<span>Stop the unfinished uploads in {name}</span>
			</label>
			<div class="actions">
				<button class="btn-plain" type="submit">Stop unfinished uploads</button>
			</div>
		</form>
	{/if}
	<p><a href={back}>Back to {name}</a></p>
{:else if data.plan}
	{#if form && 'problem' in form && form.problem}<ProblemNotice problem={form.problem} />{/if}
	<section class="card pad" aria-labelledby="plan-h">
		<h2 id="plan-h">What happens</h2>
		<PlanSummary plan={data.plan} />
	</section>
	<form class="card pad form" method="POST">
		<Csrf />
		<div class="field">
			<label for="confirm">Type <code>{name}</code> to confirm</label>
			<input
				class="input mono"
				id="confirm"
				name="confirm"
				required
				autocomplete="off"
				autocapitalize="none"
				spellcheck="false"
				aria-describedby={form && 'mismatch' in form ? 'confirm-err' : undefined}
				aria-invalid={form && 'mismatch' in form ? 'true' : undefined}
			/>
			{#if form && 'mismatch' in form}
				<p class="err" id="confirm-err">
					<CircleAlert class="icon" aria-hidden="true" />The name you typed does not match.
				</p>
			{/if}
		</div>
		<div class="actions">
			<button class="btn-danger" type="submit">Delete bucket</button>
			<a href={back}>Cancel</a>
		</div>
	</form>
{/if}
