import { describe, expect, it } from 'vitest';
import { describeEvent } from './events.js';

const ev = (type: string, data: Record<string, unknown> = {}) => ({
	id: 'evt_1',
	type,
	created_at: '2026-11-19T10:00:00Z',
	data
});

describe('describeEvent', () => {
	it('reads known events and passes unknown ones through', () => {
		expect(describeEvent(ev('bucket.created', { bucket: 'photos' }))).toBe('Bucket photos created');
		expect(describeEvent(ev('key.created', { key_id: 'KF1' }))).toBe('Access key KF1 created');
		expect(describeEvent(ev('key.created', { key_id: 5 }))).toBe('Access key  created');
		expect(describeEvent(ev('share.created'))).toBe('share.created');
	});
});
