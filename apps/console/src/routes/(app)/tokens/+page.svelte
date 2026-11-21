<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '@kofra/ui';
	import { dateTime } from '#lib/format.js';

	let { data } = $props();
</script>

<svelte:head><title>API tokens: Kofra console</title></svelte:head>

<div class="ph">
	<div>
		<h1>API tokens</h1>
		<p>
			API tokens let scripts and tools manage this workspace. They cannot read or write files; use
			access keys for that.
		</p>
	</div>
	<div class="ph-act"><Button href={resolve('/(app)/tokens/new')}>Create token</Button></div>
</div>

{#if data.tokens.length}
	<div class="table-wrap card">
		<table class="tbl" aria-label="API tokens">
			<thead>
				<tr>
					<th scope="col">Name</th><th scope="col">Scopes</th><th scope="col">Buckets</th><th
						scope="col"
					>
						Expires
					</th><th scope="col">Last used</th><th scope="col">Created by</th><th scope="col">
						Action
					</th>
				</tr>
			</thead>
			<tbody>
				{#each data.tokens as token (token.id)}
					<tr>
						<th scope="row">{token.name}</th>
						<td>
							<span class="badge">
								{token.scopes.every((scope) => scope.endsWith(':read'))
									? 'Read only'
									: 'Can change things'}
							</span>
						</td>
						<td>{token.buckets?.join(', ') ?? 'All'}</td>
						<td>{token.expires_at ? dateTime(token.expires_at) : 'Never'}</td>
						<td>{token.last_used_at ? dateTime(token.last_used_at) : 'Never'}</td>
						<td>{token.created_by === data.user ? 'You' : token.created_by}</td>
						<td>
							<a
								href={resolve('/(app)/tokens/[id]/revoke', { id: token.id })}
								aria-label="Revoke {token.name}"
							>
								Revoke
							</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<div class="card pad"><p>No API tokens yet.</p></div>
{/if}
