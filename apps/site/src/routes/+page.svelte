<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import { Button, ComparisonTable, FAQ, FeatureGrid, Link, ToolBadges } from '@kofra/ui';
	import ConsoleShot from '#lib/components/ConsoleShot.svelte';
	import ToolExamples from '#lib/components/ToolExamples.svelte';
	import {
		EARLY_ACCESS,
		EXAMPLE_NOTE,
		FAQ_HOME,
		FEATURES,
		PLAN_SUMMARY,
		SECURITY,
		TOOLS
	} from '#lib/content.js';
	import { HOME } from '#lib/pages/home.js';
</script>

<section class="hero">
	<div class="wrap hero-grid">
		<div>
			<p class="eyebrow">{HOME.hero.eyebrow}</p>
			<h1>{HOME.hero.heading}</h1>
			<p class="lead">{HOME.hero.lead}</p>
			<div class="cta-row">
				<Button href={EARLY_ACCESS} size="lg">Get early access</Button>
				<Button href="/pricing" variant="secondary" size="lg">View pricing</Button>
			</div>
			<ul class="proof">
				{#each HOME.hero.proof as line (line)}
					<li><Check size={18} strokeWidth={1.75} />{line}</li>
				{/each}
			</ul>
			<p class="fine">{HOME.hero.fine}</p>
		</div>
		<div class="hero-shot"><ConsoleShot /></div>
	</div>
</section>

<section class="tools-strip" aria-labelledby="works-h">
	<div class="wrap tools-in">
		<ToolBadges tools={TOOLS} headingId="works-h" />
	</div>
</section>

<section class="sec" id="product" aria-labelledby="feat-h">
	<div class="wrap">
		<div class="sec-head">
			<h2 id="feat-h">{HOME.features.heading}</h2>
			<p>{HOME.features.lead}</p>
		</div>
		<FeatureGrid items={FEATURES} />
	</div>
</section>

<section class="sec sec-alt" id="s3" aria-labelledby="s3-h">
	<div class="wrap s3-grid">
		<div>
			<h2 id="s3-h">{HOME.s3.heading}</h2>
			<p class="s3-lead">{HOME.s3.lead}</p>
			<dl class="kv">
				{#each HOME.s3.facts as [term, value] (term)}
					<div>
						<dt>{term}</dt>
						<dd>
							{#if term === 'Endpoint' || term === 'Region'}<code>{value}</code>{:else}{value}{/if}
						</dd>
					</div>
				{/each}
			</dl>
			<p class="more"><Link href="/docs" variant="arrow">{HOME.s3.more}</Link></p>
		</div>
		<ToolExamples />
	</div>
</section>

<section class="sec" aria-labelledby="price-h">
	<div class="wrap">
		<div class="sec-head">
			<h2 id="price-h">{HOME.pricing.heading}</h2>
			<p>{HOME.pricing.lead} {EXAMPLE_NOTE}</p>
		</div>
		<ComparisonTable
			label="Plan summary"
			rowHeader="Plan"
			showRowHeader
			columns={['Storage', 'Downloads', 'API requests', 'Smallest bill']}
			rows={PLAN_SUMMARY}
			secondary={[2, 3]}
		/>
		<p class="after"><Link href="/pricing" variant="arrow">{HOME.pricing.more}</Link></p>
	</div>
</section>

<section class="sec sec-alt" id="security" aria-labelledby="sec-h">
	<div class="wrap">
		<div class="sec-head">
			<h2 id="sec-h">{HOME.security.heading}</h2>
			<p>{HOME.security.lead}</p>
		</div>
		<FeatureGrid items={SECURITY} variant="list" />
	</div>
</section>

<section class="sec" aria-labelledby="faq-h">
	<div class="wrap faq-grid">
		<div>
			<h2 id="faq-h">{HOME.faq.heading}</h2>
			<p class="muted"><Link href="/faq" variant="arrow">{HOME.faq.more}</Link></p>
		</div>
		<FAQ items={FAQ_HOME} />
	</div>
</section>

<section class="cta-band" aria-labelledby="cta-h">
	<div class="wrap cta-in">
		<div>
			<h2 id="cta-h">{HOME.cta.heading}</h2>
			<p>{HOME.cta.lead}</p>
		</div>
		<div class="cta-row">
			<Button href={EARLY_ACCESS} size="lg">Get early access</Button>
			<Button href="/docs" variant="secondary" size="lg">Read the docs</Button>
		</div>
	</div>
</section>

<style>
	.hero {
		padding: var(--space-18) 0 var(--space-20);
	}
	.hero-grid {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		gap: var(--space-14);
		align-items: center;
	}
	.eyebrow {
		margin: 0 0 14px;
		color: var(--color-accent-text);
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-sm);
	}
	h1 {
		margin: 0;
		font-size: var(--font-size-6xl);
		line-height: var(--font-line-height-tight);
		font-weight: var(--font-weight-semibold);
		letter-spacing: calc(var(--font-tracking-tight) * 1em);
	}
	.proof {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-6);
		margin: 28px 0 0;
		padding: 0;
		list-style: none;
		font-size: var(--font-size-md);
		color: var(--color-ink-2);
	}
	.proof li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.proof :global(svg) {
		color: var(--color-success);
		flex: none;
	}
	.fine {
		margin: 10px 0 0;
		font-size: var(--font-size-xs);
		color: var(--color-muted);
	}
	.tools-strip {
		background: var(--color-band);
		border-top: 1px solid var(--color-line);
		border-bottom: 1px solid var(--color-line);
	}
	.tools-in {
		padding-top: var(--space-5);
		padding-bottom: var(--space-5);
	}
	.s3-grid {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		gap: var(--space-14);
		align-items: start;
	}
	.s3-lead {
		margin: var(--space-4) 0 0;
		color: var(--color-ink-2);
	}
	.more {
		margin: 0;
	}
	@media (max-width: 1000px) {
		.hero-grid,
		.s3-grid {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-10);
		}
	}
	@media (max-width: 640px) {
		.hero {
			padding: var(--space-10) 0 var(--space-14);
		}
		h1 {
			font-size: var(--font-size-4xl);
		}
	}
</style>
