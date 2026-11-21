import type { RequestEvent } from '@sveltejs/kit';
import { expect, it, vi } from 'vitest';
import { AccountClient } from './client.js';
import { createFakeAccount } from './fake.js';

const password = 'correct horse battery staple';
const event = {
	request: new Request('http://localhost/sign-in', {
		headers: { 'CF-Connecting-IP': '192.0.2.1', 'User-Agent': 'Browser'.repeat(60) }
	}),
	platform: { cf: { country: 'GB' } },
	getClientAddress: () => {
		throw new Error('The connecting IP header should take priority.');
	}
} as unknown as RequestEvent;

function setup() {
	const upstream = createFakeAccount();
	return {
		client: (token?: string) => new AccountClient(upstream, event, token),
		async token(email: string) {
			const answer = await upstream.fetch(
				new Request(`https://account.internal/__fake/last-token?email=${encodeURIComponent(email)}`)
			);
			expect(answer.status).toBe(200);
			return ((await answer.json()) as { token: string }).token;
		}
	};
}

it('uses an invite once, verifies on a single-use link and provisions a workspace', async () => {
	const { client, token } = setup();
	const guest = client();
	const email = 'new@example.com';
	const input = { invite: 'inv-e2e', email, password, name: 'New Customer' };
	await expect(guest.signup({ ...input, invite: 'bad' })).rejects.toMatchObject({
		status: 403,
		code: 'invite_invalid'
	});
	await expect(guest.signup({ ...input, password: 'short' })).rejects.toMatchObject({
		status: 422,
		code: 'weak_password'
	});
	await expect(guest.signup(input)).resolves.toEqual({ state: 'verify_email' });
	await expect(guest.signup(input)).rejects.toMatchObject({ status: 403, code: 'invite_invalid' });
	const signed = await guest.loginPassword(email, password);
	await expect(client(signed.session.token).resolve()).resolves.toMatchObject({
		needs: 'verify_email'
	});
	await expect(client(signed.session.token).createWorkspace('Test')).rejects.toMatchObject({
		code: 'email_unverified'
	});
	const link = await token(email);
	await expect(guest.verifyEmail(link)).rejects.toMatchObject({ code: 'invalid_credentials' });
	await expect(guest.verifyEmail(link, 'wrong')).rejects.toMatchObject({
		code: 'invalid_credentials'
	});
	await expect(guest.verifyEmail(link, password)).resolves.toEqual({
		state: 'verified',
		what: 'address'
	});
	await expect(client(signed.session.token).resolve()).rejects.toMatchObject({
		code: 'session_invalid'
	});
	await expect(guest.verifyEmail(link)).rejects.toMatchObject({
		status: 400,
		code: 'token_invalid'
	});
	const account = client((await guest.loginPassword(email, password)).session.token);
	await expect(account.resolve()).resolves.toMatchObject({ needs: 'workspace' });
	await expect(account.createWorkspace('Test')).resolves.toMatchObject({
		state: 'active',
		name: 'Test'
	});
	await expect(account.resolve()).resolves.toMatchObject({ needs: null });
});

it('enforces session stages and rotates the token after the second step', async () => {
	const { client } = setup();
	const start = await client().loginPassword('mfa@example.com', password);
	expect(start.state).toBe('second_step');
	const pending = client(start.session.token);
	await expect(pending.resolve()).resolves.toMatchObject({ needs: 'second_step' });
	await expect(pending.listSessions()).rejects.toMatchObject({
		status: 401,
		code: 'session_invalid'
	});
	await expect(pending.loginTotp('000000')).rejects.toMatchObject({
		status: 401,
		code: 'code_invalid'
	});
	const complete = await pending.loginTotp('123456');
	expect(complete.session.token).not.toBe(start.session.token);
	await expect(pending.resolve()).rejects.toMatchObject({ code: 'session_invalid' });
	const active = client(complete.session.token);
	const resolved = await active.resolve();
	expect(resolved.session.level).toBe(2);
	const { data } = await active.listSessions();
	expect(data[0]).toMatchObject({ id: resolved.session.id, current: true, country: 'GB' });
	expect(data[0]?.user_agent).toHaveLength(256);
	await active.logout();
	await expect(active.resolve()).rejects.toMatchObject({ code: 'session_invalid' });
});

it('keeps reset and resend answers safe and invalidates sessions on reset', async () => {
	const { client, token } = setup();
	const guest = client();
	const email = 'owner@example.com';
	const old = client((await guest.loginPassword(email, password)).session.token);
	await expect(guest.resendVerification('absent@example.com')).resolves.toEqual({});
	await expect(guest.forgotPassword('absent@example.com')).resolves.toEqual({});
	await expect(guest.forgotPassword(email)).resolves.toEqual({});
	const link = await token(email);
	await expect(guest.checkReset(link)).resolves.toEqual({ second_factor: false });
	await expect(guest.resetPassword(link, 'password123456')).rejects.toMatchObject({
		code: 'breached_password'
	});
	await guest.resetPassword(link, 'replacement test password');
	await expect(old.resolve()).rejects.toMatchObject({ code: 'session_invalid' });
	await expect(guest.checkReset(link)).rejects.toMatchObject({ code: 'token_invalid' });
	await expect(guest.loginPassword(email, 'replacement test password')).resolves.toMatchObject({
		state: 'signed_in'
	});
});

it('requires a recent step for sensitive actions and issues ten recovery codes on setup', async () => {
	vi.useFakeTimers();
	try {
		const { client } = setup();
		const issued = await client().loginPassword('owner@example.com', password);
		const active = client(issued.session.token);
		vi.setSystemTime(Date.now() + 601_000);
		await expect(active.totpBegin()).rejects.toMatchObject({ status: 403, code: 'step_required' });
		await active.reauth(password);
		await expect(active.totpBegin()).resolves.toMatchObject({
			secret: expect.any(String),
			uri: expect.stringMatching(/^otpauth:\/\/totp\//)
		});
		const answer = await active.totpConfirm('123456', password);
		expect(answer.recovery_codes).toHaveLength(10);
		const next = client(
			(await client().loginPassword('owner@example.com', password)).session.token
		);
		await next.loginRecovery(answer.recovery_codes![0]!);
		await expect(active.resolve()).resolves.toMatchObject({ user: { recovery_codes_left: 9 } });
	} finally {
		vi.useRealTimers();
	}
});

it('confirms an address change without a password, revokes sessions and voids other links', async () => {
	const { client, token } = setup();
	const guest = client();
	const email = 'owner@example.com';
	const first = client((await guest.loginPassword(email, password)).session.token);
	const second = client((await guest.loginPassword(email, password)).session.token);
	await first.changeEmail('next@example.com');
	await second.changeEmail('other@example.com');
	await expect(guest.verifyEmail(await token('next@example.com'))).resolves.toEqual({
		state: 'verified',
		what: 'email_changed'
	});
	await expect(guest.verifyEmail(await token('other@example.com'))).rejects.toMatchObject({
		code: 'token_invalid'
	});
	for (const device of [first, second]) {
		await expect(device.resolve()).rejects.toMatchObject({ code: 'session_invalid' });
	}
	await expect(guest.loginPassword('next@example.com', password)).resolves.toMatchObject({
		state: 'signed_in'
	});
});

it('registers, renames, uses and removes a passkey across session stages', async () => {
	const { client } = setup();
	const guest = client();
	const email = 'owner@example.com';
	const active = client((await guest.loginPassword(email, password)).session.token);
	const { challenge_id, options } = await active.passkeyRegisterBegin();
	expect(options).toMatchObject({
		rp: { id: 'localhost' },
		authenticatorSelection: { residentKey: 'required', userVerification: 'required' }
	});
	const common = { id: 'dGVzdA', rawId: 'dGVzdA', type: 'public-key', clientExtensionResults: {} };
	const registration = {
		challenge_id,
		name: 'Test device',
		credential: {
			...common,
			response: {
				clientDataJSON: 'dGVzdA',
				attestationObject: 'dGVzdA',
				authenticatorData: 'dGVzdA',
				publicKeyAlgorithm: -7,
				transports: ['internal']
			}
		}
	};
	await expect(active.passkeyRegisterFinish(registration)).rejects.toMatchObject({
		code: 'invalid_credentials'
	});
	const { passkey, recovery_codes } = await active.passkeyRegisterFinish({
		...registration,
		password
	});
	expect(recovery_codes).toHaveLength(10);
	await expect(active.passkeyRegisterFinish(registration)).rejects.toMatchObject({
		code: 'step_required'
	});
	await expect(active.renamePasskey(passkey.id, 'Laptop')).resolves.toMatchObject({
		name: 'Laptop'
	});

	const assertion = {
		...common,
		response: {
			clientDataJSON: 'dGVzdA',
			authenticatorData: 'dGVzdA',
			signature: 'dGVzdA',
			userHandle: 'dGVzdA'
		}
	};
	const pending = await guest.loginPassword(email, password);
	expect(pending.state).toBe('second_step');
	const secondStep = client(pending.session.token);
	await expect(secondStep.resolve()).resolves.toMatchObject({ workspaces: [] });
	const challenge = await secondStep.passkeyLoginBegin();
	expect(challenge.options.allowCredentials).toEqual([{ id: common.id, type: 'public-key' }]);
	await expect(
		guest.passkeyLoginFinish({ challenge_id: challenge.challenge_id, credential: assertion })
	).rejects.toMatchObject({ code: 'passkey_invalid' });
	const second = await secondStep.passkeyLoginFinish({
		challenge_id: challenge.challenge_id,
		credential: assertion
	});
	await expect(secondStep.resolve()).rejects.toMatchObject({ code: 'session_invalid' });

	const login = await guest.passkeyLoginBegin();
	const input = { challenge_id: login.challenge_id, credential: assertion };
	const signed = await guest.passkeyLoginFinish(input);
	await expect(guest.passkeyLoginFinish(input)).rejects.toMatchObject({ code: 'passkey_invalid' });
	const verified = client(signed.session.token);
	await expect(verified.resolve()).resolves.toMatchObject({
		session: { level: 2 },
		user: { passkeys: 1 }
	});
	await expect(verified.listPasskeys()).resolves.toMatchObject({
		data: [{ name: 'Laptop', last_used_at: expect.any(String) }]
	});

	const reauth = await active.passkeyReauthBegin();
	await active.passkeyReauthFinish({ challenge_id: reauth.challenge_id, credential: assertion });
	await expect(active.resolve()).resolves.toMatchObject({ session: { level: 2 } });
	await active.removePasskey(passkey.id);
	await expect(verified.resolve()).rejects.toMatchObject({ code: 'session_invalid' });
	await expect(client(second.session.token).resolve()).rejects.toMatchObject({
		code: 'session_invalid'
	});
	await expect(active.resolve()).resolves.toMatchObject({
		user: { passkeys: 0, recovery_codes_left: 0 }
	});
	await expect(
		active.changePassword(undefined, 'replacement test password')
	).resolves.toMatchObject({ state: 'signed_in' });
});

it('expires passkey challenges after five minutes', async () => {
	vi.useFakeTimers();
	try {
		const { client } = setup();
		const guest = client();
		const { challenge_id } = await guest.passkeyLoginBegin();
		vi.setSystemTime(Date.now() + 300_001);
		await expect(
			guest.passkeyLoginFinish({
				challenge_id,
				credential: {
					id: 'dGVzdA',
					rawId: 'dGVzdA',
					type: 'public-key',
					clientExtensionResults: {},
					response: {
						clientDataJSON: 'dGVzdA',
						authenticatorData: 'dGVzdA',
						signature: 'dGVzdA',
						userHandle: 'dGVzdA'
					}
				}
			})
		).rejects.toMatchObject({ status: 401, code: 'passkey_invalid' });
	} finally {
		vi.useRealTimers();
	}
});
