// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	/** Build-time indexing switch, defined in vite.config.ts (see src/lib/site.ts). */
	const __KOFRA_INDEXABLE__: boolean;
	/** Build-time: the waitlist form is rendered (wrangler.jsonc vars; see docs/waitlist.md). */
	const __KOFRA_WAITLIST__: boolean;
	const __KOFRA_TURNSTILE_SITE_KEY__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
