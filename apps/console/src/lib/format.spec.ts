import { describe, expect, it } from 'vitest';
import { ago, byteScale, bytes, count, date, dateTime, percent, shortDay } from './format.js';

describe('format', () => {
	it('formats bytes with decimal units and three significant figures', () => {
		expect(bytes(0)).toBe('0 B');
		expect(bytes(999)).toBe('999 B');
		expect(bytes(1204)).toBe('1.2 KB');
		expect(bytes(442_381_631_488)).toBe('442 GB');
		expect(bytes(1_099_511_627_776)).toBe('1.1 TB');
		expect(bytes(18_400_000_000)).toBe('18.4 GB');
		expect(bytes(-1)).toBe('–');
	});

	it('picks an axis unit', () => {
		expect(byteScale(442e9)).toEqual({ unit: 'GB', div: 1e9 });
		expect(byteScale(1.2e12)).toEqual({ unit: 'TB', div: 1e12 });
		expect(byteScale(10)).toEqual({ unit: 'B', div: 1 });
	});

	it('formats counts, dates and times in UTC', () => {
		expect(count(12604)).toBe('12,604');
		expect(date('2026-11-19T23:30:00Z')).toBe('19 Nov 2026');
		expect(shortDay('2026-11-01')).toBe('1 Nov');
		expect(dateTime('2026-11-19T07:05:00Z')).toBe('19 Nov 2026, 07:05 UTC');
		expect(date('nope')).toBe('–');
	});

	it('says how long ago', () => {
		const now = Date.parse('2026-11-20T12:00:00Z');
		expect(ago('2026-11-20T11:59:30Z', now)).toBe('just now');
		expect(ago('2026-11-20T11:00:00Z', now)).toBe('1 hour ago');
		expect(ago('2026-11-18T12:00:00Z', now)).toBe('2 days ago');
		expect(ago('2026-09-01T12:00:00Z', now)).toBe('1 Sep 2026');
	});

	it('formats percentages', () => {
		expect(percent(1, 1000)).toBe('<1%');
		expect(percent(0, 10)).toBe('0%');
		expect(percent(5, 10)).toBe('50%');
		expect(percent(20, 10)).toBe('100%');
		expect(percent(1, 0)).toBe('–');
	});
});
