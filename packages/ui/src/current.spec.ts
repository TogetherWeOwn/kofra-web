import { describe, expect, it } from 'vitest';
import { currentState, isCurrent } from './current.js';

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

	it('does not match a sibling that shares a prefix, an absolute URL or a bare fragment', () => {
		expect(isCurrent('/doc', '/docs')).toBe(false);
		expect(isCurrent('https://example.com/docs', '/docs')).toBe(false);
		expect(isCurrent('//example.com/docs', '/docs')).toBe(false);
		expect(isCurrent('web+kofra:/docs', '/docs')).toBe(false);
		expect(isCurrent('#faq', '/')).toBe(false);
	});

	it('resolves relative links against the current page', () => {
		expect(isCurrent('?view=all', '/docs')).toBe(true);
		expect(currentState('?view=all', '/docs')).toBe('page');
		expect(isCurrent('../docs', '/docs/rclone')).toBe(true);
		expect(isCurrent('../pricing', '/docs/rclone')).toBe(false);
		expect(isCurrent('rclone', '/docs/rclone')).toBe(true);
		// On a directory URL a bare name points inside it, as the browser follows it.
		expect(currentState('docs', '/docs/')).toBeUndefined();
		expect(currentState('rclone', '/docs/')).toBeUndefined();
		expect(currentState('rclone', '/docs/rclone')).toBe('page');
	});

	it('stays fast on hostile input with many slashes', () => {
		const slashes = `/docs${'/'.repeat(200_000)}x`;
		const start = performance.now();
		expect(isCurrent('/docs', slashes)).toBe(true);
		expect(isCurrent('/', '/'.repeat(200_000))).toBe(true);
		expect(performance.now() - start).toBeLessThan(250);
	});
});

describe('currentState', () => {
	it('is "page" for the page itself and "true" for a containing section', () => {
		expect(currentState('/docs', '/docs/')).toBe('page');
		expect(currentState('/docs', '/docs/rclone')).toBe('true');
		expect(currentState('/', '/')).toBe('page');
		expect(currentState('/pricing', '/docs')).toBeUndefined();
	});
});
