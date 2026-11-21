import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { FAKE } from '../../../e2e/fake-storage.js';
import { createAccessVerifier } from './access.js';
import { readConfig, readTenant0, type Tenant0Config } from './config.js';
import { checkRequest, devBypass, sameOrigin } from './gate.js';
import { makeHandle } from './handle.js';
import { EMPTY_SHA256, presignQuery, sha256Hex, signHeaders } from './storage/sigv4.js';
import { open, seal, tokenKey } from './tokens.js';
import { AUD, EMAIL, NOW, TEAM, makeIssuer } from './testing/issuer.js';

const ENV = {
	CONSOLE_DATA: 'tenant0',
	ACCESS_TEAM_DOMAIN: TEAM,
	ACCESS_AUD: AUD,
	ALLOWED_EMAILS: `${EMAIL}, second@example.com`,
	STORAGE_HOST: 's3.example.com',
	STORAGE_KEY_ID: FAKE.consoleKeyId,
	STORAGE_SECRET: FAKE.consoleSecret,
	STORAGE_ADMIN_TOKEN: FAKE.adminToken,
	WORKSPACE_NAME: 'Owner workspace'
};
const binding = { fetch: async () => new Response('binding') };

describe('tenant0 configuration fails closed', () => {
	it('needs every setting, and exactly one way to reach storage', () => {
		const ok = readConfig({ ...ENV, STORAGE: binding });
		expect(ok.mode).toBe('tenant0');
		expect(ok.tenant0?.protectedBuckets).toEqual(['files']);
		expect(ok.billing.enabled).toBe(false);
		for (const name of [
			'ACCESS_TEAM_DOMAIN',
			'ACCESS_AUD',
			'ALLOWED_EMAILS',
			'STORAGE_HOST',
			'STORAGE_KEY_ID',
			'STORAGE_SECRET',
			'STORAGE_ADMIN_TOKEN'
		]) {
			const env: Record<string, unknown> = { ...ENV, STORAGE: binding };
			delete env[name];
			expect(readConfig(env)).toMatchObject({ mode: 'unconfigured', problem: name, tenant0: null });
		}
		expect(readConfig(ENV)).toMatchObject({ mode: 'unconfigured', problem: 'STORAGE' });
		expect(
			readConfig({ ...ENV, STORAGE: binding, STORAGE_ORIGIN: 'http://127.0.0.1:1' }).problem
		).toBe('STORAGE_ORIGIN');
		expect(readConfig({ ...ENV, STORAGE_ORIGIN: 'https://s3.example.com' }).problem).toBe(
			'STORAGE'
		);
		expect(readConfig({ ...ENV, STORAGE_ORIGIN: 'http://10.0.0.1:80' }).problem).toBe('STORAGE');
		expect(
			readConfig({ ...ENV, STORAGE: binding, ACCESS_TEAM_DOMAIN: 'evil.example.com' }).problem
		).toBe('ACCESS_TEAM_DOMAIN');
		expect(readConfig({ ...ENV, STORAGE: binding, ALLOWED_EMAILS: ' , ' }).problem).toBe(
			'ALLOWED_EMAILS'
		);
		expect(readConfig({ ...ENV, STORAGE: binding, PROTECTED_BUCKETS: 'a b' }).problem).toBe(
			'PROTECTED_BUCKETS'
		);
		expect(readConfig({ ...ENV, CONSOLE_DATA: 'other', STORAGE: binding }).mode).toBe(
			'unconfigured'
		);
		expect(readConfig({ CONSOLE_MODE: 'demo' }).mode).toBe('demo');
		expect(readConfig({ CONSOLE_DATA: 'demo' }).mode).toBe('demo');
	});

	it('always protects the files bucket', () => {
		const t = readTenant0({
			...ENV,
			STORAGE: binding,
			PROTECTED_BUCKETS: 'nntune, photos'
		}) as Tenant0Config;
		expect(t.protectedBuckets).toEqual(['files', 'nntune', 'photos']);
	});
});

describe('the gate', async () => {
	const issuer = await makeIssuer();
	const verify = createAccessVerifier({
		teamDomain: TEAM,
		aud: AUD,
		allowedEmails: [EMAIL],
		fetchCerts: issuer.fetchCerts,
		now: () => NOW
	});
	const deployed = readTenant0({ ...ENV, STORAGE: binding, DEV_AUTH: 'local' }) as Tenant0Config;
	const local = readTenant0({
		...ENV,
		STORAGE_ORIGIN: 'http://127.0.0.1:4178',
		DEV_AUTH: 'local'
	}) as Tenant0Config;
	const req = (url: string, token?: string) =>
		new Request(url, { headers: token ? { 'cf-access-jwt-assertion': token } : {} });

	it('lets an allowed email through and refuses everything else', async () => {
		expect(
			await checkRequest(req('https://console.example/', await issuer.token()), deployed, verify)
		).toEqual({
			ok: true,
			email: EMAIL
		});
		expect(await checkRequest(req('https://console.example/'), deployed, verify)).toEqual({
			ok: false,
			reason: 'missing'
		});
		expect(
			await checkRequest(
				req('https://console.example/', await issuer.token({ email: 'other@example.com' })),
				deployed,
				verify
			)
		).toEqual({ ok: false, reason: 'email' });
		// An Access token for a non-identity rule (a service token or an IP rule) has no email.
		expect(
			await checkRequest(
				req('https://console.example/', await issuer.token({ email: undefined, common_name: 'x' })),
				deployed,
				verify
			)
		).toEqual({ ok: false, reason: 'email' });
	});

	it('honours DEV_AUTH only for a loopback host in front of a loopback fake', () => {
		expect(devBypass(new URL('http://127.0.0.1:4177/'), local)).toBe(true);
		expect(devBypass(new URL('https://console.example/'), local)).toBe(false);
		// With a service binding (deployed), never, whatever the host says.
		expect(devBypass(new URL('http://127.0.0.1:4177/'), deployed)).toBe(false);
		expect(devBypass(new URL('http://localhost/'), { ...local, devAuth: false })).toBe(false);
	});

	it('wants requests that change something to come from the console itself', () => {
		const url = new URL('https://console.example/buckets/files/upload');
		const post = (origin?: string) =>
			new Request(url, { method: 'POST', headers: origin ? { origin } : {} });
		expect(sameOrigin(post('https://console.example'), url)).toBe(true);
		expect(sameOrigin(post('https://evil.example'), url)).toBe(false);
		expect(sameOrigin(post(), url)).toBe(false);
		expect(sameOrigin(new Request(url), url)).toBe(true);
	});

	it('answers 403 before any page code or storage call, and 503 when unconfigured', async () => {
		let upstream = 0;
		let resolved = 0;
		const env = { ...ENV, STORAGE: { fetch: async () => (upstream++, new Response('x')) } };
		const handle = makeHandle(() => readConfig(env), { verifier: () => verify, now: () => NOW });
		const event = (headers: Record<string, string> = {}, method = 'GET') =>
			({
				url: new URL('https://console.example/buckets'),
				request: new Request('https://console.example/buckets', { method, headers }),
				cookies: { get: () => undefined },
				locals: {}
			}) as unknown as RequestEvent;
		const resolve = async () => (resolved++, new Response('page'));
		expect((await handle({ event: event(), resolve })).status).toBe(403);
		// A signature with one character in its middle changed (the last one may carry only padding bits).
		const real = await issuer.token();
		const at = real.lastIndexOf('.') + 20;
		const forged = real.slice(0, at) + (real[at] === 'A' ? 'B' : 'A') + real.slice(at + 1);
		expect(
			(await handle({ event: event({ 'cf-access-jwt-assertion': forged }), resolve })).status
		).toBe(403);
		const good = await issuer.token();
		const crossSite = await handle({
			event: event({ 'cf-access-jwt-assertion': good, origin: 'https://evil.example' }, 'POST'),
			resolve
		});
		expect(crossSite.status).toBe(403);
		expect(resolved).toBe(0);
		expect(upstream).toBe(0);
		const okRes = await handle({ event: event({ 'cf-access-jwt-assertion': good }), resolve });
		expect(okRes.status).toBe(200);
		expect(okRes.headers.get('cache-control')).toBe('private, no-store');
		expect(resolved).toBe(1);
		const off = makeHandle(() => readConfig({ ...env, ACCESS_AUD: '' }), {
			verifier: () => verify
		});
		expect((await off({ event: event({ 'cf-access-jwt-assertion': good }), resolve })).status).toBe(
			503
		);
	});
});

describe('signed console tokens', () => {
	it('round-trip, and refuse forgery, expiry and the wrong purpose', async () => {
		const key = await tokenKey('server-secret-0123456789');
		const other = await tokenKey('another-secret-0123456789');
		const t = await seal(key, 'put', 1000, { b: 'files', k: 'a.txt', s: 5 });
		expect(await open(key, 'put', t, 999)).toEqual({ b: 'files', k: 'a.txt', s: 5 });
		expect(await open(key, 'put', t, 1001)).toBeNull();
		expect(await open(key, 'delete', t, 999)).toBeNull();
		expect(await open(other, 'put', t, 999)).toBeNull();
		const [body, sig] = t.split('.');
		const forgedBody = btoa(
			JSON.stringify({ p: 'put', e: 1000, d: { b: 'files', k: 'b.txt', s: 5 } })
		)
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		expect(await open(key, 'put', `${forgedBody}.${sig}`, 999)).toBeNull();
		expect(await open(key, 'put', `${body}.${sig}.x`, 999)).toBeNull();
		expect(await open(key, 'put', null, 999)).toBeNull();
	});
});

describe('SigV4', () => {
	// The worked examples of the AWS S3 documentation.
	const creds = {
		accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
		secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
		region: 'us-east-1'
	};
	const host = 'examplebucket.s3.amazonaws.com';
	const now = Date.UTC(2013, 4, 24, 0, 0, 0);

	it('signs headers as AWS does', async () => {
		const h = await signHeaders(creds, {
			method: 'GET',
			host,
			path: '/test.txt',
			headers: { range: 'bytes=0-9' },
			payloadHash: EMPTY_SHA256,
			now
		});
		expect(h.authorization).toMatch(
			/Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/
		);
		const put = await signHeaders(creds, {
			method: 'PUT',
			host,
			path: '/test%24file.text',
			headers: {
				date: 'Fri, 24 May 2013 00:00:00 GMT',
				'x-amz-storage-class': 'REDUCED_REDUNDANCY'
			},
			payloadHash: await sha256Hex('Welcome to Amazon S3.'),
			now
		});
		expect(put.authorization).toMatch(
			/Signature=98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd$/
		);
		const list = await signHeaders(creds, {
			method: 'GET',
			host,
			path: '/',
			query: [
				['prefix', 'J'],
				['max-keys', '2']
			],
			payloadHash: EMPTY_SHA256,
			now
		});
		expect(list.authorization).toMatch(
			/Signature=34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7$/
		);
	});

	it('presigns a URL as AWS does', async () => {
		const q = await presignQuery(creds, {
			method: 'GET',
			host,
			path: '/test.txt',
			expiresIn: 86400,
			now
		});
		expect(Object.fromEntries(q)['X-Amz-Signature']).toBe(
			'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'
		);
	});
});
