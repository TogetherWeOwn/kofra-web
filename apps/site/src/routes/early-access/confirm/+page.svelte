<script lang="ts">
	import { Button } from '@kofra/ui';
	import { pageTitle } from '#lib/site.js';

	let { data } = $props();
</script>

<svelte:head>
	<title>{pageTitle('Confirm your email address')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="page-head">
	<div class="wrap">
		<h1>Confirm your email address</h1>
		<p class="lead">Press the button to confirm your place on the Kofra early access list.</p>
		<form method="POST" class="cta-row">
			<input type="hidden" name="token" value={data.token} />
			<Button type="submit" size="lg">Confirm</Button>
		</form>
	</div>
</section>
<div class="spacer"></div>

<style>
	.spacer {
		height: var(--space-24);
	}
</style>
