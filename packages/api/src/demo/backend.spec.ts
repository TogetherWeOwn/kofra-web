import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import spec from '../../vendor/openapi.json';
import { Kofra, KofraError } from '../index.ts';
import { DemoApi, DemoLimit, DEMO_TOKEN } from './backend.ts';
import {
	decodeState,
	emptyState,
	encodeState,
	fits,
	MAX_STATE_BYTES,
	type DemoState
} from './state.ts';

const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => void;
const SPEC_ID = 'https://api.kofra.app/openapi.json';
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: true });
addFormats(ajv);
ajv.addSchema({ ...spec, $id: SPEC_ID });

type Op = {
	method: string;
	template: string;
	re: RegExp;
	id: string;
	node: Record<string, unknown>;
};
const OPS: Op[] = Object.entries(
	spec.paths as unknown as Record<string, Record<string, Record<string, unknown>>>
).flatMap(([template, item]) =>
	Object.entries(item)
		.filter(([m]) => ['get', 'post', 'patch', 'delete', 'put'].includes(m))
		.map(([m, node]) => ({
			method: m.toUpperCase(),
			template,
			re: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`),
			id: node.operationId as string,
			node
		}))
);

const ptr = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1');
const validator = (pointer: string) =>
	ajv.getSchema(`${SPEC_ID}#${pointer}`) ?? ajv.compile({ $ref: `${SPEC_ID}#${pointer}` });

const NOW = Date.parse('2026-11-20T12:00:00Z');

/** A demo client whose every request and response is checked against the contract. */
function harness(state: DemoState = emptyState()) {
	const demo = new DemoApi(state, { now: () => NOW });
	const problems: string[] = [];
	const covered = new Set<string>();
	const checkedFetch: typeof fetch = async (input, init) => {
		const req = new Request(input, init);
		const url = new URL(req.url);
		const op = OPS.find((o) => o.method === req.method && o.re.test(url.pathname));
		const reqBody =
			req.method === 'GET' || req.method === 'DELETE' ? undefined : await req.clone().text();
		const res = await demo.fetch(req);
		if (!op) {
			problems.push(`no operation for ${req.method} ${url.pathname}`);
			return res;
		}
		covered.add(op.id);
		const base = `/paths/${ptr(op.template)}/${op.method.toLowerCase()}`;
		// Requests the demo refused are wrong on purpose; only accepted ones must be valid.
		if (reqBody && res.ok) {
			const v = validator(`${base}/requestBody/content/application~1json/schema`);
			if (!v(JSON.parse(reqBody))) problems.push(`${op.id} request: ${ajv.errorsText(v.errors)}`);
		}
		const status = String(res.status);
		const responses = op.node.responses as Record<string, { content?: Record<string, unknown> }>;
		if (!responses[status]) problems.push(`${op.id}: undeclared status ${status}`);
		const text = await res.clone().text();
		const type = res.headers.get('content-type') ?? '';
		const declared = responses[status]?.content ?? {};
		if (Object.keys(declared).length === 0) {
			if (text) problems.push(`${op.id} ${status}: body on a response declared without one`);
		} else if (!text) {
			problems.push(`${op.id} ${status}: empty body on a response declared with one`);
		} else {
			const media = type.split(';')[0]!.trim();
			if (!(media in declared)) problems.push(`${op.id} ${status}: undeclared ${type}`);
			else {
				const v = validator(`${base}/responses/${status}/content/${ptr(media)}/schema`);
				if (!v(JSON.parse(text))) problems.push(`${op.id} ${status}: ${ajv.errorsText(v.errors)}`);
			}
		}
		return res;
	};
	const client = new Kofra({
		token: DEMO_TOKEN,
		baseUrl: 'https://api.kofra.app',
		fetch: checkedFetch,
		maxRetries: 0
	});
	return { demo, client, problems, covered };
}

async function problemCode(p: Promise<unknown>): Promise<string> {
	try {
		await p;
	} catch (err) {
		if (err instanceof KofraError) return err.code;
		throw err;
	}
	throw new Error('expected a KofraError');
}

describe('demo API', () => {
	it('answers every contract operation with contract-valid bodies', async () => {
		const { client, problems, covered } = harness();
		const account = await client.account.get();
		expect(account.state).toBe('active');

		const list = await client.buckets.list();
		expect(list.data.map((b) => b.name)).toEqual([
			'backups',
			'family-photos',
			'media-archive',
			'projects',
			'shared-docs'
		]);
		expect((await client.buckets.list({ limit: 2 })).next_cursor).toBe('c2');
		expect((await client.buckets.list({ limit: 3, cursor: 'c2' })).next_cursor).toBeNull();

		const created = await client.buckets.create({ body: { name: 'new-bucket' } });
		expect(created).toMatchObject({ name: 'new-bucket', object_count: 0, stored_bytes: 0 });
		expect((await client.buckets.get({ bucket: 'new-bucket' })).name).toBe('new-bucket');
		const plan = await client.buckets.delete({ bucket: 'new-bucket', dry_run: true });
		expect(plan).toMatchObject({ dry_run: true, operation: 'buckets.delete', reversible: false });
		expect(await client.buckets.delete({ bucket: 'new-bucket' })).toBeUndefined();
		expect(await problemCode(client.buckets.get({ bucket: 'new-bucket' }))).toBe(
			'bucket_not_found'
		);
		expect(await problemCode(client.buckets.delete({ bucket: 'backups' }))).toBe(
			'bucket_not_empty'
		);
		expect(await problemCode(client.buckets.create({ body: { name: 'backups' } }))).toBe(
			'bucket_already_exists'
		);
		expect(await problemCode(client.buckets.create({ body: { name: 'Bad_Name' } }))).toBe(
			'invalid_bucket_name'
		);

		const key = await client.keys.create({
			body: { name: 'ci', grants: [{ bucket: 'projects', access: 'read' }] }
		});
		expect(key.secret_access_key).toMatch(/^[A-Za-z0-9]{40}$/);
		expect(key.id).toMatch(/^KF[A-Z0-9]{14}$/);
		const keys = await client.keys.list();
		expect(keys.data[0]!.id).toBe(key.id);
		expect(JSON.stringify(keys)).not.toContain(key.secret_access_key!);
		const widened = await client.keys.update({
			key_id: key.id,
			body: { grants: [{ bucket: 'projects', access: 'read_write' }] }
		});
		expect(widened.grants).toEqual([{ bucket: 'projects', access: 'read_write' }]);
		expect(
			await problemCode(
				client.keys.update({
					key_id: key.id,
					body: { grants: [{ bucket: 'projects', access: 'read' }] }
				})
			)
		).toBe('grant_narrowing_refused');
		expect(await client.keys.revoke({ key_id: key.id, dry_run: true })).toMatchObject({
			operation: 'keys.revoke'
		});
		expect(await client.keys.revoke({ key_id: key.id })).toBeUndefined();
		expect(await problemCode(client.keys.revoke({ key_id: key.id }))).toBe('key_not_found');

		const usage = await client.usage.get();
		const buckets = (await client.buckets.list()).data;
		expect(usage.stored_bytes).toBe(buckets.reduce((n, b) => n + b.stored_bytes, 0));
		const days = await client.usage.days();
		expect(days.data).toHaveLength(30);
		expect(days.data.at(-1)!.status).toBe('provisional');
		expect(days.data.at(-1)!.day).toBe('2026-11-20');
		expect((await client.usage.days({ after: '2026-11-18' })).data.map((d) => d.day)).toEqual([
			'2026-11-19',
			'2026-11-20'
		]);
		expect((await client.usage.buckets()).data).toHaveLength(5);
		const events = await client.events.list();
		expect(events.next_cursor).not.toBeNull();
		expect(events.data.some((e) => e.type === 'bucket.created')).toBe(true);

		const url = await client.objects.presign({
			body: { bucket: 'backups', key: 'README.txt', method: 'GET', expires_in_seconds: 60 }
		});
		expect(url.expires_at).toBe('2026-11-20T12:01:00Z');
		expect(
			await problemCode(
				client.objects.presign({
					body: { bucket: 'nope', key: 'x', method: 'GET', expires_in_seconds: 60 }
				})
			)
		).toBe('bucket_not_found');

		expect(await client.account.delete({ dry_run: true })).toMatchObject({
			operation: 'account.delete'
		});
		const deletion = await client.account.delete();
		expect(deletion).toMatchObject({ status: 'pending_confirmation', reason: 'customer' });
		expect(await problemCode(client.account.delete())).toBe('deletion_already_requested');
		expect((await client.account.get()).deletion?.status).toBe('pending_confirmation');
		expect((await client.account.cancelDeletion()).deletion).toBeNull();
		expect(await problemCode(client.account.cancelDeletion())).toBe('deletion_not_requested');

		expect(problems).toEqual([]);
		expect([...covered].sort()).toEqual(OPS.map((o) => o.id).sort());
	});

	it('refuses requests without a token, unknown parameters and bad cursors', async () => {
		const { demo, client, problems } = harness();
		const res = await demo.fetch('https://api.kofra.app/v1/account');
		expect(res.status).toBe(401);
		expect(res.headers.get('www-authenticate')).toContain('Bearer');
		const unknown = await demo.fetch('https://api.kofra.app/v1/buckets?sort=name', {
			headers: { authorization: `Bearer ${DEMO_TOKEN}` }
		});
		expect(unknown.status).toBe(400);
		expect(((await unknown.json()) as { code: string }).code).toBe('unknown_field');
		expect(await problemCode(client.buckets.list({ cursor: 'nope' }))).toBe('invalid_cursor');
		expect(problems).toEqual([]);
	});

	it('records changes in the state and marks it dirty', async () => {
		const { demo, client } = harness();
		expect(demo.dirty).toBe(false);
		await client.buckets.list();
		expect(demo.dirty).toBe(false);
		await client.buckets.create({ body: { name: 'kept' } });
		expect(demo.dirty).toBe(true);
		const again = harness(decodeState(encodeState(demo.state)));
		expect((await again.client.buckets.list()).data.map((b) => b.name)).toContain('kept');
	});

	it('never stores a key secret in the state', async () => {
		const { demo, client } = harness();
		const key = await client.keys.create({
			body: { grants: [{ bucket: 'backups', access: 'read' }] }
		});
		expect(encodeState(demo.state)).not.toContain(key.secret_access_key!);
		expect(JSON.stringify(demo.state)).not.toContain(key.secret_access_key!);
	});

	it('stops at the demo limits instead of overflowing the cookie', async () => {
		const { demo, client } = harness();
		for (let i = 0; i < 7; i++)
			await client.buckets.create({ body: { name: `b-${i}-${'x'.repeat(50)}` } });
		await expect(client.buckets.create({ body: { name: 'one-too-many' } })).rejects.toBeInstanceOf(
			DemoLimit
		);
		expect(fits(demo.state)).toBe(true);
		const filler = 'f'.repeat(900);
		let refused = null;
		for (let i = 0; i < 30 && !refused; i++)
			refused = demo.recordUpload('backups', `${filler}-${i}`, 1, 'text/plain');
		expect(refused).toBe('demo_full');
		expect(encodeState(demo.state).length).toBeLessThanOrEqual(MAX_STATE_BYTES);
	});

	it('lists files and folders under a prefix, uploads included', () => {
		const { demo } = harness();
		expect(demo.listFiles('backups', '')).toMatchObject({
			folders: [
				{ prefix: 'laptop/', name: 'laptop' },
				{ prefix: 'server/', name: 'server' }
			],
			files: [{ key: 'README.txt', name: 'README.txt', size: 1204 }]
		});
		expect(demo.recordUpload('backups', 'laptop/notes.md', 42, 'text/markdown')).toBeNull();
		expect(demo.listFiles('backups', 'laptop/')!.files.map((f) => f.name)).toContain('notes.md');
		expect(demo.file('backups', 'laptop/notes.md')).toMatchObject({
			size: 42,
			type: 'text/markdown'
		});
		expect(demo.recordUpload('backups', 'bad//key', 1, '')).toBe('invalid_key');
		expect(demo.recordUpload('nope', 'a', 1, '')).toBe('bucket_not_found');
		expect(demo.listFiles('nope', '')).toBeNull();
	});
});

describe('demo API edge cases', () => {
	it('changes nothing when a key edit is refused', async () => {
		const { client } = harness();
		const before = (await client.keys.list()).data.find((k) => k.id === 'KF7Q2M8X4T7R5N0B')!;
		expect(
			await problemCode(
				client.keys.update({
					key_id: 'KF7Q2M8X4T7R5N0B',
					body: {
						grants: [
							{ bucket: 'projects', access: 'read' },
							{ bucket: 'backups', access: 'read' }
						]
					}
				})
			)
		).toBe('grant_narrowing_refused');
		const after = (await client.keys.list()).data.find((k) => k.id === 'KF7Q2M8X4T7R5N0B')!;
		expect(after.grants).toEqual(before.grants);
	});

	it('refuses a key edit that would overflow the cookie', async () => {
		const { demo, client } = harness();
		for (let i = 0; i < 7; i++)
			await client.buckets.create({ body: { name: `b${i}-${'x'.repeat(55)}` } });
		const names = (await client.buckets.list()).data.map((b) => b.name);
		const key = await client.keys.create({
			body: { grants: [{ bucket: 'backups', access: 'read' }] }
		});
		const grants = names.map((bucket) => ({ bucket, access: 'read_write' as const }));
		// Fill the cookie with uploads until the demo refuses one.
		let full = null;
		for (let i = 0; i < 40 && !full; i++)
			full = demo.recordUpload('backups', `${'f'.repeat(120)}-${i}`, 1, 'text/plain');
		expect(full).toBe('demo_full');
		const snapshot = JSON.stringify(demo.state);
		await expect(client.keys.update({ key_id: key.id, body: { grants } })).rejects.toBeInstanceOf(
			DemoLimit
		);
		expect(JSON.stringify(demo.state)).toBe(snapshot);
		expect(fits(demo.state)).toBe(true);
	});

	it('drops grants on a deleted bucket', async () => {
		const { client } = harness();
		await client.buckets.create({ body: { name: 'short-lived' } });
		const key = await client.keys.create({
			body: {
				grants: [
					{ bucket: 'short-lived', access: 'read' },
					{ bucket: 'projects', access: 'read' }
				]
			}
		});
		await client.buckets.delete({ bucket: 'short-lived' });
		await client.buckets.create({ body: { name: 'short-lived' } });
		const after = (await client.keys.list()).data.find((k) => k.id === key.id)!;
		expect(after.grants).toEqual([{ bucket: 'projects', access: 'read' }]);
	});

	it('accepts any name the contract allows, including "constructor" and double hyphens', async () => {
		const { demo, client } = harness();
		await client.buckets.create({ body: { name: 'constructor' } });
		await client.buckets.create({ body: { name: 'project--backup' } });
		expect(demo.listFiles('constructor', '')).toEqual({ folders: [], files: [] });
	});

	it('changes only today when a file is uploaded, never a final day', async () => {
		const { demo, client } = harness();
		const before = (await client.usage.days()).data;
		expect(demo.recordUpload('projects', 'new.bin', 5_000, 'application/octet-stream')).toBeNull();
		const after = (await client.usage.days()).data;
		expect(after.slice(0, -1)).toEqual(before.slice(0, -1));
		expect(after.at(-1)!.peak_stored_bytes).toBe(before.at(-1)!.peak_stored_bytes + 5_000);
		expect(after.at(-1)!.uploaded_bytes).toBe(before.at(-1)!.uploaded_bytes + 5_000);
		expect((await client.usage.get()).upload_24h.used_bytes).toBe(after.at(-1)!.uploaded_bytes);
	});

	it('counts an upload over a sample file once', async () => {
		const { demo, client } = harness();
		const before = await client.buckets.get({ bucket: 'backups' });
		expect(demo.recordUpload('backups', 'README.txt', 10, 'text/plain')).toBeNull();
		const after = await client.buckets.get({ bucket: 'backups' });
		expect(after.object_count).toBe(before.object_count);
		expect(after.stored_bytes).toBe(before.stored_bytes - 1204 + 10);
	});

	it('keeps the event cursor valid when earlier events disappear', async () => {
		const { client } = harness();
		const a = await client.keys.create({
			body: { grants: [{ bucket: 'backups', access: 'read' }] }
		});
		const first = await client.events.list();
		const cursor = first.next_cursor!;
		await client.keys.revoke({ key_id: a.id });
		await client.buckets.create({ body: { name: 'after-cursor' } });
		const next = await client.events.list({ cursor });
		expect(next.data.map((e) => e.data)).toEqual([{ bucket: 'after-cursor' }]);
		const empty = await client.events.list({ cursor: next.next_cursor! });
		expect(empty.data).toEqual([]);
		expect(empty.next_cursor).toBe(next.next_cursor);
	});
});

describe('demo state', () => {
	it('round-trips and treats anything malformed as empty', () => {
		const s: DemoState = {
			...emptyState(),
			b: [['a-b', 5]],
			k: [['KFX', null, [['a-b', 'rw']], 6]],
			d: 7
		};
		expect(decodeState(encodeState(s))).toEqual(s);
		expect(decodeState(undefined)).toEqual(emptyState());
		expect(decodeState('not base64 !!')).toEqual(emptyState());
		expect(decodeState(encodeState({ ...s, v: 2 } as unknown as DemoState))).toEqual(emptyState());
		expect(decodeState(encodeState({ ...s, b: [['a', -1]] }))).toEqual(emptyState());
		expect(decodeState('x'.repeat(MAX_STATE_BYTES * 2 + 1))).toEqual(emptyState());
	});
});
