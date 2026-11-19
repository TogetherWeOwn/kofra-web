// Forbidden-word gate (hard). Fails when tracked files or build output contain a term from the
// deny-list: back-end vocabulary that must never appear on Kofra surfaces, and internal names.
//
// The terms are stored as SHA-256 hashes so this public repository does not itself contain them
// (search hygiene, not secrecy). Matching is case-insensitive on every substring of every
// alphanumeric token, so compounds and suffixes are caught too.
//
// Usage: node scripts/forbidden-words.mjs [dir ...]
//   no arguments: every file tracked by git
//   with directories: every file under them (for build output)
//   --self-test: proves the matcher finds a planted term
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** [term length, sha256(term)] */
const TERMS = [
	[6, '0805febed88ee3f114f11b596db509d807297b6b97325446638ae97df6701b3d'],
	[4, '4bebff23ba85576aa1aae2da796fae9fe7c2ef3d6060f5f210f07b7a062588de'],
	[7, '5bd20b1429301ffece1e15fb102ca635b14879d48431cd5aaa497b7491711545'],
	[9, '87e84d8d2bc2dacfe213b7966dff492352a5e30835c45ca939f7384e282fd326'],
	[4, '255b28b74315db29c415b09f585f2e7cc19caf029d4e200454515ba1b7dabe3d'],
	[4, 'e722121095c7998c703acdd37183ee8265c80f077df0620ebc1c7dd66c3ad1ec'],
	[3, '5099941fc6e5440244a41b3f6e466d8933f73ea1647f042bf051b380a43acdcc'],
	[8, 'b2e78e3a5bb1d60df728818ea576deafd6ba9b428fefe13794e012f226516dad'],
	[8, '0ed80614304d49d468706678f6384a1f9e3674af35fb4ae8d2222082c1dc8091'],
	[11, '304584d86d0c626480601a1147ec1b784070dd7569d41abf1b5e4cc159000547'],
	[5, 'ab39960d0fef3a6caee5cdcb7ec568464336be5a1598b3f69476d4c16c2f30fd'],
	[8, 'a985b46c05be9e7f74d5f4eb7f655ec20c0946df17a32ad27f9a9ee74753f679'],
	[9, '8801a13c3308b815bab6d6068c1cdbcd7d965f83ab31632f16d8ef4ab284240c'],
	[9, '574623b392b52accfc77abdfbc05a05eb4ecc0f2f84cd2fe4db348a9c84fe988'],
	[9, '0aedb001db1b74b6344b5f172eb6c5507f0616ddc54864a4e44f4503321acba0'],
	[6, '4a2693cccb61524b160fed27b73378e6abc0fc42cb2d455725af9f614ed68f92'],
	[9, '670d47ccb9a6cdef180e87d03ef6a3b783c771ecac19fb76c3ba5551ab369da8'],
	[9, '21a27eee7361887f9472301251783f71c588e5dec08d785bab5b07546ecf4f86']
];

const SELF_TEST = [17, '6262265f2d5bc6cf3a76abb19ecb046fd6a98b6a298f46a13316c109c411f4e2']; // sha256 of "kofraselftestterm"

const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|zip|gz|br)$/i;

const sha = (s) => createHash('sha256').update(s).digest('hex');

/**
 * Build tools name assets with random content hashes (`_layout.CJwq8O2U.css`); a hash can
 * contain a short term by chance. In build output only, an 8-character segment before an asset
 * extension that mixes letter cases or digits (as hashes do, and authored names rarely do) is
 * removed before matching. Source files are always matched in full.
 */
const CONTENT_HASH = /[.-]([A-Za-z0-9_-]{8})(?=\.(?:js|mjs|css|woff2?|png|svg|json|map)\b)/g;
const hashLike = (seg) => /[A-Z]/.test(seg) || /[0-9_-]/.test(seg);
export const stripHashes = (line) =>
	line.replace(CONTENT_HASH, (m, seg) => (hashLike(seg) ? '' : m));

/** Returns the [line, hash] of every deny-listed substring in the text. */
export function findTerms(text, terms = TERMS, { build = false } = {}) {
	const byLength = new Map();
	for (const [len, hash] of terms) {
		if (!byLength.has(len)) byLength.set(len, new Set());
		byLength.get(len).add(hash);
	}
	const hits = [];
	text.split('\n').forEach((line, i) => {
		for (const token of (build ? stripHashes(line) : line).toLowerCase().match(/[a-z0-9]+/g) ??
			[]) {
			for (const [len, hashes] of byLength) {
				for (let at = 0; at + len <= token.length; at++) {
					const h = sha(token.slice(at, at + len));
					if (hashes.has(h)) hits.push([i + 1, h.slice(0, 12)]);
				}
			}
		}
	});
	return hits;
}

function walk(dir) {
	return readdirSync(dir).flatMap((name) => {
		const f = path.join(dir, name);
		return statSync(f).isDirectory() ? walk(f) : [f];
	});
}

// import.meta.main needs Node 24.2; this works on every Node the engines field allows.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const args = process.argv.slice(2);
	if (args[0] === '--self-test') {
		const found = findTerms('ok\nsome Kofraselftesttermish text', [SELF_TEST]);
		// A term inside a content-hashed asset name is ignored; the same term in text is not.
		const hashTerm = [[8, sha('kofrasel')]];
		const inHash = findTerms('see _app/x.kOfrasel.js', hashTerm, { build: true });
		const authored = findTerms('see /guide.kofrasel.js', hashTerm, { build: true });
		const inSource = findTerms('see _app/x.kOfrasel.js', hashTerm);
		const inText = findTerms('see kofrasel here', hashTerm);
		const clean = findTerms('nothing to see here', [SELF_TEST]);
		if (
			found.length !== 1 ||
			found[0][0] !== 2 ||
			clean.length !== 0 ||
			inHash.length !== 0 ||
			authored.length !== 1 ||
			inSource.length !== 1 ||
			inText.length !== 1
		) {
			console.error('self-test failed', { found, clean, inHash, authored, inSource, inText });
			process.exit(1);
		}
		console.log('self-test passed');
		process.exit(0);
	}
	const files = args.length
		? args.flatMap(walk)
		: execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
	let bad = 0;
	for (const file of files) {
		if (BINARY.test(file) || file === 'pnpm-lock.yaml') continue;
		let text;
		try {
			text = readFileSync(file, 'utf8');
		} catch {
			continue; // deleted in the working tree, or unreadable
		}
		for (const [line, h] of findTerms(text, TERMS, { build: args.length > 0 })) {
			bad++;
			console.error(`${file}:${line}: forbidden term (hash ${h})`);
		}
	}
	console.log(`checked ${files.length} files: ${bad} forbidden term(s)`);
	process.exit(bad ? 1 : 0);
}
