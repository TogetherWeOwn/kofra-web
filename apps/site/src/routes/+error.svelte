<script lang="ts">
	import { page } from '$app/state';
	import { Button } from '@kofra/ui';
	import { pageTitle } from '#lib/site.js';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{pageTitle(notFound ? 'Page not found' : 'Something went wrong')}</title>
</svelte:head>

<section class="page-head">
	<div class="wrap">
		<h1>{notFound ? 'Page not found' : 'Something went wrong'}</h1>
		<p class="lead">
			{notFound
				? 'There is no page at this address. It may have moved, or the link may be wrong.'
				: 'The page could not be shown. Please try again in a moment.'}
		</p>
		<div class="cta-row">
			<Button href="/">Go to the home page</Button>
			<Button href="/docs" variant="secondary">Read the docs</Button>
		</div>
	</div>
</section>
<div class="spacer"></div>

<style>
	.spacer {
		height: var(--space-24);
	}
</style>
