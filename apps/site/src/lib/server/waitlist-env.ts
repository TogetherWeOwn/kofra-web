// Turns the Worker environment into waitlist dependencies, or null when the waitlist must not run.
// Fail closed: the flag off, any binding or secret missing, or a malformed key all give null.
import { confirmationEmail, d1Store, keyBytes, type D1Like, type Deps } from './waitlist.js';

export interface WaitlistEnv {
	WAITLIST_ENABLED?: string;
	/** Sender address on an onboarded Email Service domain, for example early-access@kofra.app. */
	WAITLIST_FROM?: string;
	TURNSTILE_SITE_KEY?: string;
	TURNSTILE_SECRET_KEY?: string;
	WAITLIST_HMAC_KEY?: string;
	WAITLIST_ENC_KEY?: string;
	WAITLIST_DB?: D1Like;
	EMAIL?: {
		send(message: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
	};
	WAITLIST_RATE?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

export interface WaitlistRuntime {
	deps: Deps;
	turnstileSecret: string;
	rate: NonNullable<WaitlistEnv['WAITLIST_RATE']>;
}

export function waitlistRuntime(env: WaitlistEnv): WaitlistRuntime | null {
	if (env.WAITLIST_ENABLED !== 'true') return null;
	const { WAITLIST_FROM, TURNSTILE_SECRET_KEY, WAITLIST_HMAC_KEY, WAITLIST_ENC_KEY } = env;
	const { WAITLIST_DB, EMAIL, WAITLIST_RATE } = env;
	if (!WAITLIST_FROM || !TURNSTILE_SECRET_KEY || !WAITLIST_HMAC_KEY || !WAITLIST_ENC_KEY)
		return null;
	if (!WAITLIST_DB || !EMAIL || !WAITLIST_RATE) return null;
	try {
		// One key must never serve both purposes. Compared as bytes: base64 has several spellings.
		const hmac = keyBytes(WAITLIST_HMAC_KEY);
		const encKey = keyBytes(WAITLIST_ENC_KEY);
		if (hmac.every((b, i) => b === encKey[i])) return null;
	} catch {
		return null;
	}
	return {
		turnstileSecret: TURNSTILE_SECRET_KEY,
		rate: WAITLIST_RATE,
		deps: {
			store: d1Store(WAITLIST_DB),
			hmacKey: WAITLIST_HMAC_KEY,
			encKey: WAITLIST_ENC_KEY,
			now: () => Math.floor(Date.now() / 1000),
			send: async (to, url) => {
				await EMAIL.send({ from: WAITLIST_FROM, to, ...confirmationEmail(url) });
			}
		}
	};
}
