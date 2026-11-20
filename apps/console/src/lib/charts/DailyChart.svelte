<script lang="ts">
	// One series per day, as a stepped line (a level that holds through the day, such as
	// stored bytes) or as columns (a daily total, such as downloads). Single series, so no
	// legend box: the title names it. Provisional days carry a texture band and a word.
	// Everything is SVG attributes (no inline styles: the console's CSP forbids them), and
	// the hover readout is drawn in the SVG too. Keyboard: the plot is a slider over days.
	// The table under the chart holds every value, so nothing depends on hovering.
	import { byteScale, bytes, shortDay } from '#lib/format.js';
	import { labelIndexes, ticks, type DayValue } from './scale.js';

	let {
		id,
		title,
		description,
		days,
		kind,
		valueLabel,
		reference = null,
		legend = null
	}: {
		id: string;
		title: string;
		description: string;
		days: DayValue[];
		kind: 'step' | 'columns';
		/** Column header in the table view. */
		valueLabel: string;
		/** A horizontal reference line, such as the plan's storage limit. */
		reference?: { value: number; label: string } | null;
		/** Columns only: names for the current and context colours. */
		legend?: { current: string; context: string } | null;
	} = $props();

	let width = $state(720);
	const height = 240;
	const m = { top: 24, right: 12, bottom: 28, left: 64 };
	const plotW = $derived(Math.max(120, width - m.left - m.right));
	const plotH = height - m.top - m.bottom;

	const max = $derived(Math.max(1, ...days.map((d) => d.value), reference?.value ?? 0));
	const scale = $derived(byteScale(max));
	const yTicks = $derived(ticks(max / scale.div, 4));
	const yTop = $derived((yTicks.at(-1) ?? 1) * scale.div);
	const y = (v: number) => m.top + plotH - (v / yTop) * plotH;
	const band = $derived(plotW / Math.max(1, days.length));
	const x = (i: number) => m.left + i * band;
	const xLabels = $derived(new Set(labelIndexes(days.length, band, 64)));
	const colW = $derived(Math.min(24, Math.max(2, band - 2)));

	const stepPath = $derived(
		days
			.map(
				(d, i) =>
					`${i === 0 ? `M${x(0).toFixed(1)},` : 'V'}${y(d.value).toFixed(1)} H${x(i + 1).toFixed(1)}`
			)
			.join(' ')
	);
	const areaPath = $derived(
		days.length ? `${stepPath} V${y(0).toFixed(1)} H${x(0).toFixed(1)} Z` : ''
	);

	/** A column with a 4 px rounded top and a square base. */
	function column(i: number, v: number): string {
		const w = colW;
		const cx = x(i) + band / 2;
		const left = cx - w / 2;
		const top = y(v);
		const base = y(0);
		const h = base - top;
		if (h <= 0) return '';
		const r = Math.min(4, w / 2, h);
		return `M${left},${base} V${top + r} Q${left},${top} ${left + r},${top} H${left + w - r} Q${left + w},${top} ${left + w},${top + r} V${base} Z`;
	}

	const provisional = $derived(
		days.reduce<{ from: number; to: number } | null>((acc, d, i) => {
			if (!d.provisional) return acc;
			return acc ? { from: acc.from, to: i + 1 } : { from: i, to: i + 1 };
		}, null)
	);

	let active = $state<number | null>(null);
	const fmt = (v: number) => bytes(v);
	const readout = (i: number) =>
		`${shortDay(days[i]!.day)}: ${fmt(days[i]!.value)}${days[i]!.provisional ? ' (provisional)' : ''}`;

	function pick(e: PointerEvent) {
		const svg =
			(e.currentTarget as SVGElement).ownerSVGElement ?? (e.currentTarget as SVGSVGElement);
		const r = svg.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * width;
		const i = Math.floor((px - m.left) / band);
		active = i >= 0 && i < days.length ? i : null;
	}

	function key(e: KeyboardEvent) {
		if (!days.length) return;
		const last = days.length - 1;
		const cur = active ?? last;
		const next =
			e.key === 'ArrowLeft'
				? Math.max(0, cur - 1)
				: e.key === 'ArrowRight'
					? Math.min(last, cur + 1)
					: e.key === 'Home'
						? 0
						: e.key === 'End'
							? last
							: null;
		if (next === null) return;
		e.preventDefault();
		active = next;
	}

	const tip = $derived.by(() => {
		if (active === null) return null;
		const text = readout(active);
		const w = text.length * 7 + 16;
		const cx = x(active) + band / 2;
		const left = Math.min(Math.max(cx - w / 2, m.left), m.left + plotW - w);
		return { text, w, left, cx };
	});
</script>

<figure class="chart" aria-labelledby="{id}-t">
	<figcaption>
		<span class="t" id="{id}-t">{title}</span>
		<span class="d">{description}</span>
		{#if legend}
			<span class="legend">
				<span class="key">
					<svg width="12" height="12" aria-hidden="true">
						<rect class="col cur" width="12" height="12" rx="2" />
					</svg>{legend.current}
				</span>
				<span class="key">
					<svg width="12" height="12" aria-hidden="true">
						<rect class="col ctx" width="12" height="12" rx="2" />
					</svg>{legend.context}
				</span>
			</span>
		{/if}
	</figcaption>
	<div class="plot" bind:clientWidth={width}>
		<svg {width} {height} viewBox="0 0 {width} {height}" role="group" aria-labelledby="{id}-t">
			<defs>
				<pattern
					id="{id}-hatch"
					width="6"
					height="6"
					patternUnits="userSpaceOnUse"
					patternTransform="rotate(45)"
				>
					<line x1="0" y1="0" x2="0" y2="6" class="hatch" />
				</pattern>
			</defs>
			{#if provisional}
				<rect
					x={x(provisional.from)}
					y={m.top}
					width={(provisional.to - provisional.from) * band}
					height={plotH}
					fill="url(#{id}-hatch)"
					class="prov"
				/>
				<text x={x(provisional.to) - 4} y={m.top - 8} text-anchor="end" class="axis">
					Provisional
				</text>
			{/if}
			{#each yTicks as t (t)}
				<line
					x1={m.left}
					x2={m.left + plotW}
					y1={y(t * scale.div)}
					y2={y(t * scale.div)}
					class="grid"
				/>
				<text x={m.left - 8} y={y(t * scale.div) + 4} text-anchor="end" class="axis">
					{t}
					{scale.unit}
				</text>
			{/each}
			{#each days as d, i (d.day)}
				{#if xLabels.has(i)}
					<text x={x(i) + band / 2} y={height - 8} text-anchor="middle" class="axis">
						{shortDay(d.day)}
					</text>
				{/if}
			{/each}
			{#if kind === 'step'}
				<path d={areaPath} class="area" />
				<path d={stepPath} class="line" />
			{:else}
				{#each days as d, i (d.day)}
					<path
						d={column(i, d.value)}
						class="col {d.current === false ? 'ctx' : 'cur'}"
						class:hot={active === i}
					/>
				{/each}
			{/if}
			{#if reference}
				<line
					x1={m.left}
					x2={m.left + plotW}
					y1={y(reference.value)}
					y2={y(reference.value)}
					class="ref"
				/>
				<text x={m.left + 4} y={y(reference.value) - 6} class="axis ref-l">{reference.label}</text>
			{/if}
			{#if tip && active !== null}
				{#if kind === 'step'}
					<line x1={tip.cx} x2={tip.cx} y1={m.top} y2={m.top + plotH} class="cross" />
					<circle cx={tip.cx} cy={y(days[active]!.value)} r="4" class="dot" />
				{/if}
				<g class="tip">
					<rect x={tip.left} y={2} width={tip.w} height={20} rx="4" />
					<text x={tip.left + 8} y={16}>{tip.text}</text>
				</g>
			{/if}
			<!-- The hit area spans the whole plot; the pointer only has to be over a day. -->
			<rect
				class="hit"
				x={m.left}
				y={m.top}
				width={plotW}
				height={plotH}
				role="slider"
				tabindex="0"
				aria-label="{title}: day"
				aria-valuemin={0}
				aria-valuemax={Math.max(0, days.length - 1)}
				aria-valuenow={active ?? days.length - 1}
				aria-valuetext={days.length ? readout(active ?? days.length - 1) : 'No data'}
				onpointermove={pick}
				onpointerleave={() => (active = null)}
				onkeydown={key}
				onblur={() => (active = null)}
			/>
		</svg>
	</div>
	<details class="tv">
		<summary>Table view</summary>
		<div class="table-wrap">
			<table class="tbl">
				<thead>
					<tr>
						<th scope="col">Day</th><th scope="col" class="num">{valueLabel}</th><th scope="col">
							Status
						</th>
					</tr>
				</thead>
				<tbody>
					{#each days as d (d.day)}
						<tr>
							<th scope="row">{shortDay(d.day)}</th><td class="num">{fmt(d.value)}</td><td>
								{d.provisional ? 'Provisional' : 'Final'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</figure>

<style>
	.chart {
		margin: 0;
		display: grid;
		gap: var(--space-3);
	}
	figcaption {
		display: grid;
		gap: 2px;
	}
	.t {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}
	.d {
		font-size: var(--font-size-sm);
		color: var(--color-muted);
	}
	.legend {
		display: flex;
		gap: var(--space-4);
		font-size: var(--font-size-sm);
		color: var(--color-ink-2);
		margin-top: var(--space-1);
	}
	.key {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.plot {
		width: 100%;
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.grid {
		stroke: var(--color-line);
		stroke-width: 1;
	}
	.axis {
		fill: var(--color-muted);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}
	.line {
		fill: none;
		stroke: var(--color-accent);
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}
	.area {
		fill: var(--color-accent);
		fill-opacity: 0.1;
	}
	.col.cur {
		fill: var(--color-accent);
	}
	.col.ctx {
		fill: var(--color-border-strong);
	}
	.col.hot {
		fill-opacity: 0.75;
	}
	.ref {
		stroke: var(--color-ink-2);
		stroke-width: 1;
	}
	.ref-l {
		fill: var(--color-ink-2);
	}
	.hatch {
		stroke: var(--color-border-strong);
		stroke-width: 1;
		stroke-opacity: 0.45;
	}
	.cross {
		stroke: var(--color-ink-2);
		stroke-width: 1;
	}
	.dot {
		fill: var(--color-accent);
		stroke: var(--color-surface);
		stroke-width: 2;
	}
	.tip rect {
		fill: var(--color-ink);
	}
	.tip text {
		fill: var(--color-bg);
		font-size: 12px;
		font-weight: var(--font-weight-semibold);
	}
	.hit {
		fill: transparent;
		cursor: crosshair;
	}
	.hit:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
	.tv summary {
		cursor: pointer;
		font-size: var(--font-size-sm);
		color: var(--color-accent-text);
		width: max-content;
	}
	.tv .table-wrap {
		margin-top: var(--space-2);
	}
	@media (forced-colors: active) {
		.line,
		.ref,
		.cross {
			stroke: CanvasText;
		}
		.col.cur,
		.col.ctx,
		.dot {
			fill: CanvasText;
		}
	}
</style>
