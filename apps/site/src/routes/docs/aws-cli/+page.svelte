<script lang="ts">
	import ProsePage from '#lib/components/ProsePage.svelte';
	import { AWS_CLI, AWS_CLI_BLOCKS } from '#lib/pages/aws-cli.js';
</script>

<ProsePage heading={AWS_CLI.heading} lead={AWS_CLI.lead} blocks={AWS_CLI_BLOCKS} toc />
