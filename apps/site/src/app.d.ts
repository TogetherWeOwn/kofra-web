// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	/** Build-time indexing switch, defined in vite.config.ts (see src/lib/site.ts). */
	const __KOFRA_INDEXABLE__: boolean;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
