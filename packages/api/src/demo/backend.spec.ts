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
		if (text) {
			const type = res.headers.get('content-type') ?? '';
			const media = type.startsWith('application/problem+json')
				? 'application~1problem+json'
				: 'application~1json';
			const content = responses[status]?.content ?? {};
			if (!(media.replace('~1', '/') in content))
				problems.push(`${op.id} ${status}: undeclared ${type}`);
			else {
				const v = validator(`${base}/responses/${status}/content/${media}/schema`);
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
			'projects'
		]);
		expect((await client.buckets.list({ limit: 2 })).next_cursor).toBe('c2');
		expect((await client.buckets.list({ limit: 2, cursor: 'c2' })).next_cursor).toBeNull();

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
		expect((await client.usage.buckets()).data).toHaveLength(4);
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
		for (let i = 0; i < 8; i++)
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
