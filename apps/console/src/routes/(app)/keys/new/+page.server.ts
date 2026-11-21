import { resolve } from '$app/paths';
import { requireFreshStep } from '#lib/server/account/actions.js';
import { fail } from '@sveltejs/kit';
import { paginate } from '@kofra/api';
import { grantsFromForm } from '#lib/grants.js';
import { actionFailed, loadFailed } from '#lib/server/api.js';
import type { Actions, PageServerLoad } from './$types';

async function bucketNames(locals: App.Locals) {
	const names: string[] = [];
	const list = (a: { limit?: number; cursor?: string }) => locals.api.buckets.list(a);
	for await (const b of paginate(list, { limit: 200 })) names.push(b.name);
	return names;
}

export const load: PageServerLoad = async ({ locals }) => {
	try {
		return {
			buckets: await bucketNames(locals),
			crumbs: [
				{ label: 'Access keys', href: resolve('/(app)/keys') },
				{ label: 'Create access key' }
			]
		};
	} catch (err) {
		loadFailed(err);
	}
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		let names: string[];
		try {
			names = await bucketNames(locals);
		} catch (err) {
			return actionFailed(err, { name });
		}
		const grants = grantsFromForm(form, names);
		// A key that can write is a credential change: it needs a fresh step.
		if (grants.some((g) => g.access !== 'read')) requireFreshStep(locals, '/keys/new');
		const chosen = Object.fromEntries(grants.map((g) => [g.bucket, g.access]));
		if (name.length > 64) return fail(400, { name, chosen, invalid: 'name' as const });
		if (grants.length === 0) return fail(400, { name, chosen, invalid: 'grants' as const });
		try {
			const key = await locals.api.keys.create({ body: { ...(name ? { name } : {}), grants } });
			// The only time the secret exists outside the API: this one response. It is neither
			// stored nor logged; the page shows it and the hook marks the response no-store.
			return {
				created: {
					id: key.id,
					name: key.name,
					grants: key.grants,
					secret: key.secret_access_key,
					endpoint: key.s3_endpoint
				}
			};
		} catch (err) {
			return actionFailed(err, { name, chosen });
		}
	}
};
