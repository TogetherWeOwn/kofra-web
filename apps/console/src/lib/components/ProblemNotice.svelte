<script lang="ts">
	import Notice from './Notice.svelte';
	import type { ShownProblem } from '#lib/types.js';

	let { problem, title = 'That did not work' }: { problem: ShownProblem; title?: string } =
		$props();
</script>

<Notice tone="danger" {title} live>
	<p>{problem.message}</p>
	{#if problem.hint}<p class="muted">{problem.hint}</p>{/if}
	{#if problem.requestId}<p class="muted">Request ID <code>{problem.requestId}</code></p>{/if}
</Notice>
