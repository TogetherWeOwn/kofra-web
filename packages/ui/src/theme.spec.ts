import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('./theme.js', import.meta.url), 'utf8');

/** Loads a page with two toggle buttons, runs theme.js the way <head> would, and returns the window. */
function load({ saved, systemDark = false }: { saved?: string; systemDark?: boolean } = {}) {
	const dom = new JSDOM(
		'<!doctype html><html lang="en"><head></head><body>' +
			'<button type="button" data-theme-toggle aria-pressed="false">Dark theme</button>' +
			'<button type="button" data-theme-toggle aria-pressed="false">Dark theme</button>' +
			'</body></html>',
		{ runScripts: 'outside-only', url: 'https://kofra.test/' }
	);
	const win = dom.window as unknown as Window & typeof globalThis & { eval(src: string): void };
	const listeners: ((e: { matches: boolean }) => void)[] = [];
	const media = {
		matches: systemDark,
		addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn)
	};
	Object.defineProperty(win, 'matchMedia', { value: () => media });
	if (saved !== undefined) win.localStorage.setItem('kofra-theme', saved);
	win.eval(script);
	win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
	const root = win.document.documentElement;
	const pressed = () =>
		[...win.document.querySelectorAll('[data-theme-toggle]')].map((b) =>
			b.getAttribute('aria-pressed')
		);
	const click = () =>
		(win.document.querySelector('[data-theme-toggle]') as HTMLButtonElement).click();
	const systemChange = (dark: boolean) => {
		media.matches = dark;
		listeners.forEach((fn) => fn({ matches: dark }));
	};
	return { win, root, pressed, click, systemChange };
}

describe('theme.js', () => {
	it('follows the system setting when nothing is saved, and marks the page as scripted', () => {
		expect(load().root.getAttribute('data-theme')).toBe('light');
		const dark = load({ systemDark: true });
		expect(dark.root.getAttribute('data-theme')).toBe('dark');
		expect(dark.root.classList.contains('js')).toBe(true);
		expect(dark.pressed()).toEqual(['true', 'true']);
	});

	it('prefers a saved choice over the system setting and ignores junk values', () => {
		expect(load({ saved: 'light', systemDark: true }).root.getAttribute('data-theme')).toBe(
			'light'
		);
		expect(load({ saved: 'purple', systemDark: true }).root.getAttribute('data-theme')).toBe(
			'dark'
		);
	});

	it('toggles, saves the choice and updates every toggle button', () => {
		const t = load();
		t.click();
		expect(t.root.getAttribute('data-theme')).toBe('dark');
		expect(t.win.localStorage.getItem('kofra-theme')).toBe('dark');
		expect(t.pressed()).toEqual(['true', 'true']);
		t.click();
		expect(t.root.getAttribute('data-theme')).toBe('light');
		expect(t.pressed()).toEqual(['false', 'false']);
	});

	it('tracks system changes until the visitor chooses, then keeps their choice', () => {
		const t = load();
		t.systemChange(true);
		expect(t.root.getAttribute('data-theme')).toBe('dark');
		t.click(); // choose light explicitly
		t.systemChange(true);
		expect(t.root.getAttribute('data-theme')).toBe('light');
	});

	it('still works when storage is blocked', () => {
		const t = load();
		Object.defineProperty(t.win, 'localStorage', {
			get() {
				throw new Error('blocked');
			}
		});
		t.click();
		expect(t.root.getAttribute('data-theme')).toBe('dark');
	});
});
