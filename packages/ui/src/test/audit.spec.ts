import { describe, expect, it } from 'vitest';
import { audit } from './audit.js';
import Bad from './Bad.svelte';

describe('audit helper', () => {
	it('reports real violations, so a passing component audit means something', async () => {
		const a = await audit(Bad, {});
		expect(a.violations.map((v) => v.split(' ')[0])).toEqual(
			expect.arrayContaining(['button-name', 'image-alt'])
		);
	});
});
