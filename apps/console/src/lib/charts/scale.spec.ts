import { describe, expect, it } from 'vitest';
import { labelIndexes, niceStep, ticks } from './scale.js';

describe('chart scales', () => {
	it('picks 1-2-5 steps', () => {
		expect(niceStep(442, 4)).toBe(200);
		expect(niceStep(1100, 4)).toBe(500);
		expect(niceStep(17, 4)).toBe(5);
		expect(niceStep(0)).toBe(1);
	});
	it('covers the maximum from zero', () => {
		expect(ticks(442)).toEqual([0, 200, 400, 600]);
		expect(ticks(400)).toEqual([0, 100, 200, 300, 400]);
		expect(ticks(0.35)).toEqual([0, 0.1, 0.2, 0.3, 0.4]);
	});
	it('spaces x labels and always keeps the last', () => {
		expect(labelIndexes(30, 20, 64)).toEqual([1, 5, 9, 13, 17, 21, 25, 29]);
		expect(labelIndexes(3, 100)).toEqual([0, 1, 2]);
		expect(labelIndexes(0, 10)).toEqual([]);
	});
});
