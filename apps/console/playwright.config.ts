import { defineConfig } from '@playwright/test';

// Smoke tests run against the built Worker in the local Workers runtime
// (wrangler dev), so static-asset headers from _headers apply as in production.
// CI's e2e job sets KOFRA_E2E_PREBUILT=1 after downloading the build job's
// output, so it tests that build instead of making a second one.
//
// Servers:
// - 4174: demo mode (the existing suite).
// - 4178: a local fake of the storage service (e2e/fake-storage.ts).
// - 4177: tenant0 mode against the fake, with DEV_AUTH=local (honoured only because the
//   host is loopback and storage is a loopback fake; see src/lib/server/gate.ts).
// - 4179: tenant0 mode as deployed: no DEV_AUTH, so every request without an Access token is
//   refused.
// - 4175: live-fake mode: the account service's in-memory fake (loopback only), for the
//   sign-in and account journeys. Served on localhost: WebAuthn refuses IP addresses as RP IDs.
// - 4176 (only with KOFRA_API_DIR, a kofra-api checkout whose Worker is built): live mode on
//   the real account service and API (the Kofra API Worker on a fresh local D1), over the
//   same service bindings as deployed (e2e/live-servers.ts).
const prebuilt = process.env.KOFRA_E2E_PREBUILT === '1';
// Without a prebuilt output, the first server builds once and leaves a marker for this run;
// the tenant0 servers wait for it, so none of them starts from an older build.
const marker = `.svelte-kit/e2e-built-${process.pid}`;
const build = prebuilt ? '' : `pnpm run build && touch ${marker} && `;
const afterBuild = prebuilt ? '' : `until [ -f ${marker} ]; do sleep 1; done; `;

/** Test values only: the fake accepts them, nothing else does. */
const TENANT0_VARS = {
	CONSOLE_DATA: 'tenant0',
	ACCESS_TEAM_DOMAIN: 'example-team.cloudflareaccess.com',
	ACCESS_AUD: 'a'.repeat(64),
	ALLOWED_EMAILS: 'owner@example.com',
	STORAGE_ORIGIN: 'http://127.0.0.1:4178',
	STORAGE_HOST: '127.0.0.1:4178',
	STORAGE_KEY_ID: 'AKVLCONSOLE0000000001',
	STORAGE_SECRET: 'fake-console-secret-0123456789abcdef',
	STORAGE_ADMIN_TOKEN: 'fake-admin-token-0123456789',
	WORKSPACE_NAME: 'Owner workspace',
	PROTECTED_BUCKETS: 'nntune'
};
const liveApi = process.env.KOFRA_API_DIR ?? process.env.KOFRA_E2E_REMOTE_API;
const vars = (extra: Record<string, string> = {}) =>
	Object.entries({ ...TENANT0_VARS, ...extra })
		.map(([k, v]) => `--var '${k}:${v}'`)
		.join(' ');

export default defineConfig({
	testDir: 'e2e',
	forbidOnly: !!process.env.CI,
	// No retries: a flaky smoke test must fail, never pass silently.
	retries: 0,
	projects: [
		{
			name: 'demo',
			testIgnore: /(tenant0|accounts|accounts-live)\.test\.ts/,
			use: { baseURL: 'http://127.0.0.1:4174' }
		},
		{
			name: 'tenant0',
			testMatch: /tenant0\.test\.ts/,
			// The tests share one fake; each resets it, so they run one at a time.
			fullyParallel: false,
			workers: 1,
			use: { baseURL: 'http://127.0.0.1:4177' }
		},
		{
			name: 'live-fake',
			testMatch: /accounts\.test\.ts/,
			use: { baseURL: 'http://localhost:4175' }
		},
		...(liveApi
			? [
					{
						name: 'live',
						testMatch: /accounts-live\.test\.ts/,
						// One database for every test, read by the tests: one at a time.
						fullyParallel: false,
						workers: 1,
						// Against a deployed API every step crosses the network.
						timeout: 120_000,
						expect: { timeout: 20_000 },
						use: { baseURL: 'http://localhost:4176' }
					}
				]
			: [])
	],
	webServer: [
		{
			command: `${build}pnpm run preview`,
			url: 'http://127.0.0.1:4174',
			// Always start a fresh server, so a stale preview is never tested.
			reuseExistingServer: false,
			timeout: 180_000
		},
		{
			command: 'node e2e/fake-storage.ts 4178',
			url: 'http://127.0.0.1:4178/__test/calls',
			reuseExistingServer: false,
			timeout: 30_000
		},
		{
			command: `${afterBuild}pnpm exec wrangler dev --port 4177 --inspector-port 9337 --persist-to .wrangler/e2e-tenant0 ${vars({ DEV_AUTH: 'local' })}`,
			url: 'http://127.0.0.1:4177/sign-in',
			reuseExistingServer: false,
			timeout: 240_000
		},
		{
			command: `${afterBuild}pnpm exec wrangler dev --port 4179 --inspector-port 9338 --persist-to .wrangler/e2e-deployed ${vars()}`,
			url: 'http://127.0.0.1:4179/favicon.svg',
			reuseExistingServer: false,
			timeout: 240_000
		},
		{
			command: `${afterBuild}pnpm exec wrangler dev --ip 127.0.0.1 --port 4175 --inspector-port 9339 --persist-to .wrangler/e2e-live-fake --var CONSOLE_DATA:live-fake`,
			url: 'http://127.0.0.1:4175/favicon.svg',
			reuseExistingServer: false,
			timeout: 240_000
		},
		...(liveApi
			? [
					{
						command: `${afterBuild}node e2e/live-servers.ts 4176`,
						url: 'http://127.0.0.1:4176/favicon.svg',
						reuseExistingServer: false,
						timeout: 300_000
					}
				]
			: [])
	]
});
