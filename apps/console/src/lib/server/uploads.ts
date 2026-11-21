// Shared parts of the upload routes: tenant0 only (the demo's uploads go to /demo-files).
import { error, json } from '@sveltejs/kit';
import { FileError } from './files.js';
import { Tenant0Files } from './tenant0/files.js';

export function tenantFiles(locals: App.Locals): Tenant0Files {
	if (!(locals.files instanceof Tenant0Files)) error(404, { message: 'Not found.' });
	return locals.files;
}

/** The declared body length, which must be present and exact. */
export function declaredLength(request: Request): number {
	const raw = request.headers.get('content-length');
	if (raw === null || !/^[0-9]{1,15}$/.test(raw))
		error(411, { message: 'The upload needs a length.' });
	return Number(raw);
}

/** Runs an upload step and answers JSON; a refusal keeps its status and words. */
export async function answer(step: () => Promise<unknown>) {
	try {
		return json((await step()) ?? { ok: true });
	} catch (err) {
		if (err instanceof FileError)
			return json({ message: err.message, hint: err.hint }, { status: err.status });
		throw err;
	}
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
	if (!(request.headers.get('content-type') ?? '').startsWith('application/json'))
		error(415, { message: 'Send JSON.' });
	const text = await request.text();
	if (text.length > 1_000_000) error(413, { message: 'Too large.' });
	try {
		const v: unknown = JSON.parse(text);
		if (typeof v === 'object' && v !== null && !Array.isArray(v))
			return v as Record<string, unknown>;
	} catch {
		/* refused below */
	}
	error(400, { message: 'Send a JSON object.' });
}
