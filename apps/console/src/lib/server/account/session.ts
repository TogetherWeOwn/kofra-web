import type { Cookies } from '@sveltejs/kit';
import type { IssuedSession } from './types.js';

export const SESSION_COOKIE = '__Host-kofra_session';

const options = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' } as const;

export function setSession(cookies: Cookies, session: IssuedSession) {
	cookies.set(SESSION_COOKIE, session.token, { ...options, expires: new Date(session.expires_at) });
}

export function clearSession(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, options);
	return cookies.serialize(SESSION_COOKIE, '', { ...options, maxAge: 0 });
}

export const freshStep = (stepAt: string) => Date.now() - Date.parse(stepAt) <= 600_000;

export const loopback = (url: URL) => ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);

export function nextPath(value: string | null): string {
	if (!value || !value.startsWith('/') || /^\/[/\\]/.test(value) || /[\p{Cc}\\]/u.test(value))
		return '/';
	const path = new URL(value, 'https://console.invalid').pathname;
	return /^\/(?:\/|%2f|%5c)/i.test(path) ? '/' : value;
}
