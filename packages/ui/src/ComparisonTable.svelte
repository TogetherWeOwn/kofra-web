<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Minus from '@lucide/svelte/icons/minus';
	import type { CompareRow } from './types.js';

	type Props = {
		/** Column headings after the row label column, for example the plan names. */
		columns: string[];
		rows: CompareRow[];
		/** Names the table (visually hidden caption) and, through it, the scroll region. */
		label: string;
		/** Header of the row-label column. */
		rowHeader?: string;
		/** Show the row-label header; hidden by default, when the row labels speak for themselves. */
		showRowHeader?: boolean;
		/** Indexes (into `columns`) of columns to hide on phones; the detail must be available elsewhere. */
		secondary?: number[];
	};

	let {
		columns,
		rows,
		label,
		rowHeader = 'Feature',
		showRowHeader = false,
		secondary = []
	}: Props = $props();
	const hs = (i: number) => (secondary.includes(i) ? 'hs' : undefined);
	const uid = $props.id();
</script>

<!-- Scrolls sideways on narrow screens; the region is focusable so keyboard users can scroll it too
     (WCAG 2.1.1; axe rule scrollable-region-focusable). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="scroll" role="region" aria-labelledby="{uid}-caption" tabindex="0">
	<table class:labels={!showRowHeader}>
		<caption class="sr" id="{uid}-caption">{label}</caption>
		<thead>
			<tr>
				<th scope="col">
					{#if showRowHeader}{rowHeader}{:else}<span class="sr">{rowHeader}</span>{/if}
				</th>
				{#each columns as col, i (col)}<th scope="col" class={hs(i)}>{col}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.label)}
				<tr>
					<th scope="row">{row.label}</th>
					{#each row.values as value, i (i)}
						<td class={hs(i)}>
							{#if value === true}<Check class="yes" size={18} strokeWidth={1.75} /><span
									class="sr"
								>
									Included
								</span>{:else if value === false}<Minus
									class="no"
									size={18}
									strokeWidth={1.75}
								/><span class="sr">Not included</span>{:else}{value}{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.scroll {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--font-size-md);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
	}
	th,
	td {
		padding: 14px var(--space-4);
		border-bottom: 1px solid var(--color-line);
		vertical-align: top;
		text-align: left;
	}
	thead th {
		font-size: var(--font-size-xs);
		color: var(--color-muted);
		font-weight: var(--font-weight-semibold);
		background: var(--color-band);
	}
	tbody th {
		font-weight: var(--font-weight-semibold);
	}
	/* Descriptive row labels (a feature list) get a fixed share of the width and a lighter weight. */
	.labels tbody th {
		font-weight: var(--font-weight-medium);
		width: 34%;
	}
	td :global(.yes) {
		color: var(--color-success);
	}
	td :global(.no) {
		color: var(--color-muted);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}
	@media (max-width: 640px) {
		.hs {
			display: none;
		}
		th,
		td {
			padding: 10px var(--space-2);
			font-size: var(--font-size-sm);
		}
	}
</style>
