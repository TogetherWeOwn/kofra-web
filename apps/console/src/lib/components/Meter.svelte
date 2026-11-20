<script lang="ts">
	/**
	 * Used against included, as a bar (never a donut). The fill is the accent, then the
	 * warning colour from 80% and the danger colour at 100%, always with the words beside it.
	 * Sized with SVG attributes, so the strict style policy needs no inline styles.
	 */
	let { value, max, label, text }: { value: number; max: number; label: string; text: string } =
		$props();
	const ratio = $derived(max > 0 ? Math.min(1, Math.max(0, value / max)) : 0);
	const tone = $derived(ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warning' : 'ok');
	// A sliver stays visible for small non-zero values.
	const shown = $derived(value > 0 ? Math.max(ratio, 0.01) : 0);
</script>

<div
	class="meter"
	role="meter"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={max}
	aria-valuenow={Math.min(value, max)}
	aria-valuetext={text}
>
	<svg width="100%" height="8" aria-hidden="true" focusable="false">
		<rect class="track" x="0" y="0" width="100%" height="8" rx="4" />
		{#if shown > 0}<rect
				class="fill {tone}"
				x="0"
				y="0"
				width="{shown * 100}%"
				height="8"
				rx="4"
			/>{/if}
	</svg>
</div>

<style>
	.meter svg {
		display: block;
	}
	.track {
		fill: var(--color-accent-soft);
	}
	.fill.ok {
		fill: var(--color-accent);
	}
	.fill.warning {
		fill: var(--color-warning);
	}
	.fill.danger {
		fill: var(--color-danger);
	}
	@media (forced-colors: active) {
		.track {
			fill: Canvas;
			stroke: CanvasText;
		}
		.fill {
			fill: Highlight;
		}
	}
</style>
