import { decodeState } from '@kofra/api/demo';
import { describe, expect, it } from 'vitest';
import { demoCookieName, demoFilePath, demoSetCookie, openDemo } from './demo.js';

const https = new URL('https://console.example/buckets');
const http = new URL('http://127.0.0.1:4174/');

describe('demo session', () => {
	it('uses a __Host- cookie over https and a plain one on local http', () => {
		expect(demoCookieName(https)).toBe('__Host-kofra-demo');
		expect(demoCookieName(http)).toBe('kofra-demo');
	});

	it('saves changes in an HttpOnly, SameSite=Lax cookie and reads them back', async () => {
		const { demo, api } = openDemo(https, undefined);
		await api.buckets.create({ body: { name: 'from-cookie' } });
		const header = demoSetCookie(https, demo);
		expect(header).toMatch(
			/^__Host-kofra-demo=[A-Za-z0-9_-]+; Path=\/; Max-Age=604800; HttpOnly; SameSite=Lax; Secure$/
		);
		const value = header.split(';')[0]!.split('=')[1];
		expect(decodeState(value).b.map(([n]) => n)).toEqual(['from-cookie']);
		const again = openDemo(https, value);
		expect((await again.api.buckets.list()).data.map((b) => b.name)).toContain('from-cookie');
		expect(demoSetCookie(http, demo)).not.toContain('Secure');
	});

	it('points presigned downloads at the console placeholder route', async () => {
		const { api } = openDemo(https, undefined);
		const p = await api.objects.presign({
			body: {
				bucket: 'backups',
				key: 'server/db/a b.sql.gz',
				method: 'GET',
				expires_in_seconds: 300
			}
		});
		expect(p.url).toMatch(
			/^https:\/\/console\.example\/demo-files\/backups\/server\/db\/a%20b\.sql\.gz\?expires=\d+$/
		);
		expect(demoFilePath('b', 'x/y z')).toBe('/demo-files/b/x/y%20z');
	});
});
