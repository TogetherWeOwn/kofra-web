// The Kofra API client for TypeScript and JavaScript.
import { Core, type ClientOptions } from './core.ts';
import { resources } from './operations.ts';

export { KofraError, type Problem, type ClientOptions, type CallOptions } from './core.ts';
export type { Plan } from './operations.ts';
export type { components, operations, paths } from './schema.ts';

/** `const kofra = new Kofra({ token })`, then `await kofra.buckets.list()`. */
export class Kofra {
	readonly core: Core;
	readonly account;
	readonly buckets;
	readonly keys;
	readonly usage;
	readonly events;
	readonly objects;

	constructor(options: ClientOptions = {}) {
		this.core = new Core(options);
		const r = resources(this.core);
		this.account = r.account;
		this.buckets = r.buckets;
		this.keys = r.keys;
		this.usage = r.usage;
		this.events = r.events;
		this.objects = r.objects;
	}
}

interface Page<T> {
	data: T[];
	next_cursor: string | null;
}

/**
 * Every item of a cursor-paged list:
 * `for await (const b of paginate((a) => kofra.buckets.list(a))) ...`.
 * Stops at the end of the list, or when a page comes back empty (the event
 * feed always returns a cursor to poll from).
 */
export async function* paginate<T, A extends { cursor?: string }>(
	list: (args: A) => Promise<Page<T>>,
	args: A = {} as A
): AsyncGenerator<T> {
	let cursor = args.cursor;
	for (;;) {
		const page = await list({ ...args, cursor });
		// A non-empty page that hands back the cursor it was fetched with would
		// repeat forever; refuse it before yielding its rows.
		if (page.data.length > 0 && cursor !== undefined && page.next_cursor === cursor)
			throw new Error(
				'Kofra: the list returned the same cursor again; stopping instead of looping.'
			);
		yield* page.data;
		if (!page.next_cursor || page.data.length === 0) return;
		cursor = page.next_cursor;
	}
}
