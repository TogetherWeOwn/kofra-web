import { defineConfig } from '@playwright/test';

// Smoke tests run against the built Worker in the local Workers runtime
// (wrangler dev), so static-asset headers from _headers apply as in production.
export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	use: { baseURL: 'http://127.0.0.1:4174' },
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		url: 'http://127.0.0.1:4174',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
