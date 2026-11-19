import { describe, expect, it } from 'vitest';
import { cell } from './blocks';

describe('cell', () => {
	it('escapes pipes so they stay inside the cell', () => {
		expect(cell('a | b')).toBe('a \\| b');
	});

	it('escapes backslashes before a pipe, so they cannot unescape it', () => {
		expect(cell('a\\|b')).toBe('a\\\\\\|b');
	});

	it('leaves other backslashes alone, since they are literal inside code spans', () => {
		expect(cell('`C:\\dir`')).toBe('`C:\\dir`');
	});

	it('turns newlines into spaces', () => {
		expect(cell('one\ntwo')).toBe('one two');
	});
});
