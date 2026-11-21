const utf8 = new TextEncoder();
const base64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');

export async function mintAssertion(
	key: Uint8Array,
	workspace: string,
	user: string,
	session: string,
	nowSecs: number
): Promise<string> {
	const payload = base64url(utf8.encode(`v1|${workspace}|${user}|${session}|${nowSecs + 50}`));
	const signingKey = await crypto.subtle.importKey(
		'raw',
		Uint8Array.from(key),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const tag = await crypto.subtle.sign(
		'HMAC',
		signingKey,
		utf8.encode(`kofra-console-assertion-v1\n${payload}`)
	);
	return `kofra_cs_${payload}.${base64url(new Uint8Array(tag))}`;
}
