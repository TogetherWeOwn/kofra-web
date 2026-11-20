import { describe, expect, it } from 'vitest';
import { usageCsv } from './csv.js';

describe('usageCsv', () => {
	it('writes a header and one row per day', () => {
		const csv = usageCsv([
			{
				day: '2026-11-19',
				status: 'final',
				peak_stored_bytes: 1,
				uploaded_bytes: 2,
				downloaded_bytes: 3,
				requests_approx: 4
			},
			{
				day: '2026-11-20',
				status: 'provisional',
				peak_stored_bytes: 5,
				uploaded_bytes: 6,
				downloaded_bytes: 7,
				requests_approx: 8
			}
		]);
		expect(csv).toBe(
			'day,status,peak_stored_bytes,uploaded_bytes,downloaded_bytes,requests_approx\r\n2026-11-19,final,1,2,3,4\r\n2026-11-20,provisional,5,6,7,8\r\n'
		);
	});
});
