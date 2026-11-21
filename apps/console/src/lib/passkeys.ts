import type { PasskeyChallenge } from './server/account/types.js';

export function supportsPasskeys() {
	return (
		typeof window !== 'undefined' &&
		typeof window.PublicKeyCredential?.parseCreationOptionsFromJSON === 'function' &&
		typeof window.PublicKeyCredential?.parseRequestOptionsFromJSON === 'function'
	);
}

async function serialize(ceremony: Promise<Credential | null>) {
	try {
		const credential = await ceremony;
		if (!(credential instanceof PublicKeyCredential)) throw new Error('No passkey was returned.');
		return credential.toJSON();
	} catch (err) {
		if (err instanceof DOMException && err.name === 'NotAllowedError') return null;
		throw err;
	}
}

export function createPasskey(options: PublicKeyCredentialCreationOptionsJSON) {
	return serialize(
		navigator.credentials.create({
			publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options)
		})
	);
}

export function getPasskey(options: PublicKeyCredentialRequestOptionsJSON) {
	return serialize(
		navigator.credentials.get({
			publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options)
		})
	);
}

export async function passkeyCeremony<Options, Result>(
	endpoint: string,
	ceremony: (options: Options) => ReturnType<typeof getPasskey>,
	csrf?: string,
	name?: string,
	password?: string
): Promise<Result | null> {
	const url = new URL(endpoint, window.location.origin);
	url.search = window.location.search;
	async function post<T>(step: string, payload?: object): Promise<T> {
		const target = new URL(url);
		target.pathname += '/' + step;
		const response = await fetch(target, {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...(csrf ? { 'x-kofra-csrf': csrf } : {}) },
			body: payload ? JSON.stringify(payload) : undefined
		});
		const data = (await response.json().catch(() => null)) as {
			redirect?: string;
			message?: string;
		} | null;
		if (data?.redirect && target.origin === new URL(data.redirect, target).origin) {
			window.location.assign(data.redirect);
			throw new Error(data.message || 'Continue to confirm your identity.');
		}
		if (!response.ok || !data)
			throw new Error(data?.message || 'The passkey request did not work. Try again.');
		return data as T;
	}
	const { challenge_id, options } = await post<PasskeyChallenge<Options>>('begin');
	const credential = await ceremony(options);
	return credential && post<Result>('finish', { challenge_id, credential, name, password });
}
