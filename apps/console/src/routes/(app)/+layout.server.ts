import { loadFailed } from '#lib/server/api.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, route }) => {
	try {
		const live = locals.mode === 'live' || locals.mode === 'live-fake';
		// A live workspace still being set up has no storage to ask yet.
		const workspaceReady = !live || locals.member?.state === 'active';
		const account =
			workspaceReady && route.id !== '/(app)/account' ? await locals.api.account.get() : null;
		return {
			account,
			workspace: locals.workspace.name,
			ws: locals.workspace,
			workspaceReady,
			mode: locals.mode,
			csrf: locals.me?.csrf
		};
	} catch (err) {
		loadFailed(err);
	}
};
