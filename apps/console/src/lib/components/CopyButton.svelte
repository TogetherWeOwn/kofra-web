<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';

	let { value, label }: { value: string; label: string } = $props();
	let copied = $state(false);
	let failed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			copied = true;
			failed = false;
		} catch {
			failed = true;
		}
		clearTimeout(timer);
		timer = setTimeout(() => (copied = failed = false), 2500);
	}
</script>

<!-- Needs script (the clipboard API); hidden until the theme script marks html.js. -->
<button type="button" class="copy btn-plain btn-sm" onclick={copy} aria-label={label}>
	{#if copied}<Check class="icon" aria-hidden="true" />Copied{:else}<Copy
			class="icon"
			aria-hidden="true"
		/>Copy{/if}
</button>
<span class="sr-only" role="status">
	{copied ? 'Copied' : failed ? 'Copy failed: select the text and copy it' : ''}
</span>

<style>
	.copy {
		display: none;
	}
	:global(html.js) .copy {
		display: inline-flex;
	}
</style>
