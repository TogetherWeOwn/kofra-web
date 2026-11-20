import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANNOUNCER_STYLE_HASH } from './csp.js';

describe('CSP style hash', () => {
	it('matches the route announcer style of the installed framework', () => {
		const require = createRequire(import.meta.url);
		const kit = path.dirname(require.resolve('@sveltejs/kit/package.json'));
		const root = readFileSync(path.join(kit, 'src/runtime/components/root.svelte'), 'utf8');
		const styles = [...root.matchAll(/style="([^"]+)"/g)].map((m) => m[1]!);
		expect(styles).toHaveLength(1);
		expect(`sha256-${createHash('sha256').update(styles[0]!).digest('base64')}`).toBe(
			ANNOUNCER_STYLE_HASH
		);
	});
});
