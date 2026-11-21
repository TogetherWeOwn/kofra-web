import type { RequestEvent } from '@sveltejs/kit';
import type {
	Passkey,
	PasskeyAssertion,
	PasskeyChallenge,
	Resolved,
	SecurityEvent,
	SessionRow,
	SignupInput,
	SignInAnswer,
	Upstream,
	User,
	VerifyAnswer,
	WorkspaceSummary
} from './types.js';

export class AccountProblem extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		public readonly detail: string,
		public readonly retryAfter: string | null = null
	) {
		super(detail);
	}
}

export class AccountClient {
	private readonly headers: Headers;

	constructor(
		private readonly upstream: Upstream,
		event: RequestEvent,
		token?: string
	) {
		this.headers = new Headers({
			'Kofra-Client-IP':
				event.request.headers.get('CF-Connecting-IP') ?? event.getClientAddress() ?? '',
			'Kofra-User-Agent': (event.request.headers.get('User-Agent') ?? '').slice(0, 256)
		});
		if (token) this.headers.set('Kofra-Session', token);
		const country =
			event.platform?.cf?.country ??
			(event.request as Request & { cf?: { country?: string } }).cf?.country;
		if (typeof country === 'string' && /^[A-Z]{2}$/.test(country))
			this.headers.set('Kofra-Client-Country', country);
	}

	private async call<T>(path: string, method = 'POST', body?: object): Promise<T> {
		const headers = new Headers(this.headers);
		if (body) headers.set('Content-Type', 'application/json');
		let response: Response;
		try {
			response = await this.upstream.fetch(
				new Request(`https://account.internal/account/v1/${path}`, {
					method,
					redirect: 'manual',
					headers,
					body: body ? JSON.stringify(body) : undefined
				})
			);
		} catch {
			throw new AccountProblem(503, 'service_unavailable', 'Try again in a minute.');
		}
		if (response.status === 204) return undefined as T;
		const data: unknown = await response.json().catch(() => null);
		if (!response.ok || !data) {
			const problem = data as { code?: unknown; detail?: unknown } | null;
			throw new AccountProblem(
				response.status >= 400 && response.status <= 599 ? response.status : 503,
				typeof problem?.code === 'string' ? problem.code : 'service_unavailable',
				typeof problem?.detail === 'string' ? problem.detail : 'Try again in a minute.',
				response.headers.get('Retry-After')
			);
		}
		return data as T;
	}

	signup(input: SignupInput) {
		return this.call<{ state: 'verify_email' }>('signup', 'POST', input);
	}
	resendVerification(email: string) {
		return this.call<Record<string, never>>('email/resend', 'POST', { email });
	}
	verifyEmail(token: string, password?: string) {
		return this.call<VerifyAnswer>('email/verify', 'POST', { token, password });
	}
	loginPassword(email: string, password: string) {
		return this.call<SignInAnswer>('login/password', 'POST', { email, password });
	}
	loginTotp(code: string) {
		return this.call<SignInAnswer>('login/totp', 'POST', { code });
	}
	loginRecovery(code: string) {
		return this.call<SignInAnswer>('login/recovery', 'POST', { code });
	}
	resolve() {
		return this.call<Resolved>('session/resolve');
	}
	logout() {
		return this.call<void>('logout');
	}
	listSessions() {
		return this.call<{ data: SessionRow[] }>('sessions', 'GET');
	}
	revokeSession(id: string) {
		return this.call<void>(`sessions/${encodeURIComponent(id)}`, 'DELETE');
	}
	revokeOtherSessions() {
		return this.call<void>('sessions/revoke-others');
	}
	reauth(password: string, code?: string) {
		return this.call<{ step_at: string }>('reauth', 'POST', { password, code });
	}
	forgotPassword(email: string) {
		return this.call<Record<string, never>>('password/forgot', 'POST', { email });
	}
	checkReset(token: string) {
		return this.call<{ second_factor: boolean }>('password/reset/check', 'POST', { token });
	}
	resetPassword(token: string, password: string, code?: string) {
		return this.call<Record<string, never>>('password/reset', 'POST', { token, password, code });
	}
	changePassword(current: string | undefined, password: string) {
		return this.call<SignInAnswer>('password/change', 'POST', { current, password });
	}
	changeEmail(email: string) {
		return this.call<Record<string, never>>('email/change', 'POST', { email });
	}
	updateProfile(name: string) {
		return this.call<User>('profile', 'PATCH', { name });
	}
	totpBegin() {
		return this.call<{ secret: string; uri: string }>('totp/begin');
	}
	totpConfirm(code: string, password?: string) {
		return this.call<{ recovery_codes: string[] | null }>(
			'totp/confirm',
			'POST',
			password ? { code, password } : { code }
		);
	}
	totpDisable() {
		return this.call<void>('totp', 'DELETE');
	}
	newRecoveryCodes() {
		return this.call<{ recovery_codes: string[] }>('recovery-codes');
	}
	createWorkspace(name: string) {
		return this.call<WorkspaceSummary>('workspaces', 'POST', { name });
	}
	passkeyRegisterBegin() {
		return this.call<PasskeyChallenge<PublicKeyCredentialCreationOptionsJSON>>(
			'passkeys/register/begin'
		);
	}
	passkeyRegisterFinish(input: PasskeyAssertion & { name: string; password?: string }) {
		return this.call<{ passkey: Passkey; recovery_codes: string[] | null }>(
			'passkeys/register/finish',
			'POST',
			input
		);
	}
	passkeyLoginBegin() {
		return this.call<PasskeyChallenge<PublicKeyCredentialRequestOptionsJSON>>(
			'passkeys/login/begin'
		);
	}
	passkeyLoginFinish(input: PasskeyAssertion) {
		return this.call<SignInAnswer>('passkeys/login/finish', 'POST', input);
	}
	passkeyReauthBegin() {
		return this.call<PasskeyChallenge<PublicKeyCredentialRequestOptionsJSON>>(
			'reauth/passkey/begin'
		);
	}
	passkeyReauthFinish(input: PasskeyAssertion) {
		return this.call<{ step_at: string }>('reauth/passkey/finish', 'POST', input);
	}
	listPasskeys() {
		return this.call<{ data: Passkey[] }>('passkeys', 'GET');
	}
	renamePasskey(id: string, name: string) {
		return this.call<Passkey>(`passkeys/${encodeURIComponent(id)}`, 'PATCH', { name });
	}
	removePasskey(id: string) {
		return this.call<void>(`passkeys/${encodeURIComponent(id)}`, 'DELETE');
	}
	securityLog() {
		return this.call<{ data: SecurityEvent[] }>('security-log', 'GET');
	}
}
