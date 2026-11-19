<script lang="ts">
	import '@kofra/tokens/tokens.css';
	import '@kofra/ui/base.css';
	import '#lib/styles/fonts.css';
	import '#lib/styles/site.css';
	import themeScript from '@kofra/ui/theme.js?url';
	import plexLatin from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url';
	import { page } from '$app/state';
	import { Button, Footer, Nav, ThemeToggle } from '@kofra/ui';
	import { EARLY_ACCESS, FOOTER, NAV } from '#lib/content.js';
	import { SITE } from '#lib/site.js';

	let { children } = $props();
</script>

<svelte:head>
	<!-- Blocking on purpose: sets the theme before the first paint. 1 KB, the only script. -->
	<script src={themeScript}></script>
	<link rel="preload" href={plexLatin} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>
<Nav items={NAV} current={page.url.pathname}>
	{#snippet actions()}
		<Button href={EARLY_ACCESS}>Get early access</Button>
	{/snippet}
	{#snippet utility()}
		<ThemeToggle />
	{/snippet}
</Nav>
<main id="main">
	{@render children()}
</main>
<Footer columns={FOOTER} tagline={SITE.tagline}>
	{#snippet bottom()}
		<p>© 2026 Kofra</p>
		<p>Kofra is in early access. Prices shown are examples.</p>
	{/snippet}
</Footer>
