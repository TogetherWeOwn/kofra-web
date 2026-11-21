import { freshStep } from './session.js';
import type {
	Passkey,
	Resolved,
	SecurityEvent,
	SessionInfo,
	SessionRow,
	Upstream,
	User,
	WorkspaceSummary
} from './types.js';

const now = () => new Date().toISOString();
const expires = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const id = (prefix: string) => prefix + crypto.randomUUID().replaceAll('-', '').slice(0, 26);
const seedPassword = 'correct horse battery staple';
// This fixed code is only for the loopback fake. It does not implement real TOTP.
const fakeCode = '123456';

interface Person {
	user: User;
	password: string;
	workspaces: WorkspaceSummary[];
	codes: string[];
	passkeys: (Passkey & { credentialId: string })[];
	events: SecurityEvent[];
	pendingTotp?: string;
}

interface Session {
	person: Person;
	info: SessionInfo;
	device: Omit<SessionRow, 'id' | 'current'>;
	csrf: string;
}

interface Mail {
	person: Person;
	kind: 'verify' | 'reset' | 'change';
	email: string;
	expires: string;
}

const statuses = {
	invalid_request: 400,
	invalid_email: 422,
	weak_password: 422,
	breached_password: 422,
	invalid_credentials: 401,
	code_invalid: 401,
	passkey_invalid: 401,
	session_invalid: 401,
	step_required: 403,
	invite_invalid: 403,
	token_invalid: 400,
	email_unverified: 403,
	already_enabled: 409,
	not_found: 404,
	workspace_limit_reached: 409
} as const;

class Refused extends Error {
	constructor(
		readonly code: keyof typeof statuses,
		detail = code as string
	) {
		super(detail);
	}
}

const refuse = (code: keyof typeof statuses, detail?: string): never => {
	throw new Refused(code, detail);
};
const json = (data: unknown = {}, status = 200) => Response.json(data, { status });
const empty = () => new Response(null, { status: 204 });

export function createFakeAccount(): Upstream {
	const people = new Map<string, Person>();
	const sessions = new Map<string, Session>();
	const links = new Map<string, Mail>();
	const last = new Map<string, string>();
	const challenges = new Map<string, { flow: string; session?: Session; expires: number }>();
	let inviteUsed = false;

	function add(email: string, name: string, password: string, verified = false, totp = false) {
		const person: Person = {
			user: {
				id: id('usr_'),
				name,
				email,
				email_verified: verified,
				totp,
				passkeys: 0,
				recovery_codes_left: 0,
				created_at: now()
			},
			password,
			codes: [],
			passkeys: [],
			events: [],
			workspaces: verified
				? [{ id: id('ws_'), name: `${name}'s workspace`, role: 'owner', state: 'active' }]
				: []
		};
		if (totp) recovery(person);
		people.set(email, person);
		return person;
	}

	function recovery(person: Person) {
		person.codes = Array.from({ length: 10 }, () => id('').slice(0, 12));
		person.user.recovery_codes_left = person.codes.length;
		return person.codes;
	}

	function mail(person: Person, kind: Mail['kind'], email = person.user.email) {
		const previous = last.get(email);
		if (previous && links.get(previous)?.kind === kind) links.delete(previous);
		const token = id('link_');
		links.set(token, { person, kind, email, expires: expires(kind === 'reset' ? 30 : 60) });
		last.set(email, token);
	}

	function endSessions(person: Person) {
		for (const [token, session] of sessions) if (session.person === person) sessions.delete(token);
	}

	function voidLinks(person: Person, confirmationsOnly = false) {
		for (const [token, link] of links) {
			if (link.person === person && (!confirmationsOnly || link.kind !== 'reset'))
				links.delete(token);
		}
	}

	const hasFactor = (person: Person) => person.user.totp || person.passkeys.length > 0;

	function removeRecoveryIfNeeded(person: Person, current: string) {
		if (hasFactor(person)) return;
		person.codes = [];
		person.user.recovery_codes_left = 0;
		for (const [token, session] of sessions) {
			if (session.person === person && token !== current) sessions.delete(token);
		}
	}

	function codeMatches(person: Person, code: string, method?: 'totp' | 'recovery') {
		if (method !== 'recovery' && person.user.totp && code === fakeCode) return true;
		const index = method === 'totp' ? -1 : person.codes.indexOf(code);
		if (index < 0) return false;
		person.codes.splice(index, 1);
		person.user.recovery_codes_left = person.codes.length;
		return true;
	}

	function checkPassword(password: string) {
		if (password.length < 12) refuse('weak_password', 'Use at least 12 characters.');
		if (password === 'password123456')
			refuse('breached_password', 'Choose a password that has not appeared in a data breach.');
	}

	add('owner@example.com', 'Owner', seedPassword, true);
	add('mfa@example.com', 'MFA', seedPassword, true, true);
	add('passkeys@example.com', 'Passkeys', seedPassword, true);

	async function route(req: Request) {
		const url = new URL(req.url);
		if (req.method === 'GET' && url.pathname === '/__fake/last-token') {
			const token = last.get(url.searchParams.get('email')?.toLowerCase() ?? '');
			return token ? json({ token }) : refuse('not_found');
		}

		const path = url.pathname.slice('/account/v1/'.length);
		if (!url.pathname.startsWith('/account/v1/')) return refuse('not_found');
		const call = `${req.method} ${path}`;
		const sessionToken = req.headers.get('Kofra-Session') ?? '';
		const device = {
			user_agent: req.headers.get('Kofra-User-Agent') ?? '',
			country: req.headers.get('Kofra-Client-Country')
		};
		let body: Record<string, unknown> = {};
		if (req.body) {
			const value = await req.json().catch(() => null);
			if (!value || typeof value !== 'object' || Array.isArray(value))
				return refuse('invalid_request');
			body = value as Record<string, unknown>;
		}

		const candidate = sessions.get(sessionToken);
		const session =
			candidate && Date.parse(candidate.info.expires_at) > Date.now() ? candidate : undefined;

		const fields = (required: string[], optional: string[] = []) => {
			if (
				Object.keys(body).some((key) => !required.includes(key) && !optional.includes(key)) ||
				required.some((key) => typeof body[key] !== 'string') ||
				optional.some((key) => key in body && typeof body[key] !== 'string')
			)
				refuse('invalid_request');
		};
		const value = (key: string) => (body[key] as string | undefined) ?? '';
		const email = () => value('email').trim().toLowerCase();
		const validEmail = () => {
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email()))
				refuse('invalid_email', 'Enter a valid email address.');
			return email();
		};
		const event = (person: Person, kind: string) => {
			person.events.unshift({ at: now(), kind, ...device });
			person.events.length = Math.min(person.events.length, 50);
		};
		const issue = (person: Person, stage: SessionInfo['stage'], level: SessionInfo['level']) => {
			const token = id('session_');
			const info = {
				id: id('ses_'),
				stage,
				level,
				step_at: now(),
				expires_at: expires(stage === 'full' ? 60 * 24 * 7 : 10)
			};
			sessions.set(token, {
				info,
				person,
				csrf: id('csrf_'),
				device: { ...device, created_at: now(), last_seen_at: now() }
			});
			return json({
				state: stage === 'full' ? 'signed_in' : 'second_step',
				session: { token, expires_at: info.expires_at }
			});
		};
		const link = (kind?: Mail['kind']) => {
			const link = links.get(value('token'));
			if (
				!link ||
				(kind ? link.kind !== kind : link.kind === 'reset') ||
				Date.parse(link.expires) <= Date.now()
			)
				return refuse('token_invalid');
			return link;
		};

		switch (call) {
			case 'POST signup': {
				fields(['email', 'name', 'password'], ['invite']);
				const address = validEmail();
				if (value('invite') !== 'inv-e2e' || address !== 'new@example.com' || inviteUsed)
					return refuse('invite_invalid');
				checkPassword(value('password'));
				if (!people.has(address)) mail(add(address, value('name'), value('password')), 'verify');
				inviteUsed = true;
				return json({ state: 'verify_email' }, 202);
			}
			case 'POST email/resend':
			case 'POST password/forgot': {
				fields(['email']);
				const person = people.get(email());
				if (person && call === 'POST password/forgot' && person.user.email_verified)
					mail(person, 'reset');
				if (person && call === 'POST email/resend' && !person.user.email_verified)
					mail(person, 'verify');
				return json({}, 202);
			}
			case 'POST email/verify': {
				fields(['token'], ['password']);
				const { person, kind, email: address } = link();
				if (kind === 'verify' && person.password !== value('password'))
					return refuse('invalid_credentials');
				if (kind === 'change' && people.has(address)) return refuse('token_invalid');
				endSessions(person);
				voidLinks(person, kind === 'verify');
				if (kind === 'change') {
					people.delete(person.user.email);
					person.user.email = address;
					people.set(address, person);
					event(person, 'email_changed');
					return json({ state: 'verified', what: 'email_changed' });
				}
				person.user.email_verified = true;
				event(person, 'email_verified');
				return json({ state: 'verified', what: 'address' });
			}
			case 'POST login/password': {
				fields(['email', 'password']);
				const person = people.get(email());
				if (!person || person.password !== value('password')) {
					if (person) event(person, 'sign_in_failed');
					return refuse('invalid_credentials');
				}
				if (!hasFactor(person)) event(person, 'sign_in');
				return issue(person, hasFactor(person) ? 'second_step' : 'full', 1);
			}
			case 'POST password/reset/check':
				fields(['token']);
				return json({ second_factor: hasFactor(link('reset').person) });
			case 'POST password/reset': {
				fields(['token', 'password'], ['code']);
				const { person } = link('reset');
				checkPassword(value('password'));
				links.delete(value('token'));
				if (hasFactor(person) && !codeMatches(person, value('code'))) return refuse('code_invalid');
				voidLinks(person);
				person.password = value('password');
				endSessions(person);
				event(person, 'password_reset');
				return json();
			}
		}

		const fresh = () => {
			if (
				!session ||
				!freshStep(session.info.step_at) ||
				(hasFactor(session.person) && session.info.level !== 2)
			)
				refuse('step_required');
		};

		if (
			req.method === 'POST' &&
			/^(?:passkeys\/(?:register|login)|reauth\/passkey)\/(?:begin|finish)$/.test(path)
		) {
			const flow = path.slice(0, path.lastIndexOf('/'));
			const register = flow === 'passkeys/register';
			const login = flow === 'passkeys/login';
			if (
				login
					? sessionToken && session?.info.stage !== 'second_step'
					: session?.info.stage !== 'full'
			)
				return refuse('session_invalid');
			if (register) fresh();
			const person = session?.person;
			if (path.endsWith('/begin')) {
				fields([]);
				for (const [key, challenge] of challenges) {
					if (challenge.expires <= Date.now()) challenges.delete(key);
				}
				const challenge_id = id('challenge_');
				challenges.set(challenge_id, { flow, session, expires: Date.now() + 300_000 });
				const challenge = crypto.randomUUID().replaceAll('-', '');
				// WebAuthn refuses IP addresses as RP IDs, so the loopback fake uses localhost.
				const rpId = 'localhost';
				const timeout = 300_000;
				const credentials = person?.passkeys.map(({ credentialId }) => ({
					id: credentialId,
					type: 'public-key'
				}));
				const options =
					register && person
						? {
								challenge,
								timeout,
								rp: { id: rpId, name: 'Kofra' },
								user: {
									id: person.user.id,
									name: person.user.email,
									displayName: person.user.name
								},
								pubKeyCredParams: [
									{ alg: -7, type: 'public-key' },
									{ alg: -257, type: 'public-key' }
								],
								authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
								excludeCredentials: credentials
							}
						: {
								challenge,
								rpId,
								timeout,
								userVerification: 'required',
								allowCredentials: credentials
							};
				return json({ challenge_id, options });
			}

			const { credential, ...rest } = body;
			body = rest;
			fields(register ? ['challenge_id', 'name'] : ['challenge_id'], register ? ['password'] : []);
			const challenge = challenges.get(value('challenge_id'));
			if (!challenge || challenge.flow !== flow || challenge.session !== session)
				return refuse('passkey_invalid');
			// As the real service: the first second factor needs the current password,
			// checked before the challenge is spent.
			if (register && person && !hasFactor(person) && value('password') !== person.password)
				return refuse('invalid_credentials');
			challenges.delete(value('challenge_id'));
			// This loopback fake checks JSON shape only. It does not implement WebAuthn security.
			const input = credential as {
				id?: unknown;
				rawId?: unknown;
				type?: unknown;
				response?: Record<string, unknown>;
			} | null;
			if (
				challenge.expires <= Date.now() ||
				input?.type !== 'public-key' ||
				typeof input.id !== 'string' ||
				!input.id ||
				typeof input.rawId !== 'string' ||
				typeof input.response?.clientDataJSON !== 'string' ||
				(register
					? typeof input.response.attestationObject !== 'string'
					: typeof input.response.authenticatorData !== 'string' ||
						typeof input.response.signature !== 'string')
			)
				return refuse('passkey_invalid');

			if (register && person) {
				const first = !hasFactor(person);
				const passkey = {
					id: id('pk_'),
					name: value('name'),
					created_at: now(),
					last_used_at: null,
					synced: false
				};
				if (!passkey.name.trim() || person.passkeys.some((key) => key.credentialId === input.id))
					return refuse('passkey_invalid');
				person.passkeys.push({ ...passkey, credentialId: input.id });
				person.user.passkeys = person.passkeys.length;
				return json({ passkey, recovery_codes: first ? recovery(person) : null }, 201);
			}

			const owner =
				person ??
				Array.from(people.values()).find((candidate) =>
					candidate.passkeys.some((key) => key.credentialId === input.id)
				);
			const key = owner?.passkeys.find((key) => key.credentialId === input.id);
			if (!owner || !key) return refuse('passkey_invalid');
			key.last_used_at = now();
			if (login) {
				sessions.delete(sessionToken);
				event(owner, 'sign_in');
				return issue(owner, 'full', 2);
			}
			if (!session) return refuse('session_invalid');
			session.info.level = 2;
			session.info.step_at = now();
			return json({ step_at: session.info.step_at });
		}

		if (!session) return refuse('session_invalid');
		const { person, info } = session;
		if (call === 'POST session/resolve') {
			fields([]);
			session.device.last_seen_at = now();
			const result: Resolved = {
				user: person.user,
				session: info,
				workspaces: info.stage === 'full' ? person.workspaces : [],
				csrf: session.csrf,
				needs:
					info.stage === 'second_step'
						? 'second_step'
						: !person.user.email_verified
							? 'verify_email'
							: person.workspaces.length === 0
								? 'workspace'
								: null
			};
			return json(result);
		}
		if (call === 'POST logout') {
			fields([]);
			sessions.delete(sessionToken);
			event(person, 'signed_out');
			return empty();
		}
		if (call === 'POST login/totp' || call === 'POST login/recovery') {
			fields(['code']);
			if (info.stage !== 'second_step') return refuse('session_invalid');
			if (!codeMatches(person, value('code'), call.endsWith('/totp') ? 'totp' : 'recovery')) {
				event(person, 'second_step_failed');
				return refuse('code_invalid');
			}
			sessions.delete(sessionToken);
			event(person, call.endsWith('/recovery') ? 'recovery_code_used' : 'sign_in');
			return issue(person, 'full', 2);
		}
		if (info.stage !== 'full') return refuse('session_invalid');
		switch (call) {
			case 'GET passkeys':
				return json({
					data: person.passkeys.map(({ id, name, created_at, last_used_at, synced }) => ({
						id,
						name,
						created_at,
						last_used_at,
						synced
					}))
				});
			case 'GET sessions':
				return json({
					data: Array.from(sessions, ([token, row]) =>
						row.person === person && Date.parse(row.info.expires_at) > Date.now()
							? { id: row.info.id, current: token === sessionToken, ...row.device }
							: null
					).filter(Boolean)
				});
			case 'POST sessions/revoke-others':
				fields([]);
				for (const [token, row] of sessions)
					if (row.person === person && token !== sessionToken) sessions.delete(token);
				event(person, 'sessions_revoked');
				return empty();
			case 'POST reauth':
				fields(['password'], ['code']);
				if (value('password') !== person.password) return refuse('invalid_credentials');
				if (hasFactor(person) && !codeMatches(person, value('code'))) return refuse('code_invalid');
				info.level = hasFactor(person) ? 2 : 1;
				info.step_at = now();
				return json({ step_at: info.step_at });
			case 'POST password/change':
				fields(['password'], ['current']);
				fresh();
				if ('current' in body ? value('current') !== person.password : info.level !== 2)
					return refuse('invalid_credentials');
				checkPassword(value('password'));
				person.password = value('password');
				voidLinks(person);
				endSessions(person);
				event(person, 'password_changed');
				return issue(person, 'full', info.level);
			case 'POST email/change': {
				fields(['email']);
				fresh();
				const address = validEmail();
				if (!people.has(address)) mail(person, 'change', address);
				event(person, 'email_change_requested');
				return json({}, 202);
			}
			case 'PATCH profile':
				fields(['name']);
				person.user.name = value('name');
				return json(person.user);
			case 'POST totp/begin': {
				fields([]);
				fresh();
				if (person.user.totp) return refuse('already_enabled');
				const secret = 'JBSWY3DPEHPK3PXP';
				person.pendingTotp = secret;
				return json({
					secret,
					uri: `otpauth://totp/Kofra:${encodeURIComponent(person.user.email)}?secret=${secret}&issuer=Kofra`
				});
			}
			case 'POST totp/confirm': {
				fields(['code'], ['password']);
				fresh();
				if (person.user.totp) return refuse('already_enabled');
				if (!hasFactor(person) && value('password') !== person.password)
					return refuse('invalid_credentials');
				if (!person.pendingTotp || value('code') !== fakeCode) return refuse('code_invalid');
				delete person.pendingTotp;
				const first = !hasFactor(person);
				person.user.totp = true;
				event(person, 'totp_enabled');
				return json({ recovery_codes: first ? recovery(person) : null });
			}
			case 'DELETE totp':
				fresh();
				person.user.totp = false;
				voidLinks(person);
				removeRecoveryIfNeeded(person, sessionToken);
				event(person, 'totp_disabled');
				return empty();
			case 'POST recovery-codes':
				fields([]);
				fresh();
				event(person, 'recovery_codes_created');
				return json({ recovery_codes: recovery(person) });
			case 'POST workspaces': {
				fields(['name']);
				if (!person.user.email_verified) return refuse('email_unverified');
				if (person.workspaces.length) return refuse('workspace_limit_reached');
				const workspace = {
					id: id('ws_'),
					name: value('name'),
					role: 'owner',
					state: 'active'
				} as const;
				person.workspaces.push(workspace);
				return json(workspace, 201);
			}
			case 'GET security-log':
				return json({ data: person.events });
		}
		if (['PATCH', 'DELETE'].includes(req.method) && /^passkeys\/[^/]+$/.test(path)) {
			const index = person.passkeys.findIndex((key) => key.id === path.slice('passkeys/'.length));
			const key = person.passkeys[index];
			if (!key) return refuse('not_found');
			if (req.method === 'PATCH') {
				fields(['name']);
				if (!value('name').trim()) return refuse('invalid_request');
				key.name = value('name');
				const { id, name, created_at, last_used_at, synced } = key;
				return json({ id, name, created_at, last_used_at, synced });
			}
			fresh();
			person.passkeys.splice(index, 1);
			person.user.passkeys = person.passkeys.length;
			removeRecoveryIfNeeded(person, sessionToken);
			return empty();
		}
		if (req.method === 'DELETE' && /^sessions\/[^/]+$/.test(path)) {
			for (const [token, row] of sessions) {
				if (row.person === person && row.info.id === path.slice('sessions/'.length)) {
					sessions.delete(token);
					event(person, 'sessions_revoked');
					return empty();
				}
			}
		}
		return refuse('not_found');
	}

	return {
		async fetch(req) {
			try {
				return await route(req);
			} catch (err) {
				if (!(err instanceof Refused)) throw err;
				const status = statuses[err.code];
				return Response.json(
					{ type: 'about:blank', title: err.code, status, code: err.code, detail: err.message },
					{ status, headers: { 'content-type': 'application/problem+json' } }
				);
			}
		}
	};
}

let fake: Upstream | undefined;
export const fakeAccount: Upstream = { fetch: (req) => (fake ??= createFakeAccount()).fetch(req) };
