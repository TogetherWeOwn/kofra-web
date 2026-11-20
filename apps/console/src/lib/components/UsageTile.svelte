<script lang="ts">
	import Meter from './Meter.svelte';
	import { bytes, percent } from '#lib/format.js';

	let {
		label,
		used,
		limit,
		meterLabel,
		detail,
		noLimit = 'No limit applies'
	}: {
		label: string;
		used: number;
		limit: number | null;
		/** Names the meter for assistive technology. */
		meterLabel: string;
		/** The line under the meter; defaults to "N% of LIMIT". */
		detail?: string;
		noLimit?: string;
	} = $props();

	const sub = $derived(
		limit === null ? noLimit : (detail ?? `${percent(used, limit)} of ${bytes(limit)}`)
	);
	// Screen readers always hear the amounts; the visible line may say something else.
	const amounts = $derived(
		limit === null ? '' : `${bytes(used)} used, ${percent(used, limit)} of ${bytes(limit)}`
	);
	const valueText = $derived(detail ? `${amounts}. ${detail}` : amounts);
</script>

<li class="tile">
	<p class="tile-l">{label}</p>
	<p class="tile-v">{bytes(used)}</p>
	{#if limit !== null}<Meter value={used} max={limit} label={meterLabel} text={valueText} />{/if}
	<p class="tile-s">{sub}</p>
</li>
