<script lang="ts">
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
		{#if data.blocked.hint && !data.uploads}<p>{data.blocked.hint}</p>{/if}
	</Notice>
	{#if data.uploads}
		<form class="card pad form" method="POST" action={stopUploadsAction(name)}>
			<p>
				{data.uploads} upload{data.uploads === 1 ? ' was' : 's were'} started in this bucket and never
				finished, for example when a page was closed during an upload. Stopping {data.uploads === 1
					? 'it'
					: 'them'} drops the parts sent so far; finished files are not touched.
			</p>
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
