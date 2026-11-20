import type { UsageDay } from '@kofra/api';

/** RFC 4180 CSV of daily usage; sizes in bytes so spreadsheets can sum them. */
export function usageCsv(days: UsageDay[]): string {
	const head = 'day,status,peak_stored_bytes,uploaded_bytes,downloaded_bytes,requests_approx';
	const esc = (v: string | number) => {
		const s = String(v);
		return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	const rows = days.map((d) =>
		[d.day, d.status, d.peak_stored_bytes, d.uploaded_bytes, d.downloaded_bytes, d.requests_approx]
			.map(esc)
			.join(',')
	);
	return [head, ...rows].join('\r\n') + '\r\n';
}
