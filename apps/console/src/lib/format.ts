// Display formatting. Sizes use decimal units (1 GB = 1,000,000,000 bytes), as on the
// pricing page and invoices. Dates are shown in UTC so server and browser render the same.

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/** 442381631488 → "442 GB"; 3 significant figures, no trailing zeros. */
export function bytes(n: number): string {
	if (!Number.isFinite(n) || n < 0) return '–';
	let i = 0;
	let v = n;
	while (v >= 1000 && i < UNITS.length - 1) {
		v /= 1000;
		i++;
	}
	if (i === 0) return `${n} B`;
	const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
	const shown = Number(v.toFixed(digits));
	// 999,999 bytes rounds to "1000 KB": show it as "1 MB" instead.
	if (shown >= 1000 && i < UNITS.length - 1) return `1 ${UNITS[i + 1]}`;
	return `${shown} ${UNITS[i]}`;
}

/** The unit and divisor that suit a set of values (for chart axes and tables). */
export function byteScale(max: number): { unit: string; div: number } {
	let i = 0;
	while (max >= 1000 ** (i + 1) && i < UNITS.length - 1) i++;
	return { unit: UNITS[i]!, div: 1000 ** i };
}

export const count = (n: number) => n.toLocaleString('en-US');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-19T10:00:00Z" → "19 Nov 2026". */
export function date(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '–';
	return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2026-11-19" → "19 Nov". */
export function shortDay(day: string): string {
	const d = new Date(`${day.slice(0, 10)}T00:00:00Z`);
	return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "19 Nov 2026, 10:00 UTC". */
export function dateTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '–';
	const hh = String(d.getUTCHours()).padStart(2, '0');
	const mm = String(d.getUTCMinutes()).padStart(2, '0');
	return `${date(iso)}, ${hh}:${mm} UTC`;
}

/** "3 hours ago", relative to `now`. Falls back to the date after 30 days. */
export function ago(iso: string, now: number = Date.now()): string {
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return '–';
	const s = Math.max(0, Math.round((now - t) / 1000));
	const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'} ago`;
	if (s < 60) return 'just now';
	if (s < 3600) return unit(Math.floor(s / 60), 'minute');
	if (s < 86400) return unit(Math.floor(s / 3600), 'hour');
	if (s < 30 * 86400) return unit(Math.floor(s / 86400), 'day');
	return date(iso);
}

/** Whole percent of `part` in `whole`, clamped to 0–100; "<1%" for small non-zero parts. */
export function percent(part: number, whole: number): string {
	if (!(whole > 0)) return '–';
	const p = (part / whole) * 100;
	if (p > 0 && p < 1) return '<1%';
	return `${Math.min(100, Math.round(p))}%`;
}
