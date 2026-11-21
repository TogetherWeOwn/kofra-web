import { redirect, type RequestEvent } from '@sveltejs/kit';
import { account, field, passwordFields, refused } from '#lib/server/account/actions.js';
import { renderSVG } from 'uqr';
import { deviceLabel } from '#lib/account-display.js';
import { clearSession, freshStep, setSession } from '#lib/server/account/session.js';
import type { AccountClient } from '#lib/server/account/client.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const client = account(event);
	const [sessions, security, passkeys, me] = await Promise.all([
		client.listSessions(),
		client.securityLog(),
		client.listPasskeys(),
		event.request.method === 'POST' ? client.resolve() : event.locals.me!
	]);
	return {
		user: me.user,
		passkeys: passkeys.data,
		defaultPasskeyName: `Passkey on ${deviceLabel(event.request.headers.get('User-Agent') ?? '')}`,
		passwordOptional: me.session.level === 2 && freshStep(me.session.step_at),
		removePasskey: event.url.searchParams.get('removePasskey'),
		sessions: sessions.data,
		security: security.data,
		disable: event.url.searchParams.get('disable') === '1',
		crumbs: [{ label: 'Account' }]
	};
};

function action<T extends Record<string, unknown>>(
	section: string,
	run: (client: AccountClient, form: FormData, event: RequestEvent) => Promise<T>,
	fields?: Record<string, string>
) {
	return async (event: RequestEvent) => {
		const client = account(event);
		const form = await event.request.formData();
		try {
			return { section, ...(await run(client, form, event)) };
		} catch (err) {
			return refused(err, '/account', { section, confirming: section === 'totpConfirm' }, fields);
		}
	};
}

export const actions = {
	profile: action(
		'profile',
		async (client, form) => {
			await client.updateProfile(field(form, 'name').trim());
			return { saved: true };
		},
		{ invalid_request: 'name' }
	),
	email: action(
		'email',
		async (client, form) => {
			const email = field(form, 'email').trim();
			await client.changeEmail(email);
			return { email };
		},
		{ invalid_email: 'email' }
	),
	password: action(
		'password',
		async (client, form, event) => {
			const answer = await client.changePassword(
				form.has('current') ? field(form, 'current') : undefined,
				field(form, 'password')
			);
			setSession(event.cookies, answer.session);
			redirect(303, '/account?password=changed');
		},
		{ ...passwordFields, invalid_credentials: 'current' }
	),
	totpBegin: action('totpBegin', async (client) => {
		const { secret, uri } = await client.totpBegin();
		const qr = renderSVG(uri, { pixelSize: 4, border: 4 }).replace(
			'<svg ',
			'<svg role="img" aria-label="QR code for your authenticator app" '
		);
		return { secret, qr };
	}),
	totpConfirm: action(
		'totpConfirm',
		async (client, form) => {
			const password = field(form, 'password');
			const answer = await client.totpConfirm(field(form, 'code').trim(), password || undefined);
			return { codes: answer.recovery_codes };
		},
		{ code_invalid: 'code', invalid_credentials: 'password' }
	),
	totpDisable: action('totpDisable', async (client) => {
		await client.totpDisable();
		redirect(303, '/account#two-step');
	}),
	recovery: action('recovery', async (client) => {
		const answer = await client.newRecoveryCodes();
		return { codes: answer.recovery_codes };
	}),
	renamePasskey: action('renamePasskey', async (client, form) => {
		await client.renamePasskey(field(form, 'id'), field(form, 'name').trim());
		return { saved: true };
	}),
	removePasskey: action('removePasskey', async (client, form) => {
		await client.removePasskey(field(form, 'id'));
		redirect(303, '/account#passkeys');
	}),
	revoke: action('revoke', async (client, form, event) => {
		const id = field(form, 'id');
		await client.revokeSession(id);
		if (id === event.locals.me?.session.id) {
			clearSession(event.cookies);
			redirect(303, '/sign-in');
		}
		return { revoked: true };
	}),
	revokeOthers: action('revokeOthers', async (client) => {
		await client.revokeOtherSessions();
		return { revoked: true };
	})
} satisfies Actions;
