import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { AccountProblem } from './client.js';
import { freshStep, nextPath } from './session.js';

export function account(event: RequestEvent) {
	if (!event.locals.account) error(404, { message: 'This page is unavailable in the demo.' });
	return event.locals.account;
}

export const field = (form: FormData, name: string) => {
	const value = form.get(name);
	return typeof value === 'string' ? value : '';
};

export function requireIdentity(path: string): never {
	redirect(303, `/confirm-identity?next=${encodeURIComponent(nextPath(path))}`);
}

/**
 * Sensitive actions (a key that can write, an API token, deleting the workspace) need a
 * sign-in step in the last 10 minutes, and one that used the second factor when the user
 * has one. Demo mode has no sessions and passes.
 */
export function hasFreshStep(locals: App.Locals) {
	const me = locals.me;
	if (!me) return true;
	const hasFactor = me.user.totp || me.user.passkeys > 0;
	return freshStep(me.session.step_at) && (!hasFactor || me.session.level === 2);
}

export function requireFreshStep(locals: App.Locals, path: string) {
	if (!hasFreshStep(locals)) requireIdentity(path);
}

function retryMinutes(value: string | null) {
	const seconds =
		value && /^\d+$/.test(value)
			? Number(value)
			: value
				? (Date.parse(value) - Date.now()) / 1000
				: 60;
	return Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds / 60)) : 1;
}

const messages: Record<string, string> = {
	invalid_credentials: 'That email and password do not match.',
	passkey_invalid: 'That passkey did not work. Try again.',
	code_invalid: 'That code did not work. Try again.',
	token_invalid: 'This link has expired or was already used.',
	invite_invalid: 'Kofra is invite-only for now. Ask the person who invited you for a new link.',
	signup_closed: 'Kofra is invite-only for now. Ask the person who invited you for a new link.',
	invalid_email: 'Enter a valid email address.',
	breached_password: 'Choose a password that has not appeared in a data breach.',
	service_unavailable: 'Try again in a minute.',
	session_invalid: 'Your session ended. Sign in again.',
	already_enabled: 'An authenticator app is already set up.',
	workspace_limit_reached: 'You already have a workspace.',
	not_found: 'That item is no longer available.'
};

export function refused<T extends Record<string, unknown>>(
	err: unknown,
	path: string,
	extra: T,
	fields: Record<string, string> = {}
) {
	if (!(err instanceof AccountProblem)) throw err;
	if (err.code === 'step_required') requireIdentity(path);
	const message =
		err.code === 'rate_limited'
			? `Too many attempts. Try again in ${retryMinutes(err.retryAfter)} minutes.`
			: err.code === 'weak_password'
				? err.detail
				: (messages[err.code] ?? 'Try again.');
	return fail(err.status, {
		...extra,
		field: fields[err.code],
		problem: { message, code: err.code }
	});
}

export const passwordFields = { weak_password: 'password', breached_password: 'password' };
