import { loadFailed } from '#lib/server/api.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, route }) => {
	try {
		const workspaceReady = locals.mode === 'demo' || locals.workspace?.state === 'active';
		const account =
			workspaceReady && route.id !== '/(app)/account' ? await locals.api.account.get() : null;
		return {
			account,
			workspace:
				locals.workspace?.name ?? (locals.mode === 'demo' ? 'Demo workspace' : 'Your workspace'),
			workspaceReady,
			mode: locals.mode,
			csrf: locals.me?.csrf
		};
	} catch (err) {
		loadFailed(err);
	}
};
