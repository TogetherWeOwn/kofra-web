import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const vendor = (p: string) => fileURLToPath(new URL(`../vendor/${p}`, import.meta.url));
const manifest = JSON.parse(readFileSync(vendor('VENDOR.json'), 'utf8')) as {
	repository: string;
	commit: string;
	files: { path: string; sha256: string }[];
};

describe('vendored SDK and contract', () => {
	it('records a full source commit', () => {
		expect(manifest.repository).toBe('TogetherWeOwn/kofra-api');
		expect(manifest.commit).toMatch(/^[0-9a-f]{40}$/);
	});

	it('has vendored-tree metadata for the same commit', () => {
		const meta = JSON.parse(readFileSync(vendor('VENDORED.json'), 'utf8'));
		expect(Object.keys(meta)).toEqual(['dependencies']);
		expect(meta.dependencies).toEqual([
			{
				purl: `pkg:github/togetherweown/kofra-api@${manifest.commit}`,
				version: expect.stringMatching(/^\d+\.\d+\.\d+/),
				upstream_commit: manifest.commit
			}
		]);
	});

	// Edit nothing under vendor/ by hand: re-run scripts/sync.mjs against a kofra-api checkout.
	for (const { path: file, sha256: hash } of manifest.files) {
		it(`${file} matches its recorded hash`, () => {
			expect(
				createHash('sha256')
					.update(readFileSync(vendor(file)))
					.digest('hex')
			).toBe(hash);
		});
	}
});
