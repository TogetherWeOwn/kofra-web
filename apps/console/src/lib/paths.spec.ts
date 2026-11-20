import { describe, expect, it } from 'vitest';
import { folderCrumbs, uploadKey, validKey, validPrefix } from './paths.js';

describe('paths', () => {
	it('accepts folder prefixes', () => {
		expect(validPrefix('')).toBe(true);
		expect(validPrefix('a/b/')).toBe(true);
		expect(validPrefix('a/b')).toBe(false);
		expect(validPrefix('/a/')).toBe(false);
		expect(validPrefix('a//')).toBe(false);
		expect(validPrefix('a\n/')).toBe(false);
	});
	it('accepts upload keys', () => {
		expect(validKey('a/b.txt')).toBe(true);
		expect(validKey('photo é.jpg')).toBe(true);
		expect(validKey('a/')).toBe(false);
		expect(validKey('a/../b')).toBe(false);
		expect(validKey('x'.repeat(1025))).toBe(false);
		expect(validKey('é'.repeat(513))).toBe(false);
	});
	it('builds folder crumbs and upload keys', () => {
		expect(folderCrumbs('a/b/')).toEqual([
			{ name: 'a', prefix: 'a/' },
			{ name: 'b', prefix: 'a/b/' }
		]);
		expect(folderCrumbs('')).toEqual([]);
		expect(uploadKey('docs/', 'x.pdf')).toBe('docs/x.pdf');
		expect(uploadKey('', 'trip/day1.jpg')).toBe('trip/day1.jpg');
	});
});
