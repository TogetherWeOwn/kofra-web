<script lang="ts">
	import { enhance } from '$app/forms';
	import { focusFirstInvalid } from '#lib/forms.js';
	import type { Snippet } from 'svelte';
	import type { ShownProblem } from '#lib/types.js';
	import ProblemNotice from '../ProblemNotice.svelte';

	let {
		action,
		csrf,
		result,
		children,
		styled = true
	}: {
		action?: string;
		csrf?: string;
		result?: { field?: string; problem?: ShownProblem } | null;
		children: Snippet;
		styled?: boolean;
	} = $props();
</script>

<form
	method="POST"
	{action}
	class:form={styled}
	use:enhance={({ formElement }) =>
		async ({ update, result }) => {
			await update({ reset: false });
			if (result.type === 'failure') await focusFirstInvalid(formElement);
		}}
>
	{#if csrf}<input type="hidden" name="_csrf" value={csrf} />{/if}
	{#if result?.problem && !result.field}<ProblemNotice problem={result.problem} />{/if}
	{@render children()}
</form>
