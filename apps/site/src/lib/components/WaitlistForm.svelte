<script lang="ts">
	import { Button, Link } from '@kofra/ui';
	import { TURNSTILE_SITE_KEY } from '#lib/site.js';
</script>

<svelte:head>
	<!-- Cloudflare Turnstile: the only third-party script, on this page only, when the waitlist is on. -->
	<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</svelte:head>

<!-- Plain form post: SvelteKit's origin check rejects cross-site posts; the server answers with a redirect. -->
<form class="wl" method="POST" action="/early-access/join">
	<label for="wl-email">Email address</label>
	<input
		id="wl-email"
		name="email"
		type="email"
		autocomplete="email"
		required
		maxlength="254"
		aria-describedby="wl-help"
	/>
	<p class="help" id="wl-help">
		We use this address only to email you when Kofra opens. We send a confirmation link first;
		unconfirmed addresses are deleted after 7 days. Details are in the
		<Link href="/legal/privacy">privacy policy</Link>.
	</p>
	<div class="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY} data-action="waitlist"></div>
	<noscript><p class="help">This form needs JavaScript for its anti-spam check.</p></noscript>
	<div><Button type="submit" size="lg">Join the list</Button></div>
</form>

<style>
	.wl {
		display: grid;
		gap: var(--space-3);
		max-width: 28rem;
		margin: var(--space-8) 0 var(--space-4);
	}
	label {
		font-weight: var(--font-weight-semibold);
	}
	input {
		min-height: var(--size-control-lg);
		padding: var(--space-2) var(--space-3);
		background: var(--color-surface);
		color: var(--color-ink);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-sm);
	}
	input:focus-visible {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
	.help {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-ink-2);
	}
</style>
