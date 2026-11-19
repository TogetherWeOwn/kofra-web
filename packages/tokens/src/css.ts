// Turns the DTCG token tree (tokens.json) into CSS custom properties.
//
// Every token becomes `--<path joined by ->`, for example `color.ink` ->
// `--color-ink` and `font.size.base` -> `--font-size-base`. Light values are
// the defaults on :root. Colour tokens with a dark value in
// $extensions["app.kofra.modes"].dark are emitted twice more: under
// `prefers-color-scheme: dark` (unless the page pinned light) and under
// `[data-theme='dark']` (the saved choice of the theme toggle).

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

export interface FlatToken {
	/** CSS custom property name, including the leading `--`. */
	name: string;
	/** Dot path in tokens.json. */
	path: string;
	type: string;
	value: string;
	dark?: string;
}

const MODES_KEY = 'app.kofra.modes';
const GENERIC_FAMILIES = new Set([
	'serif',
	'sans-serif',
	'monospace',
	'cursive',
	'fantasy',
	'system-ui',
	'ui-serif',
	'ui-sans-serif',
	'ui-monospace',
	'ui-rounded',
	'math',
	'emoji'
]);

const isObj = (v: Json | undefined): v is Obj =>
	typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(path: string, msg: string): never {
	throw new Error(`token ${path || '(root)'}: ${msg}`);
}

function num(v: Json | undefined, path: string): number {
	if (typeof v !== 'number' || !Number.isFinite(v))
		fail(path, `expected a number, got ${JSON.stringify(v)}`);
	return v;
}

/** Formats a number without float noise: 0.1 + 0.2 never shows up as 0.30000000000000004. */
const fmt = (n: number) => String(+n.toFixed(4));

function color(v: Json | undefined, path: string): string {
	if (!isObj(v)) fail(path, 'colour $value must be an object with colorSpace and components');
	if (v.colorSpace !== 'srgb')
		fail(path, `only the srgb colour space is supported, got ${String(v.colorSpace)}`);
	// DTCG 2025.10: components are authoritative; hex is an optional fallback that must agree.
	const comps = v.components;
	if (!Array.isArray(comps) || comps.length !== 3)
		fail(path, 'srgb components must be three numbers');
	const rgb = comps.map((c) => {
		const n = num(c, path);
		if (n < 0 || n > 1) fail(path, 'srgb components must be within 0..1');
		return Math.round(n * 255);
	});
	const hex = '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
	if (v.hex !== undefined && v.hex !== hex)
		fail(path, `hex ${String(v.hex)} does not match components (${hex})`);
	const alpha = v.alpha === undefined ? 1 : num(v.alpha, path);
	if (alpha < 0 || alpha > 1) fail(path, 'alpha must be between 0 and 1');
	if (alpha === 1) return hex;
	return `rgb(${rgb.join(' ')} / ${fmt(alpha)})`;
}

function dimension(v: Json | undefined, path: string): string {
	if (!isObj(v)) fail(path, 'dimension $value must be { value, unit }');
	const unit = v.unit;
	if (unit !== 'px' && unit !== 'rem')
		fail(path, `dimension unit must be px or rem, got ${String(unit)}`);
	const n = num(v.value, path);
	return n === 0 ? '0' : `${fmt(n)}${unit}`;
}

function fontFamily(v: Json | undefined, path: string): string {
	const list = typeof v === 'string' ? [v] : v;
	if (!Array.isArray(list) || list.length === 0)
		fail(path, 'fontFamily must be a string or a non-empty array');
	return list
		.map((f) => {
			if (typeof f !== 'string' || f === '')
				fail(path, 'font family names must be non-empty strings');
			if (/["\\]/.test(f))
				fail(path, `font family ${JSON.stringify(f)} contains a quote or backslash`);
			// Generic families are keywords; every other name is quoted, so a family called
			// "inherit" or "Menlo" can never be read as a CSS keyword.
			return GENERIC_FAMILIES.has(f) ? f : `"${f}"`;
		})
		.join(', ');
}

function shadow(v: Json | undefined, path: string): string {
	const layers = Array.isArray(v) ? v : [v];
	return layers
		.map((layer, i) => {
			if (!isObj(layer)) fail(`${path}[${i}]`, 'shadow layer must be an object');
			const parts = [layer.offsetX, layer.offsetY, layer.blur, layer.spread].map((d) =>
				dimension(d, `${path}[${i}]`)
			);
			const inset = layer.inset === true ? 'inset ' : '';
			return `${inset}${parts.join(' ')} ${color(layer.color, `${path}[${i}]`)}`;
		})
		.join(', ');
}

function duration(v: Json | undefined, path: string): string {
	if (!isObj(v) || (v.unit !== 'ms' && v.unit !== 's'))
		fail(path, 'duration must be { value, unit: ms | s }');
	return `${fmt(num(v.value, path))}${v.unit}`;
}

function cubicBezier(v: Json | undefined, path: string): string {
	if (!Array.isArray(v) || v.length !== 4)
		fail(path, 'cubicBezier must be an array of four numbers');
	const [x1, y1, x2, y2] = v.map((n) => num(n, path)) as [number, number, number, number];
	if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) fail(path, 'cubicBezier x values must be within 0..1');
	return `cubic-bezier(${[x1, y1, x2, y2].map(fmt).join(', ')})`;
}

/** Converts one DTCG $value of the given $type to a CSS value. */
export function cssValue(type: string, v: Json | undefined, path: string): string {
	switch (type) {
		case 'color':
			return color(v, path);
		case 'dimension':
			return dimension(v, path);
		case 'fontFamily':
			return fontFamily(v, path);
		case 'fontWeight':
		case 'number':
			return fmt(num(v, path));
		case 'shadow':
			return shadow(v, path);
		case 'duration':
			return duration(v, path);
		case 'cubicBezier':
			return cubicBezier(v, path);
		default:
			return fail(path, `unsupported $type ${JSON.stringify(type)}`);
	}
}

/** Flattens the token tree in document order. Group $type values are inherited (DTCG §6.4). */
export function flatten(tree: Json): FlatToken[] {
	const out: FlatToken[] = [];
	const walk = (node: Json, path: string[], inherited: string | undefined) => {
		const p = path.join('.');
		if (!isObj(node)) fail(p, 'every group and token must be an object');
		const type = typeof node.$type === 'string' ? node.$type : inherited;
		if ('$value' in node) {
			if (!type) fail(p, 'no $type on the token or any parent group');
			if (path.some((seg) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(seg))) {
				fail(p, 'path segments must be lower-case kebab-case');
			}
			const token: FlatToken = {
				name: `--${path.join('-')}`,
				path: p,
				type,
				value: cssValue(type, node.$value, p)
			};
			const ext = node.$extensions;
			const modes = isObj(ext) ? ext[MODES_KEY] : undefined;
			if (isObj(modes) && modes.dark !== undefined)
				token.dark = cssValue(type, modes.dark, `${p} (dark)`);
			out.push(token);
			return;
		}
		for (const [key, child] of Object.entries(node)) {
			if (!key.startsWith('$')) walk(child, [...path, key], type);
		}
	};
	walk(tree, [], undefined);
	const seen = new Set<string>();
	for (const t of out) {
		if (seen.has(t.name)) fail(t.path, `duplicate custom property ${t.name}`);
		seen.add(t.name);
	}
	return out;
}

const block = (selector: string, decls: string[]) =>
	`${selector} {\n${decls.map((d) => `\t${d}\n`).join('')}}\n`;

/** The complete tokens.css text for a token tree. */
export function toCss(tree: Json): string {
	const tokens = flatten(tree);
	const light = tokens.map((t) => `${t.name}: ${t.value};`);
	const dark = tokens.filter((t) => t.dark !== undefined).map((t) => `${t.name}: ${t.dark};`);
	return [
		'/* Generated from tokens.json by @kofra/tokens (pnpm --filter @kofra/tokens run build). Do not edit. */\n',
		block(':root', ['color-scheme: light;', ...light]),
		'@media (prefers-color-scheme: dark) {\n' +
			block(":root:not([data-theme='light'])", ['color-scheme: dark;', ...dark])
				.split('\n')
				.map((l) => (l ? `\t${l}` : l))
				.join('\n') +
			'}\n',
		block(":root[data-theme='dark']", ['color-scheme: dark;', ...dark])
	].join('\n');
}
