import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from './contrast.js';
import { cssValue, flatten, toCss, type Json } from './css.js';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const tokens = JSON.parse(read('tokens.json')) as Json;

/** A DTCG token is an object with `$value`; a group holds tokens or groups. */
function invalidPaths(node: unknown, path: string[] = []): string[] {
	if (typeof node !== 'object' || node === null || Array.isArray(node)) {
		return [path.join('.') || '(root)'];
	}
	if ('$value' in node) return [];
	return Object.entries(node).flatMap(([key, child]) =>
		key.startsWith('$') ? [] : invalidPaths(child, [...path, key])
	);
}

describe('tokens.json', () => {
	it('is a DTCG group whose leaves are all tokens with $value', () => {
		expect(invalidPaths(tokens)).toEqual([]);
	});

	it('rejects a leaf without $value', () => {
		expect(invalidPaths({ color: { brand: { hex: '#000' } } })).toEqual(['color.brand.hex']);
	});

	it('keeps every colour hex in step with its sRGB components', () => {
		const mismatches: string[] = [];
		// hex is an optional fallback in DTCG 2025.10; when present it must agree.
		const check = (v: { components: number[]; hex?: string }, where: string) => {
			if (v.hex === undefined) return;
			const fromComponents =
				'#' +
				v.components
					.map((c) =>
						Math.round(c * 255)
							.toString(16)
							.padStart(2, '0')
					)
					.join('');
			if (fromComponents !== v.hex) mismatches.push(`${where}: ${fromComponents} != ${v.hex}`);
		};
		const colors = (tokens as { color: Record<string, Json> }).color;
		for (const [name, token] of Object.entries(colors)) {
			if (name.startsWith('$')) continue;
			const t = token as {
				$value: { components: number[]; hex: string };
				$extensions: { 'app.kofra.modes': { dark: { components: number[]; hex: string } } };
			};
			check(t.$value, name);
			check(t.$extensions['app.kofra.modes'].dark, `${name} (dark)`);
		}
		expect(mismatches).toEqual([]);
	});

	it('gives every colour token a dark value', () => {
		const colours = flatten(tokens).filter((t) => t.type === 'color');
		expect(colours.length).toBeGreaterThan(10);
		expect(colours.filter((t) => t.dark === undefined).map((t) => t.path)).toEqual([]);
	});
});

describe('contrast (WCAG 2.2)', () => {
	const byMode = (mode: 'light' | 'dark') =>
		Object.fromEntries(
			flatten(tokens)
				.filter((t) => t.type === 'color')
				.map((t) => [t.path.slice('color.'.length), mode === 'light' ? t.value : t.dark!])
		) as Record<string, string>;

	// [foreground, background, minimum]. 4.5 for text, 3 for large text,
	// focus rings and the borders of controls (SC 1.4.3, 1.4.11).
	const pairs: [string, string, number][] = [
		['ink', 'bg', 4.5],
		['ink', 'band', 4.5],
		['ink', 'surface', 4.5],
		['ink', 'surface-2', 4.5],
		['ink-2', 'bg', 4.5],
		['ink-2', 'band', 4.5],
		['ink-2', 'surface', 4.5],
		['muted', 'bg', 4.5],
		['muted', 'band', 4.5],
		['muted', 'surface', 4.5],
		['accent-text', 'bg', 4.5],
		['accent-text', 'band', 4.5],
		['accent-text', 'surface', 4.5],
		['accent-ink', 'accent', 4.5],
		['accent-ink', 'accent-hover', 4.5],
		['success', 'bg', 4.5],
		['success', 'band', 4.5],
		['success', 'surface', 4.5],
		['warning', 'surface', 4.5],
		['danger', 'surface', 4.5],
		['code-ink', 'code-bg', 4.5],
		['focus', 'bg', 3],
		['focus', 'band', 3],
		['focus', 'surface', 3],
		['border-strong', 'bg', 3],
		['border-strong', 'surface', 3],
		['accent', 'bg', 3]
	];

	for (const mode of ['light', 'dark'] as const) {
		it(`meets the minimum for every text and control pair in ${mode} mode`, () => {
			const c = byMode(mode);
			const failures = pairs
				.map(([fg, bg, min]) => ({ fg, bg, min, ratio: contrast(c[fg]!, c[bg]!) }))
				.filter((p) => p.ratio < p.min)
				.map((p) => `${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)} < ${p.min}`);
			expect(failures).toEqual([]);
		});
	}

	it('computes known ratios', () => {
		expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
		expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
		expect(contrast('#ffffff', '#ffffff')).toBe(1);
	});
});

describe('tokens.css', () => {
	it('matches the generator output (run `pnpm --filter @kofra/tokens run build`)', () => {
		expect(read('tokens.css')).toBe(toCss(tokens));
	});

	it('pins the light defaults, the system dark mode and the saved dark theme', () => {
		const css = toCss(tokens);
		expect(css).toContain(':root {\n\tcolor-scheme: light;\n\t--color-bg: #ffffff;');
		expect(css).toMatch(
			/@media \(prefers-color-scheme: dark\) \{\n\t:root:not\(\[data-theme='light'\]\) \{\n\t\tcolor-scheme: dark;\n\t\t--color-bg: #0f100f;/
		);
		expect(css).toContain(
			":root[data-theme='dark'] {\n\tcolor-scheme: dark;\n\t--color-bg: #0f100f;"
		);
	});

	it('emits every token family the site uses', () => {
		const css = toCss(tokens);
		for (const name of [
			'--font-family-sans: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;',
			'--font-family-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", "Menlo", "Consolas", monospace;',
			'--font-size-base: 16px;',
			'--font-tracking-tight: -0.02;',
			'--space-4: 16px;',
			'--radius-lg: 8px;',
			'--size-container: 1200px;',
			'--shadow-raised: 0 1px 2px 0 rgb(0 0 0 / 0.04), 0 12px 32px -12px rgb(0 0 0 / 0.18);',
			'--motion-duration-fast: 150ms;',
			'--motion-easing-standard: cubic-bezier(0.25, 0.1, 0.25, 1);'
		]) {
			expect(css).toContain(name);
		}
	});
});

describe('css generator', () => {
	it('inherits $type from the group and names properties by path', () => {
		const flat = flatten({
			space: { $type: 'dimension', '2': { $value: { value: 8, unit: 'px' } } }
		});
		expect(flat).toEqual([{ name: '--space-2', path: 'space.2', type: 'dimension', value: '8px' }]);
	});

	it('quotes every family name and leaves only generic families bare', () => {
		expect(cssValue('fontFamily', ['IBM Plex Mono', 'Menlo', 'inherit', 'ui-monospace'], 'f')).toBe(
			'"IBM Plex Mono", "Menlo", "inherit", ui-monospace'
		);
		expect(() => cssValue('fontFamily', ['Bad"Name'], 'f')).toThrow(/quote or backslash/);
	});

	it('accepts "none" channels, mixed-case generic families and $root tokens', () => {
		expect(cssValue('color', { colorSpace: 'srgb', components: ['none', 1, 0] }, 'c')).toBe(
			'#00ff00'
		);
		expect(cssValue('fontFamily', ['Plex', 'MONOSPACE', 'Sans-Serif'], 'f')).toBe(
			'"Plex", monospace, sans-serif'
		);
		const flat = flatten({
			space: {
				$type: 'dimension',
				$root: { $value: { value: 4, unit: 'px' } },
				sm: { $value: { value: 8, unit: 'px' } }
			}
		});
		expect(flat.map((t) => `${t.name}: ${t.value}`)).toEqual(['--space: 4px', '--space-sm: 8px']);
		expect(() => flatten({ $root: { $type: 'number', $value: 1 } })).toThrow(/parent group/);
	});

	it('takes colour from the components and rejects a hex that disagrees', () => {
		const c = (components: number[], hex?: string): { [key: string]: Json } =>
			hex === undefined
				? { colorSpace: 'srgb', components }
				: { colorSpace: 'srgb', components, hex };
		expect(cssValue('color', c([1, 0, 0]), 'c')).toBe('#ff0000');
		expect(cssValue('color', { ...c([0, 0, 0], '#000000'), alpha: 0.5 }, 'c')).toBe(
			'rgb(0 0 0 / 0.5)'
		);
		expect(() => cssValue('color', c([1, 0, 0], '#00ff00'), 'c')).toThrow(
			/does not match components/
		);
		expect(() => cssValue('color', c([1.2, 0, 0]), 'c')).toThrow(/within 0..1/);
	});

	it('rejects values it cannot represent instead of emitting broken CSS', () => {
		expect(() => cssValue('color', '#fff', 'c')).toThrow(/colour \$value must be an object/);
		expect(() =>
			cssValue('color', { colorSpace: 'display-p3', components: [1, 0, 0], hex: '#ff0000' }, 'c')
		).toThrow(/srgb/);
		expect(() => cssValue('dimension', { value: 4, unit: 'em' }, 'd')).toThrow(/px or rem/);
		expect(() => cssValue('cubicBezier', [2, 0, 0, 1], 'e')).toThrow(/within 0..1/);
		expect(() => cssValue('gradient', [], 'g')).toThrow(/unsupported \$type/);
		expect(() => flatten({ a: { $value: 1 } })).toThrow(/no \$type/);
		expect(() => flatten({ $type: 'number', Big: { $value: 1 } })).toThrow(/kebab-case/);
	});
});
