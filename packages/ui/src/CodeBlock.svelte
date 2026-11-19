<script lang="ts">
	type Props = {
		code: string;
		/** Visible caption, for example the tool name or the file the snippet belongs in. */
		title?: string;
	};

	let { code, title }: Props = $props();
</script>

<!--
	Long lines wrap instead of scrolling, so the block never needs keyboard focus to be read.
	Plain text: no highlighting script, no copy button (the site ships no JavaScript beyond the theme toggle).
-->
<figure class="code">
	{#if title}<figcaption>{title}</figcaption>{/if}
	<pre><code>{code}</code></pre>
</figure>

<style>
	figure {
		margin: 0;
		background: var(--color-code-bg);
		color: var(--color-code-ink);
		border-radius: var(--radius-md);
		overflow: hidden;
	}
	figcaption {
		padding: var(--space-2) 18px;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		color: var(--color-code-ink);
		border-bottom: 1px solid rgb(255 255 255 / 0.14);
	}
	pre {
		margin: 0;
		padding: var(--space-4) 18px;
		font-family: var(--font-family-mono);
		font-size: var(--font-size-sm);
		line-height: 1.65;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	code {
		font-family: inherit;
		font-size: inherit;
	}
	@media (forced-colors: active) {
		figure {
			border: 1px solid CanvasText;
		}
	}
</style>
