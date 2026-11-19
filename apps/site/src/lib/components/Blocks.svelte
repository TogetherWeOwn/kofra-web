<script lang="ts">
	import { Callout, CodeBlock } from '@kofra/ui';
	import { headingId, type Block } from '#lib/blocks.js';
	import Inline from './Inline.svelte';

	let { blocks }: { blocks: Block[] } = $props();
	const uid = $props.id();
</script>

<!-- Renders the prose content model. Every block type has a Markdown twin in blocks.ts. -->
{#each blocks as b, i (i)}
	{#if b.type === 'h2'}
		<h2 id={headingId(b)}><Inline text={b.text} /></h2>
	{:else if b.type === 'h3'}
		<h3 id={headingId(b)}><Inline text={b.text} /></h3>
	{:else if b.type === 'p'}
		<p><Inline text={b.text} /></p>
	{:else if b.type === 'ul'}
		<ul>
			{#each b.items as item, j (j)}<li><Inline text={item} /></li>{/each}
		</ul>
	{:else if b.type === 'ol'}
		<ol>
			{#each b.items as item, j (j)}<li><Inline text={item} /></li>{/each}
		</ol>
	{:else if b.type === 'code'}
		<div class="code"><CodeBlock code={b.code} title={b.title} /></div>
	{:else if b.type === 'table'}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="table" role="region" aria-labelledby="{uid}-t{i}" tabindex="0">
			<table>
				<caption id="{uid}-t{i}">{b.caption}</caption>
				<thead>
					<tr>
						{#each b.head as h, j (j)}<th scope="col">{h}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each b.rows as row, r (r)}
						<tr>
							{#each row as c, j (j)}
								{#if j === 0}<th scope="row"><Inline text={c} /></th>{:else}<td>
										<Inline text={c} />
									</td>{/if}
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if b.type === 'note'}
		<div class="note">
			<Callout tone={b.tone} title={b.title}><p><Inline text={b.text} /></p></Callout>
		</div>
	{:else if b.type === 'dl'}
		<dl class="kv">
			{#each b.items as [term, value] (term)}
				<div>
					<dt>{term}</dt>
					<dd><Inline text={value} /></dd>
				</div>
			{/each}
		</dl>
	{/if}
{/each}

<style>
	.table {
		margin: var(--space-4) 0 var(--space-6);
		overflow-x: auto;
	}
	table {
		font-size: var(--font-size-md);
		background: var(--color-surface);
		border: 1px solid var(--color-line);
	}
	caption {
		text-align: left;
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-sm);
		color: var(--color-ink);
		padding-bottom: var(--space-2);
	}
	th,
	td {
		padding: 10px var(--space-3);
		border-bottom: 1px solid var(--color-line);
		vertical-align: top;
		text-align: left;
	}
	thead th {
		font-size: var(--font-size-xs);
		color: var(--color-muted);
		background: var(--color-band);
	}
	tbody th {
		font-weight: var(--font-weight-medium);
		min-width: 10em;
	}
	td :global(code),
	th :global(code) {
		overflow-wrap: anywhere;
	}
	td {
		color: var(--color-ink-2);
	}
	.note,
	.code {
		margin: var(--space-4) 0 var(--space-6);
	}
	.note :global(p) {
		margin: 0;
		color: inherit;
	}
</style>
