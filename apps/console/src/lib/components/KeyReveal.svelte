<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Grant } from '@kofra/api';
	import CopyButton from './CopyButton.svelte';
	import CopyField from './CopyField.svelte';
	import Notice from './Notice.svelte';
	import { grantSummary } from '#lib/grants.js';
	import { awsCliCommands, envLines, rcloneConfig } from '#lib/snippets.js';

	let {
		created,
		token,
		sample = true
	}: {
		sample?: boolean;
		token?: { name: string; token: string | null };
		created?: {
			id: string;
			name: string | null;
			grants: Grant[];
			secret: string | null;
			endpoint: string;
		};
	} = $props();

	const material = $derived(
		created?.secret ? { id: created.id, secret: created.secret, endpoint: created.endpoint } : null
	);
	const blocks = $derived(
		material
			? [
					{ id: 'env', title: 'Environment variables', text: envLines(material) },
					{
						id: 'rclone',
						title: 'rclone remote (add to rclone.conf)',
						text: rcloneConfig(material)
					},
					{ id: 'aws', title: 'AWS CLI profile', text: awsCliCommands(material) }
				]
			: []
	);
	const envHref = $derived(
		material ? `data:text/plain;charset=utf-8,${encodeURIComponent(envLines(material) + '\n')}` : ''
	);
</script>

{#if token}
	<section class="card pad reveal" aria-labelledby="token-reveal">
		<h2 id="token-reveal">Token {token.name} created</h2>
		{#if token.token}
			<Notice tone="warning" live><p>Copy it now. You will not see it again.</p></Notice>
			<CopyField id="api-token" label="API token" value={token.token} />
			{#if sample}<p>In this demo the token works nowhere: it is sample data.</p>{/if}
		{/if}
		<p><a href={resolve('/(app)/tokens')}>Done</a></p>
	</section>
{:else if created}
	<Notice tone="warning" title="Copy the secret now" live>
		<p>
			This is the only time the secret is shown. If you lose it, revoke the key and create a new
			one.
		</p>
		{#if sample}<p>In this demo the key works nowhere: it is sample data.</p>{/if}
	</Notice>

	<section class="card pad reveal" aria-labelledby="rev-h">
		<h2 id="rev-h">Key {created.name ?? created.id} created</h2>
		<p class="muted">{grantSummary(created.grants)}</p>
		<CopyField id="key-id" label="Access key ID" value={created.id} />
		{#if material}
			<CopyField id="key-secret" label="Secret access key" value={material.secret} />
			<CopyField id="key-endpoint" label="S3 endpoint" value={material.endpoint} />
			{#each blocks as b (b.id)}
				<div class="snip">
					<div class="snip-h">
						<h3 id="snip-{b.id}">{b.title}</h3>
						<CopyButton value={b.text} label="Copy {b.title}" />
					</div>
					<pre class="code-block wrap" aria-labelledby="snip-{b.id}">{b.text}</pre>
				</div>
			{/each}
			<p class="actions">
				<a class="btn-plain" href={envHref} rel="external" download="kofra-{created.id}.env">
					Download as .env file
				</a>
				<a href={resolve('/(app)/keys')}>Done</a>
			</p>
		{:else}
			<p>The secret was shown when this key was first created and cannot be shown again.</p>
			<p><a href={resolve('/(app)/keys')}>Back to access keys</a></p>
		{/if}
	</section>
{/if}

<style>
	.reveal h2 {
		font-size: var(--font-size-lg);
	}
	.snip {
		display: grid;
		gap: var(--space-2);
	}
	.snip-h {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-3);
	}
	.wrap {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	h3 {
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-semibold);
	}
</style>
