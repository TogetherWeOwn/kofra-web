import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte({ compilerOptions: { runes: true } })],
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		// Icon components ship as .svelte source; compile them like our own.
		server: { deps: { inline: [/@lucide\/svelte/] } }
	}
});
