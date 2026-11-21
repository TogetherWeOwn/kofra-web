import { loadFailed } from '#lib/server/api.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	try {
		const account = await locals.api.account.get();
		return { account, workspace: locals.workspace.name, ws: locals.workspace };
	} catch (err) {
		loadFailed(err);
	}
};
