export type SignInState = 'signed_in' | 'second_step';
export interface IssuedSession {
	token: string;
	expires_at: string;
}
export interface SignInAnswer {
	state: SignInState;
	session: IssuedSession;
}

export interface User {
	id: string; // usr_...
	name: string;
	email: string;
	email_verified: boolean;
	totp: boolean; // authenticator app set up
	passkeys: number; // registered passkeys
	recovery_codes_left: number;
	created_at: string;
}
export interface SessionInfo {
	id: string; // ses_...
	stage: 'full' | 'second_step';
	level: 1 | 2; // 2 = two factors (or a verified passkey)
	step_at: string; // last sign-in step; fresh for 10 minutes
	expires_at: string;
}
export interface WorkspaceSummary {
	id: string;
	name: string;
	role: 'owner' | 'admin' | 'billing' | 'member' | 'viewer';
	state: 'setting_up' | 'active';
}
export interface Resolved {
	user: User;
	session: SessionInfo;
	workspaces: WorkspaceSummary[];
	csrf: string; // put in every form as `_csrf`; compare in constant time
	needs: null | 'second_step' | 'verify_email' | 'workspace';
}
export interface SessionRow {
	id: string;
	current: boolean;
	created_at: string;
	last_seen_at: string;
	user_agent: string;
	country: string | null;
}
export interface SecurityEvent {
	at: string;
	kind: string;
	user_agent: string;
	country: string | null;
}

export interface Upstream {
	fetch(req: Request): Promise<Response>;
}

export interface SignupInput {
	invite?: string;
	email: string;
	name: string;
	password: string;
}

export interface VerifyAnswer {
	state: 'verified';
	what: 'address' | 'email_changed';
}

export interface Passkey {
	id: string;
	name: string;
	created_at: string;
	last_used_at: string | null;
	synced: boolean;
}

export interface PasskeyChallenge<Options> {
	challenge_id: string;
	options: Options;
}

export interface PasskeyAssertion {
	challenge_id: string;
	credential: RegistrationResponseJSON | AuthenticationResponseJSON;
}
