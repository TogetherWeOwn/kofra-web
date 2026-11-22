// Starts the console in `live` mode against the real account service and
// API: the Kofra API Worker from a kofra-api checkout (KOFRA_API_DIR, built
// with `./build.sh` in workers/kofra-api), on a fresh local D1, reached over
// the console's ACCOUNT and API service bindings exactly as deployed. Tests
// only; used by the `live` Playwright project.
//
//   node e2e/live-servers.ts <port>
//
// Keys are never printed. They go to .dev.vars files next to this run's own
// generated copies of both Workers' configurations, in the run's state folder
// (git-ignored, owner-only), which is removed when the run stops; no
// developer's .dev.vars is ever touched. Mail stays in the API's local outbox
// table, which the tests read with `wrangler d1 execute`.
//
// With KOFRA_E2E_REMOTE_API (the name of a deployed API Worker) the console
// still runs here, but its bindings reach that deployed Worker (remote
// bindings) and its database (KOFRA_E2E_REMOTE_D1, read by the tests); the
// deployed Worker's assertion key comes in KOFRA_E2E_ASSERTION_KEY. Only for a
// staging copy whose mail for test addresses goes to its outbox, and only with
// KOFRA_E2E_REMOTE_ACK naming that database.
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.argv[2] ?? 4176);
const remote = process.env.KOFRA_E2E_REMOTE_API;
const remoteDb = process.env.KOFRA_E2E_REMOTE_D1;
const apiRoot = process.env.KOFRA_API_DIR;
// Local or remote, never a mix: a local run must not write to a deployed database.
if (remote || remoteDb) {
	if (!remote || !remoteDb || apiRoot)
		throw new Error(
			'KOFRA_E2E_REMOTE_API and KOFRA_E2E_REMOTE_D1 go together, without KOFRA_API_DIR'
		);
	if (process.env.KOFRA_E2E_REMOTE_ACK !== remoteDb)
		throw new Error('KOFRA_E2E_REMOTE_ACK must name the deployed database the tests write to');
} else if (!apiRoot || !path.isAbsolute(apiRoot)) {
	throw new Error('KOFRA_API_DIR must be the absolute path of a kofra-api checkout');
}
const api = path.resolve(apiRoot ?? '.', 'workers/kofra-api');
if (!remote && !existsSync(path.join(api, 'wrangler.toml')))
	throw new Error('KOFRA_API_DIR has no workers/kofra-api/wrangler.toml');
const here = path.dirname(fileURLToPath(import.meta.url));
const consoleDir = path.resolve(here, '..');
export const LIVE_STATE = path.join(consoleDir, '.wrangler', 'e2e-live');
const wrangler = path.join(consoleDir, 'node_modules', '.bin', 'wrangler');

rmSync(LIVE_STATE, { recursive: true, force: true });
mkdirSync(LIVE_STATE, { recursive: true, mode: 0o700 });
let cleaned = false;
/** Removes every file this run wrote: its configurations, keys and database. */
const cleanup = () => {
	if (cleaned) return;
	cleaned = true;
	rmSync(LIVE_STATE, { recursive: true, force: true });
};
// From here on, every way out removes the keys: a normal or failed exit (an uncaught error
// included), SIGINT, SIGTERM, SIGHUP (a closed terminal) and SIGQUIT. Only SIGKILL cannot be
// caught; the folder is owner-only and git-ignored, and the next run removes it first.
let child: ReturnType<typeof spawn> | undefined = undefined;
process.on('exit', cleanup);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'] as const)
	process.on(signal, () => {
		if (child && child.exitCode === null) child.kill('SIGINT');
		else process.exit(1);
		cleanup();
	});

const hex = () => randomBytes(32).toString('hex');
const assertionKey = remote ? process.env.KOFRA_E2E_ASSERTION_KEY : hex();
if (!assertionKey || !/^[a-f0-9]{64}$/.test(assertionKey))
	throw new Error('KOFRA_E2E_ASSERTION_KEY must hold the deployed API Worker key');

// The API Worker's configuration, copied as it is into the state folder with only its two
// paths made absolute, and its keys beside it.
const apiDir = path.join(LIVE_STATE, 'api');
const apiConfig = path.join(apiDir, 'wrangler.toml');
if (!remote) {
	mkdirSync(apiDir, { recursive: true });
	let toml = readFileSync(path.join(api, 'wrangler.toml'), 'utf8');
	const absolute = (key: string, value: string) => {
		// A top-level `key = "…"` or `key = '…'` line, indented or not.
		const line = new RegExp(`^[ \\t]*${key}[ \\t]*=[ \\t]*(?:"[^"\\n]*"|'[^'\\n]*')`, 'm');
		if (!line.test(toml)) throw new Error(`the API Worker configuration has no ${key}`);
		// A replacer function: the path is taken literally (no `$&` patterns).
		toml = toml.replace(line, () => `${key} = ${JSON.stringify(value)}`);
	};
	absolute('main', path.join(api, 'entry.mjs'));
	absolute('migrations_dir', path.resolve(api, '../../migrations'));
	writeFileSync(apiConfig, toml);
	writeFileSync(
		path.join(apiDir, '.dev.vars'),
		`ACCOUNT_SECRET_KEY=${hex()}\nASSERTION_KEY=${assertionKey}\nCURSOR_KEY=${hex()}\n`,
		{ mode: 0o600 }
	);
}

// The console as built, in live mode, bound to the API's Console entry point. Its copy goes
// to the state folder too, with its paths made absolute.
const gen = path.join(consoleDir, '.svelte-kit/cloudflare/worker/wrangler.json');
const cfg = JSON.parse(readFileSync(gen, 'utf8'));
for (const k of ['configPath', 'userConfigPath', 'topLevelName', 'definedEnvironments'])
	delete cfg[k];
cfg.main = path.resolve(path.dirname(gen), cfg.main);
if (cfg.assets?.directory)
	cfg.assets.directory = path.resolve(path.dirname(gen), cfg.assets.directory);
cfg.name = 'kofra-console-e2e-live';
cfg.vars = { ...cfg.vars, CONSOLE_DATA: 'live', BILLING: 'off' };
const service = remote
	? { service: remote, entrypoint: 'Console', remote: true }
	: { service: 'kofra-api', entrypoint: 'Console' };
cfg.services = [
	{ binding: 'ACCOUNT', ...service },
	{ binding: 'API', ...service }
];
const consoleState = path.join(LIVE_STATE, 'console');
mkdirSync(consoleState, { mode: 0o700 });
const liveConfig = path.join(consoleState, 'wrangler.json');
writeFileSync(liveConfig, JSON.stringify(cfg, null, 2));
writeFileSync(path.join(consoleState, '.dev.vars'), `ASSERTION_KEY=${assertionKey}\n`, {
	mode: 0o600
});

const env = { ...process.env, CI: '1' };
if (!remote)
	execFileSync(
		wrangler,
		['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', LIVE_STATE, '-c', apiConfig],
		{ stdio: ['ignore', 'ignore', 'inherit'], env }
	);

child = spawn(
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
child.on('error', (err) => {
	console.error(`live servers: ${err.message}`);
	process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));
