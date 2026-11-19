<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Minus from '@lucide/svelte/icons/minus';
	import type { CompareRow } from './types.js';

	type Props = {
		/** Column headings after the row label column, for example the plan names. */
		columns: string[];
		rows: CompareRow[];
		/** Names the table for assistive technology and the scroll region. */
		label: string;
		/** Header of the row-label column; visually hidden. */
		rowHeader?: string;
	};

	let { columns, rows, label, rowHeader = 'Feature' }: Props = $props();
</script>

<!-- Scrolls sideways on narrow screens; the region is focusable so keyboard users can scroll it too
     (WCAG 2.1.1; axe rule scrollable-region-focusable). -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="wrap" role="region" aria-label={label} tabindex="0">
	<table>
		<caption class="sr">{label}</caption>
		<thead>
			<tr>
				<th scope="col"><span class="sr">{rowHeader}</span></th>
				{#each columns as col (col)}<th scope="col">{col}</th>{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as row (row.label)}
				<tr>
					<th scope="row">{row.label}</th>
					{#each row.values as value, i (i)}
						<td>
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
	.wrap {
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
		th,
		td {
			padding: 10px var(--space-2);
			font-size: var(--font-size-sm);
		}
	}
</style>
