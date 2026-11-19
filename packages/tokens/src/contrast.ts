// WCAG 2.2 contrast ratio between two opaque sRGB colours (#rrggbb).

function channel(c: number): number {
	const s = c / 255;
	return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (WCAG 2.2, "relative luminance" definition). */
export function luminance(hex: string): number {
	if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`not a #rrggbb colour: ${hex}`);
	const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16))) as [
		number,
		number,
		number
	];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio from 1 to 21. */
export function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
}
