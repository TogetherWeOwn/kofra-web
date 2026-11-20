import { describe, expect, it } from 'vitest';
import { grantSummary, grantsFromForm } from './grants.js';

describe('grants', () => {
	it('summarises a key’s access', () => {
		expect(
			grantSummary([
				{ bucket: 'a', access: 'read_write' },
				{ bucket: 'b', access: 'read' },
				{ bucket: 'c', access: 'read' }
			])
		).toBe('Read and write: a · Read only: b, c');
		expect(grantSummary([])).toBe('');
	});

	it('reads only known buckets and known access levels from the form', () => {
		const f = new FormData();
		f.set('access:a', 'read');
		f.set('access:b', 'none');
		f.set('access:c', 'read_write');
		f.set('access:evil', 'read_write');
		f.set('access:d', 'admin');
		expect(grantsFromForm(f, ['a', 'b', 'c', 'd'])).toEqual([
			{ bucket: 'a', access: 'read' },
			{ bucket: 'c', access: 'read_write' }
		]);
	});
});
