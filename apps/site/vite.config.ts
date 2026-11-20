import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

/** wrangler.jsonc vars (full-line // comments only, no trailing commas). */
const vars: Record<string, string> =
	JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, '')).vars ?? {};
const waitlistOn = vars.WAITLIST_ENABLED === 'true' && Boolean(vars.TURNSTILE_SITE_KEY);

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
		// The waitlist form: one switch in wrangler.jsonc for both the page and the endpoints.
		__KOFRA_WAITLIST__: JSON.stringify(waitlistOn),
		__KOFRA_TURNSTILE_SITE_KEY__: JSON.stringify(waitlistOn ? vars.TURNSTILE_SITE_KEY : '')
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
