import { describe, expect, it } from 'vitest';
import { isCurrent } from './current.js';

describe('isCurrent', () => {
	it('matches the home link only on the home page', () => {
		expect(isCurrent('/', '/')).toBe(true);
		expect(isCurrent('/', '/pricing')).toBe(false);
	});

	it('matches a section and the pages inside it, ignoring trailing slashes, queries and fragments', () => {
		expect(isCurrent('/docs', '/docs')).toBe(true);
		expect(isCurrent('/docs', '/docs/')).toBe(true);
		expect(isCurrent('/docs/', '/docs/rclone?x=1#setup')).toBe(true);
		expect(isCurrent('/pricing#faq', '/pricing')).toBe(true);
	});

	it('does not match a sibling that shares a prefix, an external URL or a bare fragment', () => {
		expect(isCurrent('/doc', '/docs')).toBe(false);
		expect(isCurrent('https://example.com/docs', '/docs')).toBe(false);
		expect(isCurrent('#faq', '/')).toBe(false);
	});
});
