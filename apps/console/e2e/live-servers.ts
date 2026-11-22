// Starts the console in `live` mode against the real account service and
// API: the Kofra API Worker from a kofra-api checkout (KOFRA_API_DIR, built
// with `worker-build --release` in workers/kofra-api), on a fresh local D1,
// reached over the console's ACCOUNT and API service bindings exactly as
// deployed. Tests only; used by the `live` Playwright project.
//
//   node e2e/live-servers.ts <port>
//
// Keys are random per run, written to the two git-ignored .dev.vars files
// and never printed. Mail stays in the API's local outbox table, which the
// tests read with `wrangler d1 execute` (see accounts-live.test.ts).
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const port = Number(process.argv[2] ?? 4176);
const apiRoot = process.env.KOFRA_API_DIR;
if (!apiRoot) throw new Error('KOFRA_API_DIR must name a kofra-api checkout');
const api = path.resolve(apiRoot, 'workers/kofra-api');
const here = path.dirname(new URL(import.meta.url).pathname);
const consoleDir = path.resolve(here, '..');
export const LIVE_STATE = path.join(consoleDir, '.wrangler', 'e2e-live');
const wrangler = path.join(consoleDir, 'node_modules', '.bin', 'wrangler');

rmSync(LIVE_STATE, { recursive: true, force: true });
mkdirSync(LIVE_STATE, { recursive: true });

const hex = () => randomBytes(32).toString('hex');
const assertionKey = hex();
writeFileSync(
	path.join(api, '.dev.vars'),
	`ACCOUNT_SECRET_KEY=${hex()}\nASSERTION_KEY=${assertionKey}\nCURSOR_KEY=${hex()}\n`,
	{ mode: 0o600 }
);

// The console as built, in live mode, bound to the API's Console entry point.
const gen = path.join(consoleDir, '.svelte-kit/cloudflare/worker/wrangler.json');
const cfg = JSON.parse(readFileSync(gen, 'utf8'));
for (const k of ['configPath', 'userConfigPath', 'topLevelName', 'definedEnvironments'])
	delete cfg[k];
cfg.name = 'kofra-console-e2e-live';
cfg.vars = { ...cfg.vars, CONSOLE_DATA: 'live', BILLING: 'off' };
cfg.services = [
	{ binding: 'ACCOUNT', service: 'kofra-api', entrypoint: 'Console' },
	{ binding: 'API', service: 'kofra-api', entrypoint: 'Console' }
];
const liveConfig = path.join(path.dirname(gen), 'wrangler.e2e-live.json');
writeFileSync(liveConfig, JSON.stringify(cfg, null, 2));
writeFileSync(path.join(path.dirname(gen), '.dev.vars'), `ASSERTION_KEY=${assertionKey}\n`, {
	mode: 0o600
});

execFileSync(
	wrangler,
	['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', LIVE_STATE, '-c', 'wrangler.toml'],
	{ cwd: api, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, CI: '1' } }
);

const child = spawn(
	wrangler,
	[
		'dev',
		'-c',
		liveConfig,
		'-c',
		path.join(api, 'wrangler.toml'),
		'--ip',
		'127.0.0.1',
		'--port',
		String(port),
		'--inspector-port',
		String(port + 5170),
		'--persist-to',
		LIVE_STATE
	],
	{ stdio: 'inherit', env: { ...process.env, CI: '1' } }
);
const stop = () => {
	child.kill('SIGINT');
	rmSync(path.join(api, '.dev.vars'), { force: true });
	rmSync(path.join(path.dirname(gen), '.dev.vars'), { force: true });
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
