// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Kofra } from '@kofra/api';
import type { DemoApi } from '@kofra/api/demo';
import type { BillingConfig } from '#lib/server/config.js';

declare global {
	namespace App {
		interface Locals {
			/** The API client: the SDK, here over the demo transport. */
			api: Kofra;
			/** Demo-only file listing and uploads (not in the API contract yet). */
			demo: DemoApi;
			billing: BillingConfig;
			/** Set when a request cleared the demo cookie; the hook then does not save state. */
			demoReset?: boolean;
		}
		interface Error {
			message: string;
			hint?: string;
			requestId?: string;
		}
	}
}

export {};
