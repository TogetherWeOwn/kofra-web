import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { ANNOUNCER_STYLE_HASH } from './src/lib/csp.js';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Runes mode for project files; libraries keep their own mode.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// SvelteKit adds a per-response nonce for its own inline bootstrap script. No inline
			// styles of our own (charts and meters size with SVG attributes); the one style
			// attribute the framework adds is allowed by its hash (src/lib/csp.ts). Forms may post only to this origin and to the
			// payment provider's hosted pages (billing redirects there after a POST).
			csp: {
				mode: 'nonce',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self'],
					'style-src-attr': ['unsafe-hashes', ANNOUNCER_STYLE_HASH],
					'img-src': ['self', 'data:'],
					'font-src': ['self'],
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self', 'https://checkout.stripe.com', 'https://billing.stripe.com'],
					'frame-ancestors': ['none'],
					'upgrade-insecure-requests': true
				}
			}
		})
	],
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
