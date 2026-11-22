<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { ShownProblem } from '#lib/types.js';

	let {
		name,
		label,
		id = name,
		hint,
		result,
		required = true,
		...attrs
	}: HTMLInputAttributes & {
		name: string;
		label: string;
		hint?: string;
		result?: { field?: string; problem?: ShownProblem } | null;
	} = $props();
	const problem = $derived(result?.field === name ? result?.problem : undefined);
	const described = $derived(
		[hint && `${id}-hint`, problem && `${id}-error`].filter(Boolean).join(' ')
	);
</script>

<div class="field">
	<label for={id}>{label}</label>
	<input
		class="input"
		{id}
		{name}
		{required}
		{...attrs}
		aria-invalid={problem ? 'true' : undefined}
		aria-describedby={described || undefined}
	/>
	{#if hint}<p class="help" id="{id}-hint">{hint}</p>{/if}
	{#if problem}<p class="err" id="{id}-error">{problem.message}</p>{/if}
</div>
