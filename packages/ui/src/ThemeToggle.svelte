<script lang="ts">
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';

	let { label = 'Dark theme' }: { label?: string } = $props();
</script>

<!--
	A toggle button: the name stays "Dark theme" and aria-pressed carries the state.
	theme.js sets aria-pressed and handles clicks. Hidden until theme.js has run
	(html.js), because without script the button could not work.
-->
<button type="button" class="tt" data-theme-toggle aria-pressed="false" title={label}>
	<Moon class="moon" size={18} strokeWidth={1.75} />
	<Sun class="sun" size={18} strokeWidth={1.75} />
	<span class="sr">{label}</span>
</button>

<style>
	.tt {
		display: none;
		align-items: center;
		justify-content: center;
		width: var(--size-control-md);
		height: var(--size-control-md);
		padding: 0;
		background: transparent;
		color: var(--color-ink-2);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}
	:global(html.js) .tt {
		display: inline-flex;
	}
	.tt:hover {
		color: var(--color-ink);
		border-color: var(--color-ink);
	}
	.tt :global(.sun),
	.tt:global([aria-pressed='true']) :global(.moon) {
		display: none;
	}
	.tt:global([aria-pressed='true']) :global(.sun) {
		display: block;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}
</style>
