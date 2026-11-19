<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { Callout, ComparisonTable, FAQ, PricingTable } from '@kofra/ui';
	import PageHead from '#lib/components/PageHead.svelte';
	import { COMPARE, EXAMPLE_BILL, EXAMPLE_NOTE, FAQ_PRICING, PLANS, money } from '#lib/content.js';
	import { PRICING } from '#lib/pages/pricing.js';
</script>

<PageHead heading={PRICING.heading} lead={PRICING.lead}>
	<Callout tone="info"><p>{EXAMPLE_NOTE}</p></Callout>
</PageHead>

<section class="sec sec-tight" aria-label="Plans">
	<div class="wrap">
		<PricingTable plans={PLANS} />
	</div>
</section>

<section class="sec sec-tight" aria-labelledby="cmp-h">
	<div class="wrap">
		<h2 id="cmp-h" class="h2-sm">Compare plans</h2>
		<ComparisonTable label="Plan comparison" columns={PLANS.map((p) => p.name)} rows={COMPARE} />
	</div>
</section>

<section class="sec sec-tight" aria-labelledby="bill-h">
	<div class="wrap bill-grid">
		<div>
			<h2 id="bill-h" class="h2-sm">{EXAMPLE_BILL.title}</h2>
			<table class="bill">
				<caption class="sr-only">{EXAMPLE_BILL.title}</caption>
				<thead>
					<tr>
						<th scope="col">Item</th><th scope="col">Usage</th><th scope="col" class="num">
							Amount
						</th>
					</tr>
				</thead>
				<tbody>
					{#each EXAMPLE_BILL.lines as line (line.item)}
						<tr>
							<th scope="row">{line.item}</th>
							<td>{line.usage}</td>
							<td class="num">{money(line.amount)}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr>
						<th scope="row" colspan="2">Total for the month</th>
						<td class="num">{money(EXAMPLE_BILL.total)}</td>
					</tr>
				</tfoot>
			</table>
		</div>
		<div>
			<h2 class="h2-sm" id="how-h">{PRICING.how.heading}</h2>
			<ul class="checks" aria-labelledby="how-h">
				{#each PRICING.how.lines as line (line)}
					<li><Check size={17} strokeWidth={1.75} />{line}</li>
				{/each}
			</ul>
		</div>
	</div>
</section>

<section class="sec sec-alt" aria-labelledby="pfaq-h">
	<div class="wrap faq-grid">
		<div><h2 id="pfaq-h">{PRICING.faqHeading}</h2></div>
		<FAQ items={FAQ_PRICING} />
	</div>
</section>

<style>
	.bill-grid {
		display: grid;
		grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
		gap: var(--space-14);
	}
	.bill {
		font-size: var(--font-size-md);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
	}
	.bill th,
	.bill td {
		padding: 14px var(--space-4);
		border-bottom: 1px solid var(--color-line);
		vertical-align: top;
	}
	.bill thead th {
		font-size: var(--font-size-xs);
		color: var(--color-muted);
		background: var(--color-band);
	}
	.bill tbody th {
		font-weight: var(--font-weight-medium);
	}
	.bill tfoot th,
	.bill tfoot td {
		font-weight: var(--font-weight-semibold);
		border-bottom: 0;
	}
	.num {
		text-align: right;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.checks {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--font-size-md);
	}
	.checks li {
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}
	.checks :global(svg) {
		flex: none;
		color: var(--color-success);
		margin-top: 3px;
	}
	@media (max-width: 1000px) {
		.bill-grid {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-10);
		}
	}
	@media (max-width: 640px) {
		.bill th,
		.bill td {
			padding: 10px var(--space-2);
			font-size: var(--font-size-sm);
		}
	}
</style>
