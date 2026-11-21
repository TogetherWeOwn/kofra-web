import { Kofra, KofraError } from '@kofra/api';
import { contractChecked } from '@kofra/api/testing';
import { describe, expect, it } from 'vitest';
import { FAKE, FakeStorage } from '../../../../e2e/fake-storage.js';
import { readTenant0, type Tenant0Config } from '../config.js';
import { FileError } from '../files.js';
import { createStorageClient } from '../storage/client.js';
import { tokenKey } from '../tokens.js';
import { LOCAL_TOKEN, Tenant0Api } from './api.js';
import { PART_SIZE, Tenant0Files } from './files.js';

function setup() {
	const fake = new FakeStorage();
	const cfg = readTenant0({
		ACCESS_TEAM_DOMAIN: 'example-team.cloudflareaccess.com',
		ACCESS_AUD: 'a'.repeat(64),
		ALLOWED_EMAILS: 'owner@example.com',
		STORAGE_ORIGIN: `http://${FAKE.host}`,
		STORAGE_HOST: FAKE.host,
		STORAGE_KEY_ID: FAKE.consoleKeyId,
		STORAGE_SECRET: FAKE.consoleSecret,
		STORAGE_ADMIN_TOKEN: FAKE.adminToken,
		PROTECTED_BUCKETS: 'nntune'
	}) as Tenant0Config;
	if (typeof cfg === 'string') throw new Error(cfg);
	cfg.storage.upstream = { fetch: fake.fetch };
	const storage = createStorageClient(cfg.storage);
	const tenant = new Tenant0Api(cfg, storage);
	const checked = contractChecked(tenant.fetch);
	const api = new Kofra({
		token: LOCAL_TOKEN,
		baseUrl: 'https://api.kofra.app',
		fetch: checked.fetch,
		maxRetries: 0
	});
	const files = new Tenant0Files(tenant, storage, tokenKey(cfg.storage.secret));
	return { fake, cfg, tenant, storage, api, files, problems: checked.problems };
}

async function code(p: Promise<unknown>): Promise<string> {
	try {
		await p;
	} catch (err) {
		if (err instanceof KofraError) return err.code;
		if (err instanceof FileError) return `file:${err.status}`;
		throw err;
	}
	throw new Error('expected a refusal');
}

const stream = (bytes: Uint8Array) =>
	new ReadableStream<Uint8Array>({
		start(c) {
			c.enqueue(bytes);
			c.close();
		}
	});

describe('tenant0 transport: the contract over the storage service', () => {
	it('answers account, buckets, keys, usage and events within the contract', async () => {
		const { api, problems, fake } = setup();
		const account = await api.account.get();
		expect(account).toMatchObject({
			id: 'ws_0',
			state: 'active',
			s3_endpoint: `https://${FAKE.host}`
		});
		const buckets = await api.buckets.list();
		// Only the buckets the console's key can open; nntune is listed elsewhere.
		expect(buckets.data.map((b) => b.name)).toEqual(['files', 'scratch']);
		expect(buckets.data[0]!.object_count).toBe(234);
		const keys = await api.keys.list();
		expect(keys.data.map((k) => k.id).sort()).toEqual(
			[FAKE.appKeyId, FAKE.consoleKeyId, FAKE.ownerKeyId].sort()
		);
		expect(keys.data.every((k) => k.name === null && !('secret_access_key' in k))).toBe(true);
		const usage = await api.usage.get();
		expect(usage.object_count).toBe(235);
		expect((await api.usage.buckets()).data.map((b) => b.bucket)).toEqual(['files', 'nntune']);
		expect((await api.usage.days()).data).toEqual([]);
		expect((await api.events.list()).data).toEqual([]);
		expect(problems).toEqual([]);
		expect(fake.calls.some((c) => c.includes('/_admin/status'))).toBe(false);
	});

	it('creates a bucket as real data and opens it for the console', async () => {
		const { api, fake, problems } = setup();
		expect((await api.buckets.create({ body: { name: 'new-bucket' } })).name).toBe('new-bucket');
		expect(fake.keys.get(FAKE.consoleKeyId)!.grants.get('new-bucket')).toBe('rw');
		expect((await api.buckets.get({ bucket: 'new-bucket' })).stored_bytes).toBe(0);
		expect(await code(api.buckets.create({ body: { name: 'files' } }))).toBe(
			'bucket_already_exists'
		);
		expect(await code(api.buckets.create({ body: { name: 'Bad_Name' } }))).toBe(
			'invalid_bucket_name'
		);
		expect(problems).toEqual([]);
	});

	it('never deletes a protected bucket, and sends no delete for one', async () => {
		const { api, fake } = setup();
		expect(await code(api.buckets.delete({ bucket: 'files', dry_run: true }))).toBe(
			'role_forbidden'
		);
		expect(await code(api.buckets.delete({ bucket: 'files' }))).toBe('role_forbidden');
		expect(await code(api.buckets.delete({ bucket: 'nntune' }))).toBe('role_forbidden');
		expect(fake.calls.filter((c) => c.startsWith('DELETE'))).toEqual([]);
		expect(fake.buckets.has('files')).toBe(true);
	});

	it('deletes an empty bucket only, after a plan', async () => {
		const { api, fake, problems } = setup();
		const plan = await api.buckets.delete({ bucket: 'scratch', dry_run: true });
		expect(plan).toMatchObject({ dry_run: true, operation: 'buckets.delete', reversible: false });
		await api.buckets.delete({ bucket: 'scratch' });
		expect(fake.buckets.has('scratch')).toBe(false);
		// A bucket with a file, or with an unfinished upload, is refused before any delete.
		await api.buckets.create({ body: { name: 'busy' } });
		fake.buckets.get('busy')!.uploads.set('u1', { key: 'k', type: 't', parts: new Map() });
		expect(await code(api.buckets.delete({ bucket: 'busy', dry_run: true }))).toBe(
			'bucket_not_empty'
		);
		await api.buckets.create({ body: { name: 'full' } });
		fake.buckets
			.get('full')!
			.objects.set('a', { body: new Uint8Array(1), type: 't', etag: '"x"', modified: 0 });
		expect(await code(api.buckets.delete({ bucket: 'full' }))).toBe('bucket_not_empty');
		expect(fake.buckets.has('full')).toBe(true);
		// Emptied, but it once held a file: the service keeps it, and the console says so.
		fake.buckets.get('full')!.objects.clear();
		fake.buckets.get('full')!.held = true;
		const err = await api.buckets.delete({ bucket: 'full' }).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(KofraError);
		expect((err as KofraError).code).toBe('bucket_not_empty');
		expect((err as KofraError).problem.detail).toContain('has held files before');
		// A bucket the console cannot open is not deleted from here.
		expect(await code(api.buckets.delete({ bucket: 'nntune-x' }))).toBe('bucket_not_found');
		expect(problems).toEqual([]);
	});

	it('creates a key with mixed access, shows the secret once, and never hands out a partial key', async () => {
		const { api, fake, problems } = setup();
		const key = await api.keys.create({
			body: {
				grants: [
					{ bucket: 'files', access: 'read' },
					{ bucket: 'scratch', access: 'read_write' }
				]
			}
		});
		expect(key.secret_access_key).toBeTruthy();
		expect(Object.fromEntries(fake.keys.get(key.id)!.grants)).toEqual({
			files: 'ro',
			scratch: 'rw'
		});
		const listed = (await api.keys.list()).data.find((k) => k.id === key.id)!;
		expect(listed.grants).toEqual(
			expect.arrayContaining([
				{ bucket: 'files', access: 'read' },
				{ bucket: 'scratch', access: 'read_write' }
			])
		);
		// The second grant fails: the key made in the first step is revoked again.
		fake.buckets.set('fail-grant', {
			name: 'fail-grant',
			id: 'b_fail',
			created: 0,
			objects: new Map(),
			uploads: new Map(),
			held: false
		});
		const before = fake.keys.size;
		expect(
			await code(
				api.keys.create({
					body: {
						grants: [
							{ bucket: 'files', access: 'read' },
							{ bucket: 'fail-grant', access: 'read_write' }
						]
					}
				})
			)
		).toBe('internal_error');
		expect(fake.keys.size).toBe(before);
		expect(
			await code(api.keys.create({ body: { grants: [{ bucket: 'nope', access: 'read' }] } }))
		).toBe('bucket_not_found');
		// Grants only widen.
		await api.keys.update({
			key_id: key.id,
			body: { grants: [{ bucket: 'files', access: 'read_write' }] }
		});
		expect(fake.keys.get(key.id)!.grants.get('files')).toBe('rw');
		expect(
			await code(
				api.keys.update({ key_id: key.id, body: { grants: [{ bucket: 'files', access: 'read' }] } })
			)
		).toBe('grant_narrowing_refused');
		expect(problems).toEqual([]);
	});

	it("revokes keys, but never the console's own", async () => {
		const { api, fake, problems } = setup();
		expect(await code(api.keys.revoke({ key_id: FAKE.consoleKeyId, dry_run: true }))).toBe(
			'role_forbidden'
		);
		expect(await code(api.keys.revoke({ key_id: FAKE.consoleKeyId }))).toBe('role_forbidden');
		expect(fake.keys.has(FAKE.consoleKeyId)).toBe(true);
		expect(await api.keys.revoke({ key_id: FAKE.ownerKeyId, dry_run: true })).toMatchObject({
			operation: 'keys.revoke'
		});
		await api.keys.revoke({ key_id: FAKE.ownerKeyId });
		expect(fake.keys.has(FAKE.ownerKeyId)).toBe(false);
		expect(await code(api.keys.revoke({ key_id: 'AKVLNOSUCHKEY0000000' }))).toBe('key_not_found');
		expect(problems).toEqual([]);
	});

	it('refuses to delete the workspace', async () => {
		const { api } = setup();
		expect(await code(api.account.delete({ dry_run: true }))).toBe('role_forbidden');
		expect(await code(api.account.delete())).toBe('role_forbidden');
	});

	it('presigns downloads the service accepts, and only those', async () => {
		const { api, fake, problems } = setup();
		const p = await api.objects.presign({
			body: { bucket: 'files', key: 'docs/readme.txt', method: 'GET', expires_in_seconds: 300 }
		});
		expect(p.url).toMatch(
			new RegExp(`^http://${FAKE.host}/files/docs/readme\\.txt\\?X-Amz-Algorithm=`)
		);
		const ok = await fake.fetch(new Request(p.url));
		expect(ok.status).toBe(200);
		expect(await ok.text()).toBe('Read me first.\n');
		expect((await fake.fetch(new Request(p.url.replace('readme', 'readmf')))).status).toBe(403);
		const later = Date.now() + 301_000;
		fake.now = () => later;
		expect((await fake.fetch(new Request(p.url))).status).toBe(403);
		expect(
			await code(
				api.objects.presign({
					body: { bucket: 'files', key: 'nope.txt', method: 'GET', expires_in_seconds: 60 }
				})
			)
		).toBe('not_found');
		expect(
			await code(
				api.objects.presign({
					body: {
						bucket: 'nntune',
						key: 'library/track.flac',
						method: 'GET',
						expires_in_seconds: 60
					}
				})
			)
		).toBe('bucket_not_found');
		expect(problems).toEqual([]);
	});

	it('reports counters that are still being rebuilt', async () => {
		const { tenant, fake } = setup();
		fake.seeded = false;
		expect((await tenant.usage()).seeded).toBe(false);
	});
});

describe('tenant0 files', () => {
	it('lists folders and files a page at a time', async () => {
		const { files } = setup();
		const root = await files.list('files', '');
		expect(root.folders.map((f) => f.name)).toEqual(['docs', 'many', 'photos']);
		expect(root.files.map((f) => f.name)).toEqual(['notes.txt']);
		const first = await files.list('files', 'many/');
		expect(first.files).toHaveLength(200);
		expect(first.next).toBeTruthy();
		const second = await files.list('files', 'many/', first.next!);
		expect(second.files).toHaveLength(30);
		expect(second.next).toBeNull();
		expect(await code(files.list('nntune', ''))).toBe('file:404');
		expect(await code(files.list('files', '../'))).toBe('file:400');
	});

	it('uploads a small file once, under a token bound to bucket, name and size', async () => {
		const { files, fake } = setup();
		const body = new TextEncoder().encode('hello');
		const t = await files.startUpload(
			'files',
			'up/hello.txt',
			body.length,
			'text/plain',
			'https://console.example'
		);
		expect(t.method).toBe('PUT');
		if (t.method !== 'PUT') return;
		const token = new URL(t.url).searchParams.get('t');
		const g = await files.uploadGrant('files', token, 'put');
		expect(await code(files.uploadGrant('scratch', token, 'put'))).toBe('file:403');
		expect(await code(files.uploadGrant('files', `${token}x`, 'put'))).toBe('file:403');
		expect(await code(files.uploadGrant('files', token, 'multipart'))).toBe('file:403');
		expect(await code(files.putObject(g, stream(body), body.length + 1))).toBe('file:400');
		await files.putObject(g, stream(body), body.length);
		expect(
			new TextDecoder().decode(fake.buckets.get('files')!.objects.get('up/hello.txt')!.body)
		).toBe('hello');
		// Never replaces a file.
		expect(
			await code(files.startUpload('files', 'up/hello.txt', 5, 'text/plain', 'https://c'))
		).toBe('file:409');
		expect(await code(files.putObject(g, stream(body), body.length))).toBe('file:409');
	});

	it('uploads a large file in parts of the exact size', async () => {
		const { files, fake } = setup();
		const size = PART_SIZE + 5;
		const t = await files.startUpload(
			'files',
			'big.bin',
			size,
			'application/octet-stream',
			'https://c'
		);
		expect(t).toMatchObject({ method: 'MULTIPART', part_count: 2, part_size: PART_SIZE });
		if (t.method !== 'MULTIPART') return;
		const g = await files.uploadGrant('files', t.token, 'multipart');
		expect(await code(files.putPart(g, 2, stream(new Uint8Array(4)), 4))).toBe('file:400');
		expect(await code(files.putPart(g, 3, stream(new Uint8Array(5)), 5))).toBe('file:400');
		const one = await files.putPart(g, 1, stream(new Uint8Array(PART_SIZE).fill(7)), PART_SIZE);
		const two = await files.putPart(g, 2, stream(new Uint8Array(5).fill(9)), 5);
		expect(await code(files.complete(g, [{ part: 1, etag: one!.etag }]))).toBe('file:400');
		await files.complete(g, [
			{ part: 1, etag: one!.etag },
			{ part: 2, etag: two!.etag }
		]);
		expect(fake.buckets.get('files')!.objects.get('big.bin')!.body.length).toBe(size);
	});

	it('deletes exactly the files the confirmation listed, at the versions it showed', async () => {
		const { files, fake } = setup();
		const c = await files.confirmDelete('files', ['notes.txt', 'docs/readme.txt', 'gone.txt']);
		expect(c.items.map((i) => i.key)).toEqual(['notes.txt', 'docs/readme.txt']);
		expect(c.missing).toEqual(['gone.txt']);
		// A list that differs from the confirmed one is refused whole.
		expect(
			await code(
				files.deleteFiles(
					'files',
					[...c.items, { ...c.items[0]!, key: 'photos/beach.jpg' }],
					c.token
				)
			)
		).toBe('file:403');
		expect(await code(files.deleteFiles('files', c.items.slice(0, 1), c.token))).toBe('file:403');
		expect(await code(files.deleteFiles('scratch', c.items, c.token))).toBe('file:403');
		expect(fake.buckets.get('files')!.objects.has('notes.txt')).toBe(true);
		// A file changed after the page was shown is kept.
		fake.buckets.get('files')!.objects.get('docs/readme.txt')!.etag = '"changed"';
		const r = await files.deleteFiles('files', c.items, c.token);
		expect(r).toEqual({ deleted: ['notes.txt'], skipped: ['docs/readme.txt'], failed: [] });
		expect(fake.buckets.get('files')!.objects.has('docs/readme.txt')).toBe(true);
		expect(await code(files.confirmDelete('files', []))).toBe('file:400');
		expect(
			await code(
				files.confirmDelete(
					'files',
					Array.from({ length: 51 }, (_, i) => `f${i}`)
				)
			)
		).toBe('file:400');
	});

	it('still aborts a multipart upload after its token expired, and nothing else', async () => {
		const { files, fake, tenant, storage, cfg } = setup();
		const t = await files.startUpload(
			'files',
			'left.bin',
			PART_SIZE * 2,
			'application/octet-stream',
			'https://c'
		);
		if (t.method !== 'MULTIPART') throw new Error('expected multipart');
		const later = new Tenant0Files(
			tenant,
			storage,
			tokenKey(cfg.storage.secret),
			() => Date.now() + 13 * 3600_000
		);
		expect(await code(later.uploadGrant('files', t.token, 'multipart'))).toBe('file:403');
		const g = await later.uploadGrant('files', t.token, 'multipart', { expired: true });
		expect(fake.buckets.get('files')!.uploads.size).toBe(1);
		await later.abort(g);
		expect(fake.buckets.get('files')!.uploads.size).toBe(0);
		expect(
			await code(later.uploadGrant('files', `${t.token}x`, 'multipart', { expired: true }))
		).toBe('file:403');
	});

	it('lists and stops unfinished uploads, so the bucket can be deleted', async () => {
		const { files, fake, api } = setup();
		await api.buckets.create({ body: { name: 'left' } });
		await files.startUpload(
			'left',
			'a.bin',
			PART_SIZE * 2,
			'application/octet-stream',
			'https://c'
		);
		fake.buckets.get('left')!.held = false;
		expect(await files.openUploads('left')).toBe(1);
		expect(await code(api.buckets.delete({ bucket: 'left', dry_run: true }))).toBe(
			'bucket_not_empty'
		);
		expect(await files.stopOpenUploads('left')).toBe(1);
		expect(await files.openUploads('left')).toBe(0);
		await api.buckets.delete({ bucket: 'left' });
		expect(fake.buckets.has('left')).toBe(false);
	});

	it('confirms and deletes 50 files with long paths', async () => {
		const { files, fake } = setup();
		const b = fake.buckets.get('files')!;
		const keys = Array.from({ length: 50 }, (_, i) => `${'deep/'.repeat(40)}file-${i}.bin`);
		for (const k of keys)
			b.objects.set(k, {
				body: new Uint8Array(1),
				type: 't',
				etag: `"${'e'.repeat(32)}"`,
				modified: 0
			});
		const c = await files.confirmDelete('files', keys);
		expect(c.token.length).toBeLessThan(400);
		const r = await files.deleteFiles('files', c.items, c.token);
		expect(r.deleted).toHaveLength(50);
	});

	it('opens an empty bucket the counters do not list yet', async () => {
		const { files, fake } = setup();
		fake.buckets.set('fresh', {
			name: 'fresh',
			id: 'b_fresh',
			created: 0,
			objects: new Map(),
			uploads: new Map(),
			held: false
		});
		expect((await files.otherBuckets()).map((b) => b.name)).not.toContain('fresh');
		await files.connect('fresh', 'read_write');
		expect(await files.access('fresh')).toBe('read_write');
	});

	it('connects a bucket read-only, then widens it; never narrows', async () => {
		const { files, fake } = setup();
		expect((await files.otherBuckets()).map((b) => b.name)).toEqual(['nntune']);
		await files.connect('nntune', 'read');
		expect(await files.access('nntune')).toBe('read');
		expect((await files.list('nntune', 'library/')).files.map((f) => f.name)).toEqual([
			'track.flac'
		]);
		expect(await code(files.startUpload('nntune', 'x.txt', 1, 'text/plain', 'https://c'))).toBe(
			'file:403'
		);
		expect(await code(files.confirmDelete('nntune', ['library/track.flac']))).toBe('file:403');
		await files.connect('nntune', 'read_write');
		expect(fake.keys.get(FAKE.consoleKeyId)!.grants.get('nntune')).toBe('rw');
		await files.connect('nntune', 'read');
		expect(fake.keys.get(FAKE.consoleKeyId)!.grants.get('nntune')).toBe('rw');
		expect(await code(files.connect('no-such', 'read'))).toBe('file:404');
	});
});
