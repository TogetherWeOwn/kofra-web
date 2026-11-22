<script lang="ts">
	import Csrf from '#lib/components/account/Csrf.svelte';
	import { resolve } from '$app/paths';
	import { ThemeToggle } from '@kofra/ui';
	import CopyField from '#lib/components/CopyField.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import ProblemNotice from '#lib/components/ProblemNotice.svelte';
	import { dateTime } from '#lib/format.js';

	let { data, form } = $props();
	const a = $derived(data.account);
	const NOTICES: Record<string, [string, string]> = {
		'deletion-cancelled': ['Deletion cancelled', 'The workspace stays as it is.'],
		'deletion-requested': [
			'Deletion requested',
			'Nothing is deleted until an Owner confirms the request.'
		],
		'demo-reset': ['Demo reset', 'The workspace is back to its sample data.']
	};
	const notice = $derived(data.notice ? NOTICES[data.notice] : undefined);
</script>

<svelte:head>
	<title>Settings: Kofra console</title>
	<meta name="description" content="Workspace details, appearance and deletion." />
</svelte:head>

<div class="ph">
	<div>
		<h1>Settings</h1>
		<p>Workspace details, appearance and deletion.</p>
	</div>
</div>

{#if form?.problem}<ProblemNotice problem={form.problem} />{/if}
{#if notice}<Notice tone="success" title={notice[0]} live><p>{notice[1]}</p></Notice>{/if}

{#if a}
	<section class="card pad" aria-labelledby="ws-h">
		<h2 id="ws-h">Workspace</h2>
		<dl class="kv">
			<dt>Name</dt>
			<dd>{data.workspace}</dd>
			<dt>Workspace ID</dt>
			<dd class="mono">{a.id}</dd>
			<dt>Created</dt>
			<dd>{dateTime(a.created_at)}</dd>
			<dt>Status</dt>
			<dd>
				{a.state === 'active'
					? 'Active'
					: a.state === 'suspended'
						? 'Suspended'
						: a.state === 'deleting'
							? 'Being deleted'
							: a.state}
			</dd>
		</dl>
		<CopyField id="endpoint" label="S3 endpoint" value={a.s3_endpoint} />
	</section>
{/if}

<section class="card pad" aria-labelledby="look-h">
	<h2 id="look-h">Appearance</h2>
	<div class="row">
		<ThemeToggle />
		<p class="muted">
			Switch between light and dark. The console follows your device until you choose.
		</p>
	</div>
</section>

{#if data.ws.features.sample && data.mode === 'demo'}
	<section class="card pad" aria-labelledby="demo-h">
		<h2 id="demo-h">Demo data</h2>
		<p class="muted">
			Go back to the sample workspace, dropping every bucket, key and file you added.
		</p>
		<p><a class="btn-plain" href={resolve('/(app)/settings/reset-demo')}>Reset demo data</a></p>
	</section>
{/if}

{#if a && data.ws.features.workspaceDeletion}
	<section class="card pad danger" aria-labelledby="del-h">
		<h2 id="del-h">Delete workspace</h2>
		{#if a.deletion}
			<p>
				Deletion was requested on {dateTime(a.deletion.requested_at)}.
				{#if a.deletion.status === 'pending_confirmation'}
					It lapses unless an Owner confirms it by {a.deletion.confirm_by
						? dateTime(a.deletion.confirm_by)
						: 'the deadline'}.
				{:else if a.deletion.erase_at}
					The data is erased on {dateTime(a.deletion.erase_at)}.
				{/if}
			</p>
			<form method="POST" action="?/cancelDeletion">
				<Csrf />
				<button class="btn-plain" type="submit">Cancel deletion</button>
			</form>
		{:else}
			<p class="muted">
				Deletes every bucket, file and key in this workspace after a waiting period, during which
				you can cancel.
			</p>
			<p>
				<a class="btn-plain link-danger" href={resolve('/(app)/settings/delete-workspace')}>
					Delete workspace
				</a>
			</p>
		{/if}
	</section>
{/if}

<style>
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.danger {
		border-color: var(--color-danger);
	}
</style>
