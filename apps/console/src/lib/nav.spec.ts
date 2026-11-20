import { describe, expect, it } from 'vitest';
import { currentEntry } from './nav.js';

describe('currentEntry', () => {
	it('matches the overview exactly and sections by prefix', () => {
		expect(currentEntry('/')?.label).toBe('Overview');
		expect(currentEntry('/buckets')?.label).toBe('Buckets');
		expect(currentEntry('/buckets/photos/delete')?.label).toBe('Buckets');
		expect(currentEntry('/bucketsx')).toBeUndefined();
		expect(currentEntry('/sign-in')).toBeUndefined();
	});
});
