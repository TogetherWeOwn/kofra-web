import { tokensPort } from '#lib/server/api-tokens.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
	tokens: await tokensPort(event).list(),
	user: event.locals.me?.user.id ?? 'demo',
	crumbs: [{ label: 'API tokens' }]
});
