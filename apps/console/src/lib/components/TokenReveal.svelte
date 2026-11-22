<script lang="ts">
	import { resolve } from '$app/paths';
	import CopyField from './CopyField.svelte';
	import Notice from './Notice.svelte';

	let {
		token,
		sample = false
	}: {
		token: { name: string; token: string | null };
		sample?: boolean;
	} = $props();
</script>

<section class="card pad reveal" aria-labelledby="token-reveal">
	<h2 id="token-reveal">Token {token.name} created</h2>
	{#if token.token}
		<Notice tone="warning" live><p>Copy it now. You will not see it again.</p></Notice>
		<CopyField id="api-token" label="API token" value={token.token} />
		{#if sample}<p>In this demo the token works nowhere: it is sample data.</p>{/if}
	{/if}
	<p><a href={resolve('/(app)/tokens')}>Done</a></p>
</section>
