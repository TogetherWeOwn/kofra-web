<script lang="ts">
	let { href = '/', size = 24 }: { href?: string; size?: number } = $props();
</script>

<!-- The Kofra wordmark: a plain square mark plus the name in the page typeface. -->
<a class="logo" {href} aria-label="Kofra home">
	<svg
		class="mark"
		viewBox="0 0 24 24"
		width={size}
		height={size}
		aria-hidden="true"
		focusable="false"
	>
		<rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" /><path
			d="M8 6.5v11M8 12l6.5-5.5M10.2 10.2 15.5 17.5"
			stroke-width="2.2"
			fill="none"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg><span>Kofra</span>
</a>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--color-ink);
		text-decoration: none;
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-xl);
		letter-spacing: -0.01em;
		line-height: 1;
	}
	.mark {
		color: var(--color-accent);
		flex: none;
	}
	.mark path {
		stroke: var(--color-mark-ink);
	}
	@media (forced-colors: active) {
		.mark rect {
			fill: CanvasText;
		}
		.mark path {
			stroke: Canvas;
		}
	}
</style>
