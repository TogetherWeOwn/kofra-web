import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens: unknown = JSON.parse(
	readFileSync(new URL('../tokens.json', import.meta.url), 'utf8')
);

/** A DTCG token is an object with `$value`; a group holds tokens or groups. */
function invalidPaths(node: unknown, path: string[] = []): string[] {
	if (typeof node !== 'object' || node === null || Array.isArray(node)) {
		return [path.join('.') || '(root)'];
	}
	if ('$value' in node) return [];
	return Object.entries(node).flatMap(([key, child]) =>
		key.startsWith('$') ? [] : invalidPaths(child, [...path, key])
	);
}

describe('tokens.json', () => {
	it('is a DTCG group whose leaves are all tokens with $value', () => {
		expect(invalidPaths(tokens)).toEqual([]);
	});

	it('rejects a leaf without $value', () => {
		expect(invalidPaths({ color: { brand: { hex: '#000' } } })).toEqual(['color.brand.hex']);
	});
});
