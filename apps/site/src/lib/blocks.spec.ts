import { describe, expect, it } from 'vitest';
import { cell } from './blocks';

describe('cell', () => {
	it('escapes pipes so they stay inside the cell', () => {
		expect(cell('a | b')).toBe('a \\| b');
	});

	it('escapes backslashes first, so a trailing backslash cannot unescape the pipe', () => {
		expect(cell('a\\|b')).toBe('a\\\\\\|b');
		expect(cell('C:\\dir')).toBe('C:\\\\dir');
	});

	it('turns newlines into spaces', () => {
		expect(cell('one\ntwo')).toBe('one two');
	});
});
