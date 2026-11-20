import { describe, expect, it } from 'vitest';
import { openDemo } from './demo.js';
import { allDays, latestEvents, recentDays } from './lists.js';

const url = new URL('https://console.example/');

describe('oldest-first lists', () => {
	it('reads the latest days and the whole history', async () => {
		const { api } = openDemo(url, undefined);
		const days = await recentDays(api, 7);
		expect(days).toHaveLength(7);
		expect(days.at(-1)!.day).toBe(new Date().toISOString().slice(0, 10));
		expect((await allDays(api)).length).toBeGreaterThanOrEqual(30);
	});

	it('returns the newest events first', async () => {
		const { api } = openDemo(url, undefined);
		await api.buckets.create({ body: { name: 'newest-one' } });
		const events = await latestEvents(api, 3);
		expect(events).toHaveLength(3);
		expect(events[0]!.data).toEqual({ bucket: 'newest-one' });
		expect(Date.parse(events[0]!.created_at)).toBeGreaterThanOrEqual(
			Date.parse(events[2]!.created_at)
		);
	});
});
