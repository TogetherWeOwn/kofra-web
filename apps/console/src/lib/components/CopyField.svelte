<script lang="ts">
	import CopyButton from './CopyButton.svelte';

	let { label, value, id }: { label: string; value: string; id: string } = $props();
</script>

<div class="cf">
	<span class="label" id="{id}-l">{label}</span>
	<div class="row">
		<code class="val" {id} aria-labelledby="{id}-l">{value}</code>
		<CopyButton {value} label="Copy {label}" />
	</div>
</div>

<style>
	.cf {
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	.label {
		font-size: var(--font-size-sm);
		color: var(--color-muted);
		font-weight: var(--font-weight-medium);
	}
	.row {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		flex-wrap: wrap;
	}
	.val {
		font-size: var(--font-size-sm);
		background: var(--color-band);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-sm);
		padding: 6px 10px;
		overflow-wrap: anywhere;
		min-width: 0;
		user-select: all;
	}
</style>
