import { defineConfig } from '@playwright/test';

// Smoke tests run against the built Worker in the local Workers runtime
// (wrangler dev), so static-asset headers from _headers apply as in production.
// CI's e2e job sets KOFRA_E2E_PREBUILT=1 after downloading the build job's
// output, so it tests that build instead of making a second one.
const prebuilt = process.env.KOFRA_E2E_PREBUILT === '1';

export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	// No retries: a flaky smoke test must fail, never pass silently.
	retries: 0,
	projects: [
		{ name: 'demo', testIgnore: '**/accounts.test.ts', use: { baseURL: 'http://127.0.0.1:4174' } },
		{
			name: 'live-fake',
			testMatch: '**/accounts.test.ts',
			// localhost, not 127.0.0.1: WebAuthn refuses IP addresses as RP IDs.
			use: { baseURL: 'http://localhost:4175' }
		}
	],
	webServer: [
		{
			command: prebuilt ? 'pnpm run preview' : 'pnpm run build && pnpm run preview',
			url: 'http://127.0.0.1:4174',
			// Always start a fresh server, so a stale preview is never tested.
			reuseExistingServer: false,
			timeout: 120_000
		},
		{
			command: 'pnpm exec wrangler dev --ip 127.0.0.1 --port 4175 --var CONSOLE_MODE:live-fake',
			url: 'http://127.0.0.1:4175/sign-in',
			reuseExistingServer: false,
			timeout: 120_000
		}
	]
});
