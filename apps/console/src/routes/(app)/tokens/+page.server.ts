import { tokensPort } from '#lib/server/api-tokens.js';
import { loadFailed } from '#lib/server/api.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
	tokens: await tokensPort(event).list().catch(loadFailed),
	user: event.locals.me?.user.id ?? 'demo',
	crumbs: [{ label: 'API tokens' }]
});
