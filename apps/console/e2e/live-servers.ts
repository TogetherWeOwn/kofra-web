// Starts the console in `live` mode against the real account service and
// API: the Kofra API Worker from a kofra-api checkout (KOFRA_API_DIR, built
// with `./build.sh` in workers/kofra-api), on a fresh local D1, reached over
// the console's ACCOUNT and API service bindings exactly as deployed. Tests
// only; used by the `live` Playwright project.
//
//   node e2e/live-servers.ts <port>
//
// Keys are random per run and never printed. They go to .dev.vars files next
// to this run's own generated copies of both Workers' configurations (in the
// run's git-ignored state folder and in the console's build output), so no
// developer's .dev.vars is ever touched. Mail stays in the API's local outbox
// table, which the tests read with `wrangler d1 execute`.
//
// With KOFRA_E2E_REMOTE_API (the name of a deployed API Worker) the console
// still runs here, but its bindings reach that deployed Worker (remote
// bindings) and its database (KOFRA_E2E_REMOTE_D1, read by the tests); the
// deployed Worker's assertion key comes in KOFRA_E2E_ASSERTION_KEY. Only for a
// staging copy whose mail for test addresses goes to its outbox.
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? 4176);
const remote = process.env.KOFRA_E2E_REMOTE_API;
const apiRoot = process.env.KOFRA_API_DIR;
if (!apiRoot && !remote) throw new Error('KOFRA_API_DIR must name a kofra-api checkout');
const api = path.resolve(apiRoot ?? '.', 'workers/kofra-api');
const here = path.dirname(fileURLToPath(import.meta.url));
const consoleDir = path.resolve(here, '..');
export const LIVE_STATE = path.join(consoleDir, '.wrangler', 'e2e-live');
const wrangler = path.join(consoleDir, 'node_modules', '.bin', 'wrangler');

rmSync(LIVE_STATE, { recursive: true, force: true });
mkdirSync(LIVE_STATE, { recursive: true });

const hex = () => randomBytes(32).toString('hex');
const assertionKey = remote ? process.env.KOFRA_E2E_ASSERTION_KEY : hex();
if (!assertionKey || !/^[a-f0-9]{64}$/.test(assertionKey))
	throw new Error('KOFRA_E2E_ASSERTION_KEY must hold the deployed API Worker key');

// The API Worker's configuration, copied with absolute paths into the state folder, with its
// keys beside it. Its name, date, database and [vars] are read from its wrangler.toml.
const apiDir = path.join(LIVE_STATE, 'api');
const apiConfig = path.join(apiDir, 'wrangler.json');
if (!remote) {
	mkdirSync(apiDir, { recursive: true });
	const toml = readFileSync(path.join(api, 'wrangler.toml'), 'utf8');
	const field = (name: string) => new RegExp(`^${name}\\s*=\\s*"([^"]+)"`, 'm').exec(toml)?.[1];
	const varsBlock = toml.split(/^\[vars\]\s*$/m)[1]?.split(/^\[/m)[0] ?? '';
	const vars = Object.fromEntries(
		[...varsBlock.matchAll(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"/gm)].map((m) => [m[1], m[2]])
	);
	if (!field('name') || !field('compatibility_date') || !field('database_id') || !vars.KOFRA_ENV)
		throw new Error('could not read the API Worker configuration');
	writeFileSync(
		apiConfig,
		JSON.stringify({
			name: field('name'),
			main: path.join(api, 'entry.mjs'),
			compatibility_date: field('compatibility_date'),
			d1_databases: [
				{
					binding: 'DB',
					database_name: field('database_name'),
					database_id: field('database_id'),
					migrations_dir: path.resolve(api, '../../migrations')
				}
			],
			vars
		})
	);
	writeFileSync(
		path.join(apiDir, '.dev.vars'),
		`ACCOUNT_SECRET_KEY=${hex()}\nASSERTION_KEY=${assertionKey}\nCURSOR_KEY=${hex()}\n`,
		{ mode: 0o600 }
	);
}

// The console as built, in live mode, bound to the API's Console entry point. Its copy stays
// beside the build (its paths are relative to it); the build folder is generated output, so
// the .dev.vars written there belongs to this run.
const gen = path.join(consoleDir, '.svelte-kit/cloudflare/worker/wrangler.json');
const cfg = JSON.parse(readFileSync(gen, 'utf8'));
for (const k of ['configPath', 'userConfigPath', 'topLevelName', 'definedEnvironments'])
	delete cfg[k];
cfg.name = 'kofra-console-e2e-live';
cfg.vars = { ...cfg.vars, CONSOLE_DATA: 'live', BILLING: 'off' };
const service = remote
	? { service: remote, entrypoint: 'Console', remote: true }
	: { service: 'kofra-api', entrypoint: 'Console' };
cfg.services = [
	{ binding: 'ACCOUNT', ...service },
	{ binding: 'API', ...service }
];
const liveConfig = path.join(path.dirname(gen), 'wrangler.e2e-live.json');
writeFileSync(liveConfig, JSON.stringify(cfg, null, 2));
const consoleVars = path.join(path.dirname(gen), '.dev.vars');
writeFileSync(consoleVars, `ASSERTION_KEY=${assertionKey}\n`, { mode: 0o600 });

const env = { ...process.env, CI: '1' };
if (!remote)
	execFileSync(
		wrangler,
		['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', LIVE_STATE, '-c', apiConfig],
		{ stdio: ['ignore', 'ignore', 'inherit'], env }
	);

const child = spawn(
	wrangler,
	[
		'dev',
		'-c',
		liveConfig,
		...(remote ? [] : ['-c', apiConfig]),
		'--ip',
		'127.0.0.1',
		'--port',
		String(port),
		'--inspector-port',
		String(port + 5170),
		'--persist-to',
		LIVE_STATE
	],
	{ stdio: 'inherit', env }
);
const stop = () => {
	child.kill('SIGINT');
	rmSync(consoleVars, { force: true });
	rmSync(apiDir, { recursive: true, force: true });
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
