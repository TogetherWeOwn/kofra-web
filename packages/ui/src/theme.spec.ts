import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const script = readFileSync(new URL('./theme.js', import.meta.url), 'utf8');

type Win = Window & typeof globalThis & { eval(src: string): void };

/**
 * Runs theme.js the way a page does: in <head>, before the body (and its toggle buttons)
 * exists. Then adds two toggles and fires DOMContentLoaded, as the parser would.
 */
function load({
	saved,
	systemDark = false,
	storageBlocked = false
}: { saved?: string; systemDark?: boolean; storageBlocked?: boolean } = {}) {
	const dom = new JSDOM('<!doctype html><html lang="en"><head></head><body></body></html>', {
		runScripts: 'outside-only',
		url: 'https://kofra.test/'
	});
	const win = dom.window as unknown as Win;
	const listeners: ((e: { matches: boolean }) => void)[] = [];
	const media = {
		matches: systemDark,
		addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn)
	};
	Object.defineProperty(win, 'matchMedia', { value: () => media });
	if (saved !== undefined) win.localStorage.setItem('kofra-theme', saved);
	if (storageBlocked) blockStorage(win);
	win.eval(script);
	const root = win.document.documentElement;
	const themeAtHead = root.getAttribute('data-theme');
	for (let i = 0; i < 2; i++) {
		const b = win.document.createElement('button');
		b.type = 'button';
		b.setAttribute('data-theme-toggle', '');
		b.setAttribute('aria-pressed', 'false');
		b.textContent = 'Dark theme';
		win.document.body.append(b);
	}
	win.document.dispatchEvent(new win.Event('DOMContentLoaded'));
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
	return { win, root, themeAtHead, pressed, click, systemChange };
}

function blockStorage(win: Win) {
	Object.defineProperty(win, 'localStorage', {
		configurable: true,
		get() {
			throw new Error('blocked');
		}
	});
}

describe('theme.js', () => {
	it('sets the theme in <head>, before the body exists, from the system setting', () => {
		const light = load();
		expect(light.themeAtHead).toBe('light');
		const dark = load({ systemDark: true });
		expect(dark.themeAtHead).toBe('dark');
		expect(dark.root.classList.contains('js')).toBe(true);
	});

	it('syncs aria-pressed on toggles that appear after it ran (DOMContentLoaded)', () => {
		expect(load({ systemDark: true }).pressed()).toEqual(['true', 'true']);
		expect(load().pressed()).toEqual(['false', 'false']);
	});

	it('prefers a saved choice over the system setting and ignores junk values', () => {
		expect(load({ saved: 'light', systemDark: true }).themeAtHead).toBe('light');
		expect(load({ saved: 'purple', systemDark: true }).themeAtHead).toBe('dark');
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

	it('follows a choice made in another tab', () => {
		const t = load();
		t.win.localStorage.setItem('kofra-theme', 'dark');
		t.win.dispatchEvent(new t.win.StorageEvent('storage', { key: 'kofra-theme' }));
		expect(t.root.getAttribute('data-theme')).toBe('dark');
		expect(t.pressed()).toEqual(['true', 'true']);
	});

	it('works when storage is blocked from the start: follows the system, and toggling still works', () => {
		const t = load({ systemDark: true, storageBlocked: true });
		expect(t.themeAtHead).toBe('dark');
		t.click();
		expect(t.root.getAttribute('data-theme')).toBe('light');
		expect(t.pressed()).toEqual(['false', 'false']);
		// The choice holds for the life of the page even though it could not be saved.
		t.systemChange(false);
		t.systemChange(true);
		expect(t.root.getAttribute('data-theme')).toBe('light');
	});
});
