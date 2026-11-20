<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Page not found' : 'Something went wrong'}: Kofra console</title>
</svelte:head>

<main id="main" class="error-page">
	<p class="muted">Error {page.status}</p>
	<h1>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
	<p>{page.status === 404 ? 'There is nothing at this address.' : page.error?.message}</p>
	{#if page.error?.hint}<p class="muted">{page.error.hint}</p>{/if}
	{#if page.error?.requestId}<p class="muted">
			Request ID <code>{page.error.requestId}</code>
		</p>{/if}
	<p><a href={resolve('/(app)')}>Go to the overview</a></p>
</main>

<style>
	.error-page {
		max-width: 640px;
		margin: 0 auto;
		padding: var(--space-16) var(--space-6);
		display: grid;
		gap: var(--space-3);
	}
	h1 {
		font-size: var(--font-size-3xl);
		font-weight: var(--font-weight-semibold);
	}
</style>
