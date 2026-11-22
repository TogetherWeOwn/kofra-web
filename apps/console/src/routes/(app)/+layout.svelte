<script lang="ts">
	import Csrf from '#lib/components/account/Csrf.svelte';
	import { page } from '$app/state';
	import Shell from '#lib/components/Shell.svelte';
	import Notice from '#lib/components/Notice.svelte';
	import { dateTime } from '#lib/format.js';
	import type { Crumb } from '#lib/nav.js';

	let { data, children } = $props();
	const crumbs = $derived((page.data.crumbs as Crumb[] | undefined) ?? []);
	const deletion = $derived(data.account?.deletion);
</script>

<Shell
	path={page.url.pathname}
	{crumbs}
	workspace={data.workspace}
	ws={data.ws}
	signedIn={data.mode === 'live' || data.mode === 'live-fake'}
	workspaceReady={data.workspaceReady}
>
	{#if data.ws.features.sample && data.mode === 'demo'}
		<Notice tone="info" title="Demo workspace">
			<p>
				Everything here is sample data. Your changes stay in this browser for 7 days, and nothing is
				stored or charged. Sign-in comes later.
			</p>
		</Notice>
	{/if}
	{#if deletion}
		<Notice tone="warning" title="Workspace deletion requested">
			<p>
				An Owner must confirm the deletion by {deletion.confirm_by
					? dateTime(deletion.confirm_by)
					: 'the deadline'}, or the request lapses. Until then nothing is deleted.
			</p>
			<form method="POST" action="/settings?/cancelDeletion" class="inline-form">
				<Csrf />
				<button class="btn-plain btn-sm" type="submit">Cancel deletion</button>
			</form>
		</Notice>
	{/if}
	{@render children()}
</Shell>

<style>
	.inline-form {
		margin-top: var(--space-2);
	}
</style>
