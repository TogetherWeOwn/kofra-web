// AWS Signature Version 4 for S3: header-signed requests and presigned query URLs.
// Ported from the storage service's file console (MIT), with query presigning added.

export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
export const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

const enc = new TextEncoder();

export function toHex(buf: ArrayBuffer | Uint8Array): string {
	return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(data: string | Uint8Array<ArrayBuffer>): Promise<string> {
	const bytes = typeof data === 'string' ? enc.encode(data) : data;
	return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

export async function sha256Base64(data: Uint8Array<ArrayBuffer>): Promise<string> {
	const d = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
	return btoa(String.fromCharCode(...d));
}

async function hmac(
	key: string | Uint8Array<ArrayBuffer>,
	data: string
): Promise<Uint8Array<ArrayBuffer>> {
	const k = await crypto.subtle.importKey(
		'raw',
		typeof key === 'string' ? enc.encode(key) : key,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}

/** RFC 3986 encoding as SigV4 wants it: only unreserved characters stay. */
export function uriEncode(s: string): string {
	return encodeURIComponent(s).replace(
		/[!'()*]/g,
		(c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
	);
}

/** An object key as a path: every segment encoded, `/` kept. */
export function encodeKey(key: string): string {
	return key.split('/').map(uriEncode).join('/');
}

export type Query = [string, string][];

/** Canonical query string: encoded, then sorted by name and value. */
export function canonicalQuery(params: Query): string {
	return params
		.map(([k, v]) => [uriEncode(k), uriEncode(v ?? '')] as const)
		.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
		.map(([k, v]) => `${k}=${v}`)
		.join('&');
}

/** The query as sent: the same encoding as signed, in the given order. */
export const queryString = (params: Query) =>
	params.length
		? '?' + params.map(([k, v]) => `${uriEncode(k)}=${uriEncode(v ?? '')}`).join('&')
		: '';

export function amzDate(ms: number): string {
	return new Date(ms)
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

export interface Credentials {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	service?: string;
}

async function signature(creds: Credentials, day: string, toSign: string): Promise<string> {
	let k = await hmac(`AWS4${creds.secretAccessKey}`, day);
	k = await hmac(k, creds.region);
	k = await hmac(k, creds.service ?? 's3');
	k = await hmac(k, 'aws4_request');
	return toHex(await hmac(k, toSign));
}

export interface SignInput {
	method: string;
	host: string;
	/** Already encoded (see `encodeKey`). */
	path: string;
	query?: Query;
	headers?: Record<string, string>;
	payloadHash: string;
	now: number;
}

/**
 * Signs a request with an Authorization header. Every header given is signed, so callers
 * pass only what they send. Returns the headers to send, `host` included: over a service
 * binding the callee sees only the Request's headers, not a Host made from its URL.
 */
export async function signHeaders(
	creds: Credentials,
	{ method, host, path, query = [], headers = {}, payloadHash, now }: SignInput
): Promise<Record<string, string>> {
	const date = amzDate(now);
	const day = date.slice(0, 8);
	const all: Record<string, string> = {};
	for (const [k, v] of Object.entries(headers))
		all[k.toLowerCase()] = String(v).trim().replace(/\s+/g, ' ');
	all.host = host;
	all['x-amz-date'] = date;
	all['x-amz-content-sha256'] = payloadHash;
	const names = Object.keys(all).sort();
	const canonicalHeaders = names.map((n) => `${n}:${all[n]}\n`).join('');
	const signedHeaders = names.join(';');
	const canonical = [
		method,
		path,
		canonicalQuery(query),
		canonicalHeaders,
		signedHeaders,
		payloadHash
	].join('\n');
	const scope = `${day}/${creds.region}/${creds.service ?? 's3'}/aws4_request`;
	const toSign = ['AWS4-HMAC-SHA256', date, scope, await sha256Hex(canonical)].join('\n');
	const sig = await signature(creds, day, toSign);
	return {
		...all,
		authorization: `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`
	};
}

/**
 * A presigned URL (query authentication, host the only signed header, unsigned payload).
 * Returns the query to append, in the order AWS documents.
 */
export async function presignQuery(
	creds: Credentials,
	{
		method,
		host,
		path,
		query = [],
		expiresIn,
		now
	}: { method: string; host: string; path: string; query?: Query; expiresIn: number; now: number }
): Promise<Query> {
	const date = amzDate(now);
	const day = date.slice(0, 8);
	const scope = `${day}/${creds.region}/${creds.service ?? 's3'}/aws4_request`;
	const auth: Query = [
		['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
		['X-Amz-Credential', `${creds.accessKeyId}/${scope}`],
		['X-Amz-Date', date],
		['X-Amz-Expires', String(expiresIn)],
		['X-Amz-SignedHeaders', 'host']
	];
	const all = [...query, ...auth];
	const canonical = [
		method,
		path,
		canonicalQuery(all),
		`host:${host}\n`,
		'host',
		UNSIGNED_PAYLOAD
	].join('\n');
	const toSign = ['AWS4-HMAC-SHA256', date, scope, await sha256Hex(canonical)].join('\n');
	return [...all, ['X-Amz-Signature', await signature(creds, day, toSign)]];
}
