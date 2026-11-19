<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Button from './Button.svelte';
	import type { HeadingLevel, Plan } from './types.js';

	let { plans, headingLevel = 2 }: { plans: Plan[]; headingLevel?: HeadingLevel } = $props();
</script>

<!-- Plan cards: name, price with its unit, one call to action and what is included. -->
<ul class="plans">
	{#each plans as plan (plan.id)}
		<li class="plan" class:featured={plan.featured}>
			<svelte:element this={`h${headingLevel}`} class="name">{plan.name}</svelte:element>
			<p class="price">
				<span class="amt">{plan.price}</span> <span class="unit">{plan.unit}</span>
			</p>
			<p class="blurb">{plan.blurb}</p>
			<Button href={plan.cta.href} variant={plan.featured ? 'primary' : 'secondary'} block>
				{plan.cta.label}
			</Button>
			<ul class="checks" aria-label={`Included in ${plan.name}`}>
				{#each plan.features as line (line)}
					<li><Check size={17} strokeWidth={1.75} />{line}</li>
				{/each}
			</ul>
		</li>
	{/each}
</ul>

<style>
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.plans {
		display: grid;
		/* One equal column per plan; stacked on phones. */
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
		gap: var(--space-6);
	}
	.plan {
		display: flex;
		flex-direction: column;
		padding: var(--space-7);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
	}
	.featured {
		border-color: var(--color-accent);
		box-shadow: inset 0 3px 0 var(--color-accent);
	}
	.name {
		margin: 0;
		font-size: 20px;
		font-weight: var(--font-weight-semibold);
		line-height: var(--font-line-height-heading);
	}
	.price {
		margin: var(--space-4) 0 0;
	}
	.amt {
		font-size: 40px;
		font-weight: var(--font-weight-semibold);
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.unit {
		color: var(--color-muted);
		font-size: var(--font-size-md);
	}
	.blurb {
		color: var(--color-ink-2);
		margin: var(--space-2) 0 var(--space-6);
		min-height: 3.2em;
	}
	.checks {
		display: grid;
		gap: 10px;
		margin-top: var(--space-6);
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
	@media (max-width: 760px) {
		.plans {
			grid-auto-flow: row;
		}
		.blurb {
			min-height: 0;
		}
	}
	@media (forced-colors: active) {
		.featured {
			border-width: 3px;
		}
	}
</style>
