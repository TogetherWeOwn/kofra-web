import { expect, it } from 'vitest';
import { deviceLabel, eventLabel } from './account-display.js';

it.each([
	[
		'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0',
		'Edge on Windows'
	],
	[
		'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
		'Chrome on Android'
	],
	['Mozilla/5.0 (iPhone; CPU iPhone OS 17) Version/17.0 Mobile Safari/604.1', 'Safari on iOS'],
	['', 'Unknown browser on unknown OS']
])('shortens the user agent %s', (agent, expected) => {
	expect(deviceLabel(agent)).toBe(expected);
});

it('labels known events and gives future event kinds a fallback', () => {
	expect(eventLabel('sign_in')).toBe('Signed in');
	expect(eventLabel('second_step_failed')).toBe('Two-step verification failed');
	expect(eventLabel('recovery_code_used')).toBe('Recovery code used');
	expect(eventLabel('future_event')).toBe('Account activity');
});
