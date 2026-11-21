// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Kofra } from '@kofra/api';
import type { DemoApi } from '@kofra/api/demo';
import type { BillingConfig } from '#lib/server/config.js';
import type { FileStore } from '#lib/server/files.js';
import type { WorkspaceInfo } from '#lib/server/workspace.js';

declare global {
	namespace App {
		interface Locals {
			/** The API client: the SDK, over the demo or the tenant0 transport. */
			api: Kofra;
			/** Files in buckets: listing, uploads, deletes (not in the API contract yet). */
			files: FileStore;
			/** What this workspace's data source can show. */
			workspace: WorkspaceInfo;
			/** False while storage counters are still being rebuilt (tenant0). */
			countsComplete: () => Promise<boolean>;
			/** Demo mode only. */
			demo?: DemoApi;
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
