<script lang="ts">
	import CopyButton from '../CopyButton.svelte';
	import Notice from '../Notice.svelte';

	let { codes }: { codes: string[] } = $props();
	const text = $derived(codes.join('\n') + '\n');
</script>

<Notice tone="warning" live title="Save these recovery codes">
	<p>Each code works once. Store them somewhere you can reach without your authenticator app.</p>
</Notice>
<pre class="code-block">{text}</pre>
<div class="actions">
	<CopyButton value={text} label="Copy recovery codes" />
	<a
		class="btn-plain"
		href="data:text/plain;charset=utf-8,{encodeURIComponent(text)}"
		rel="external"
		download="kofra-recovery-codes.txt"
	>
		Download as text
	</a>
</div>
