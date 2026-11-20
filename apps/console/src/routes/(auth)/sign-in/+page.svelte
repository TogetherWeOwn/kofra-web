<script lang="ts">
	import { resolve } from '$app/paths';
	import { Logo } from '@kofra/ui';
	import { DOCS_URL } from '#lib/nav.js';
</script>

<svelte:head>
	<title>Sign in: Kofra console</title>
	<meta name="description" content="Sign in to the Kofra console." />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>
<main id="main" class="auth">
	<Logo href={resolve('/(app)')} />
	<div class="card pad">
		<h1>Sign in</h1>
		<p>
			Sign-in is not available yet. Accounts with email and password, passkeys and two-factor
			authentication come with the first release.
		</p>
		<p>Until then, the console runs as a demo with sample data that only you can see.</p>
		<p class="actions">
			<a class="btn-plain" href={resolve('/(app)')}>Open the demo workspace</a>
			<a href={DOCS_URL} rel="external">Read the documentation</a>
		</p>
	</div>
</main>

<style>
	.auth {
		max-width: 480px;
		margin: 0 auto;
		padding: var(--space-16) var(--space-5);
		display: grid;
		gap: var(--space-6);
	}
	h1 {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-semibold);
	}
</style>
