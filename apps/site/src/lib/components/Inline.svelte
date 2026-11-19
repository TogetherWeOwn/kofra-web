<!--
	Content links are absolute site paths written in the page modules (the site has no base path),
	so they are rendered as is rather than through resolve().
-->
<script lang="ts">
	import { parseInline } from '#lib/blocks.js';

	let { text }: { text: string } = $props();
	const tokens = $derived(parseInline(text));
</script>

{#each tokens as tok, i (i)}{#if tok.t === 'code'}<code>
			{tok.v}
		</code>{:else if tok.t === 'strong'}<strong>
			{tok.v}
		</strong>{:else if tok.t === 'link'}<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- see the note above --><a
			href={tok.href}
		>
			{tok.v}
		</a>{:else}{tok.v}{/if}{/each}
