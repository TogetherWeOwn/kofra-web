<script lang="ts">
	import { resolve } from '$app/paths';
	import { Logo } from '@kofra/ui';

	let { children } = $props();
</script>

<a class="skip-link" href="#main">Skip to content</a>
<main id="main" class="auth">
	<Logo href={resolve('/(app)')} />
	<div class="card pad">
		{@render children()}
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
	.auth :global(h1) {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-semibold);
	}
</style>
