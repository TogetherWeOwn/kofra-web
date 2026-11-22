import { KofraError } from '@kofra/api';
import { expect, it, vi } from 'vitest';
import { load } from './+page.server.js';

vi.mock('$app/paths', () => ({
	resolve: (id: string) => id
}));

it.each([
	[[], 'Your role does not allow this'],
	[['example'], 'This bucket is protected']
])('shows the delete refusal for protected buckets %j', async (protectedBuckets, title) => {
	const bucket = { name: 'example' };
	const result = await load({
		params: { bucket: bucket.name },
		locals: {
			workspace: { protectedBuckets },
			api: {
				buckets: {
					get: async () => bucket,
					delete: async () => {
						throw new KofraError({
							type: 't',
							title: 'Forbidden',
							status: 403,
							code: 'role_forbidden',
							detail: 'Deleting this bucket is forbidden.',
							hint: '',
							docs_url: 'u',
							request_id: 'req_1',
							retryable: false
						});
					}
				}
			}
		}
	} as unknown as Parameters<typeof load>[0]);

	expect(result).toMatchObject({ blockedTitle: title, plan: null });
});
