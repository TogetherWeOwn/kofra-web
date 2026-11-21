import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Runes mode for project files; libraries keep their own mode.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	define: {
		// See src/lib/site.ts: indexing is off unless the build sets KOFRA_INDEXABLE=true.
		__KOFRA_INDEXABLE__: JSON.stringify(process.env.KOFRA_INDEXABLE === 'true'),
		// See src/lib/site.ts: the launch switches. Both off unless the build sets them to true.
		__KOFRA_SIGNUP_OPEN__: JSON.stringify(process.env.KOFRA_SIGNUP_OPEN === 'true'),
		__KOFRA_STATUS_LIVE__: JSON.stringify(process.env.KOFRA_STATUS_LIVE === 'true')
	},
	build: {
		// Never inline scripts as data: URLs: the CSP allows scripts from this origin only.
		assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined)
	},
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
