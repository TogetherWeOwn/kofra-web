// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Kofra } from '@kofra/api';
import type { DemoApi } from '@kofra/api/demo';
import type { AccountClient } from '#lib/server/account/client.js';
import type { Resolved, WorkspaceSummary } from '#lib/server/account/types.js';
import type { BillingConfig, ConsoleConfig } from '#lib/server/config.js';
import type { FileStore } from '#lib/server/files.js';
import type { WorkspaceInfo } from '#lib/server/workspace.js';

declare global {
	namespace App {
		interface Platform {
			cf?: { country?: string };
		}
		interface Locals {
			/** The configured data source and sign-in (config.ts). */
			mode: ConsoleConfig['mode'];
			/** Live modes: the account service client, and the signed-in person. */
			account: AccountClient | null;
			me: Resolved | null;
			/** Live modes: the member's selected workspace (id, name, role, state). */
			member: WorkspaceSummary | null;
			/** The API client: the SDK, over the demo, tenant0 or live transport. */
			api: Kofra;
			/** Files in buckets: listing, uploads, deletes (not in the API contract yet). */
			files: FileStore;
			/** What this workspace's data source can show. */
			workspace: WorkspaceInfo;
			/** False while storage counters are still being rebuilt (tenant0). */
			countsComplete: () => Promise<boolean>;
			/** Demo and live-fake only. */
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
