// Copies the TypeScript SDK and the published contract from a checkout of the kofra-api
// repository into vendor/, and records the source commit and SHA-256 of every file in
// vendor/VENDOR.json. A unit test (src/vendor.spec.ts) fails when a vendored file no longer
// matches its recorded hash, so the copies are never edited by hand.
//
// Usage: node scripts/sync.mjs <path to a kofra-api checkout>
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.join(here, '..', 'vendor');

/** [source path in kofra-api, destination under vendor/] */
export const FILES = [
	['sdk/typescript/src/core.ts', 'sdk/core.ts'],
	['sdk/typescript/src/index.ts', 'sdk/index.ts'],
	['sdk/typescript/src/operations.ts', 'sdk/operations.ts'],
	['sdk/typescript/src/schema.ts', 'sdk/schema.ts'],
	['generated/openapi.json', 'openapi.json'],
	['generated/errors.json', 'errors.json']
];

const source = process.argv[2];
if (!source) {
	console.error('usage: node scripts/sync.mjs <kofra-api checkout>');
	process.exit(2);
}
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {
	encoding: 'utf8'
}).trim();
const dirty = execFileSync(
	'git',
	['-C', source, 'status', '--porcelain', '--', 'sdk', 'generated'],
	{
		encoding: 'utf8'
	}
).trim();
if (dirty) {
	console.error('the kofra-api checkout has uncommitted changes under sdk/ or generated/');
	process.exit(1);
}
const files = [];
for (const [from, to] of FILES) {
	const dest = path.join(vendor, to);
	mkdirSync(path.dirname(dest), { recursive: true });
	copyFileSync(path.join(source, from), dest);
	files.push({ path: to, sha256: createHash('sha256').update(readFileSync(dest)).digest('hex') });
}
writeFileSync(
	path.join(vendor, 'VENDOR.json'),
	JSON.stringify({ repository: 'TogetherWeOwn/kofra-api', commit, files }, null, '\t') + '\n'
);
console.log(`vendored ${FILES.length} files from kofra-api ${commit.slice(0, 12)}`);
