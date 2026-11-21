const browsers: [RegExp, string][] = [
	[/Edg(?:A|iOS)?\//, 'Edge'],
	[/OPR\//, 'Opera'],
	[/Firefox\/|FxiOS\//, 'Firefox'],
	[/Chrome\/|CriOS\//, 'Chrome'],
	[/Safari\//, 'Safari']
];

const systems: [RegExp, string][] = [
	[/Android/, 'Android'],
	[/iPhone|iPad|iPod/, 'iOS'],
	[/Windows/, 'Windows'],
	[/CrOS/, 'ChromeOS'],
	[/Macintosh|Mac OS/, 'macOS'],
	[/Linux/, 'Linux']
];

export function deviceLabel(agent: string): string {
	const browser = browsers.find(([pattern]) => pattern.test(agent))?.[1];
	const os = systems.find(([pattern]) => pattern.test(agent))?.[1];
	return `${browser ?? 'Unknown browser'} on ${os ?? 'unknown OS'}`;
}

const labels = new Map([
	['sign_in', 'Signed in'],
	['sign_in_failed', 'Sign-in failed'],
	['second_step_failed', 'Two-step verification failed'],
	['throttled', 'Too many attempts'],
	['password_changed', 'Password changed'],
	['password_reset', 'Password reset'],
	['email_change_requested', 'Email change requested'],
	['email_changed', 'Email address changed'],
	['totp_enabled', 'Two-step verification turned on'],
	['totp_disabled', 'Two-step verification turned off'],
	['recovery_codes_created', 'Recovery codes created'],
	['recovery_code_used', 'Recovery code used'],
	['sessions_revoked', 'Devices signed out'],
	['signed_out', 'Signed out'],
	['email_verified', 'Email address confirmed']
]);

export const eventLabel = (kind: string) => labels.get(kind) ?? 'Account activity';
