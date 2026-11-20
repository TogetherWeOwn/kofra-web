<script lang="ts">
	import '@kofra/tokens/tokens.css';
	import '@kofra/ui/base.css';
	import '#lib/styles/fonts.css';
	import '#lib/styles/console.css';
	import themeScript from '@kofra/ui/theme.js?url';
	import plexLatin from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2?url';

	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';

	let { children } = $props();
	// Marks the page as interactive; end-to-end tests wait for it before using script features.
	onMount(() => document.documentElement.setAttribute('data-ready', ''));
	// The theme script sets aria-pressed on the toggles present at load; toggles that client
	// navigation adds (the one in Settings) get the current state here.
	afterNavigate(() => {
		const dark = document.documentElement.getAttribute('data-theme') === 'dark';
		for (const b of document.querySelectorAll('[data-theme-toggle]'))
			b.setAttribute('aria-pressed', dark ? 'true' : 'false');
	});
</script>

<svelte:head>
	<!-- Blocking on purpose: sets the theme before the first paint. -->
	<script src={themeScript}></script>
	<link rel="preload" href={plexLatin} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

{@render children()}
