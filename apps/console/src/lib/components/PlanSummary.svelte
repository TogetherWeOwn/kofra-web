<script lang="ts">
	import type { Plan } from '@kofra/api';
	import { bytes, count } from '#lib/format.js';

	let { plan }: { plan: Plan } = $props();
	const t = $derived(plan.totals);
</script>

<!-- The API's own dry-run answer: what the action will change, before anything changes. -->
<div class="plan">
	<p>{plan.summary}</p>
	<dl class="kv">
		<dt>Can be undone</dt>
		<dd>{plan.reversible ? 'Yes' : 'No'}</dd>
		{#if t.buckets}<dt>Buckets</dt>
			<dd>{count(t.buckets)}</dd>{/if}
		{#if t.objects}<dt>Files</dt>
			<dd>{count(t.objects)}</dd>{/if}
		{#if t.stored_bytes}<dt>Stored</dt>
			<dd>{bytes(t.stored_bytes)}</dd>{/if}
		{#if t.keys}<dt>Access keys</dt>
			<dd>{count(t.keys)}</dd>{/if}
	</dl>
</div>

<style>
	.plan {
		display: grid;
		gap: var(--space-3);
	}
</style>
