// What the data source behind a request can show, so pages hide what has no data instead of
// showing zeros. Plain data: it goes to every page.

export interface WorkspaceInfo {
	name: string;
	kind: 'demo' | 'tenant0';
	features: {
		/** Sample data that resets (the demo notice, Reset demo). */
		sample: boolean;
		/** Upload and download totals, request counts, the daily charts and the CSV. */
		traffic: boolean;
		/** The activity feed. */
		events: boolean;
		/** Key names and last-use times. */
		keyNames: boolean;
		/** A cap on active keys worth showing. */
		keyLimit: boolean;
		/** Deleting the whole workspace from Settings. */
		workspaceDeletion: boolean;
		/** Deleting files from the file browser (behind a confirmation). */
		deleteFiles: boolean;
		/** Buckets the console cannot open yet, which can be connected. */
		connect: boolean;
		/** Billing pages. */
		billing: boolean;
	};
	/** The access key the console itself uses; it is listed but cannot be revoked. */
	consoleKeyId: string | null;
	/** Buckets that can never be deleted here. */
	protectedBuckets: string[];
}

export const DEMO_WORKSPACE: WorkspaceInfo = {
	name: 'Demo workspace',
	kind: 'demo',
	features: {
		sample: true,
		traffic: true,
		events: true,
		keyNames: true,
		keyLimit: true,
		workspaceDeletion: true,
		deleteFiles: false,
		connect: false,
		billing: true
	},
	consoleKeyId: null,
	protectedBuckets: []
};

export function tenant0Workspace(
	name: string,
	consoleKeyId: string,
	protectedBuckets: string[]
): WorkspaceInfo {
	return {
		name,
		kind: 'tenant0',
		features: {
			sample: false,
			traffic: false,
			events: false,
			keyNames: false,
			keyLimit: false,
			workspaceDeletion: false,
			deleteFiles: true,
			connect: true,
			billing: false
		},
		consoleKeyId,
		protectedBuckets
	};
}
