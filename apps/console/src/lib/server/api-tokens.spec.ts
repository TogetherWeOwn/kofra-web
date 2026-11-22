import { isHttpError } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import { liveTokensPort } from './api-tokens.js';

type Seen = { method: string; path: string; headers: Headers; body: unknown };

function upstream(answers: Response[]) {
	const seen: Seen[] = [];
	const apiFetch = async (path: string, init?: RequestInit) => {
		seen.push({
			method: init?.method ?? 'GET',
			path,
			headers: new Headers(init?.headers),
			body: init?.body ? JSON.parse(String(init.body)) : undefined
		});
		return answers.shift()!;
	};
	return { seen, port: liveTokensPort(apiFetch) };
}

const token = (id: string) => ({
	id,
	name: id,
	scopes: ['buckets:read'],
	buckets: null,
	allowed_ips: null,
	agent: false,
	created_by: 'usr_1',
	created_at: '2026-11-22T00:00:00Z',
	expires_at: null,
	last_used_at: null
});

describe('API tokens in live mode', () => {
	it('reads every page of the list', async () => {
		const { seen, port } = upstream([
			Response.json({ data: [token('tok_a')], next_cursor: 'c1' }),
			Response.json({ data: [token('tok_b')], next_cursor: null })
		]);
		expect((await port.list()).map((t) => t.id)).toEqual(['tok_a', 'tok_b']);
		expect(seen.map((s) => s.path)).toEqual([
			'/v1/tokens?limit=100',
			'/v1/tokens?limit=100&cursor=c1'
		]);
	});

	it('creates with an idempotency key and revokes by ID', async () => {
		const { seen, port } = upstream([
			Response.json({ ...token('tok_c'), token: 'kofra_tok_secret' }, { status: 201 }),
			new Response(null, { status: 204 })
		]);
		const created = await port.create({ name: 'ci', scopes: ['buckets:read'] });
		expect(created.token).toBe('kofra_tok_secret');
		expect(seen[0]!.method).toBe('POST');
		expect(seen[0]!.body).toEqual({ name: 'ci', scopes: ['buckets:read'] });
		expect(seen[0]!.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
		await port.revoke('tok_c');
		expect(seen[1]).toMatchObject({ method: 'DELETE', path: '/v1/tokens/tok_c' });
	});

	it('turns a refusal into an error page with the API status', async () => {
		const { port } = upstream([
			Response.json(
				{ status: 403, code: 'role_forbidden', title: 'Forbidden', detail: 'Your role cannot.' },
				{ status: 403, headers: { 'Kofra-Request-Id': 'req_1' } }
			)
		]);
		const err = await port.create({ name: 'x', scopes: ['keys:write'] }).catch((e: unknown) => e);
		expect(isHttpError(err) && err.status).toBe(403);
		expect(isHttpError(err) && err.body).toMatchObject({
			message: 'Your role cannot.',
			requestId: 'req_1'
		});
	});

	it('never sends an ID that is not a token ID', async () => {
		const { seen, port } = upstream([]);
		const err = await port.revoke('../keys/x').catch((e: unknown) => e);
		expect(isHttpError(err) && err.status).toBe(404);
		expect(seen).toHaveLength(0);
	});
});
