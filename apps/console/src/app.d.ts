// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Kofra } from '@kofra/api';
import type { DemoApi } from '@kofra/api/demo';
import type { AccountClient } from '#lib/server/account/client.js';
import type { Resolved, WorkspaceSummary } from '#lib/server/account/types.js';
import type { BillingConfig, ConsoleConfig } from '#lib/server/config.js';

declare global {
	namespace App {
		interface Platform {
			cf?: { country?: string };
		}
		interface Locals {
			mode: ConsoleConfig['mode'];
			account: AccountClient | null;
			me: Resolved | null;
			workspace: WorkspaceSummary | null;
			/** The workspace SDK, using the configured transport. */
			api: Kofra;
			/** Demo-only file listing and uploads (not in the API contract yet). */
			demo: DemoApi | null;
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
