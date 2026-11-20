// Axis arithmetic for the console's charts.

/** A "nice" step (1, 2 or 5 × 10^n) so that about `count` steps cover `max`. */
export function niceStep(max: number, count = 4): number {
	if (!(max > 0)) return 1;
	const raw = max / count;
	const mag = 10 ** Math.floor(Math.log10(raw));
	const norm = raw / mag;
	const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
	return nice * mag;
}

/** Ticks from 0 to at least `max`, in nice steps. */
export function ticks(max: number, count = 4): number[] {
	const step = niceStep(max, count);
	const top = Math.max(step, Math.ceil(max / step - 1e-9) * step);
	const out: number[] = [];
	for (let v = 0; v <= top + step / 2; v += step) out.push(Number(v.toPrecision(12)));
	return out;
}

/** Indexes of x labels to show so they keep at least `minGap` pixels apart, last one always. */
export function labelIndexes(n: number, band: number, minGap = 64): number[] {
	if (n <= 0) return [];
	const every = Math.max(1, Math.ceil(minGap / Math.max(band, 1)));
	const out: number[] = [];
	for (let i = n - 1; i >= 0; i -= every) out.unshift(i);
	return out;
}

export interface DayValue {
	day: string;
	value: number;
	provisional: boolean;
	/** Columns only: true for days in the current period (the accent), false for context. */
	current?: boolean;
}
