import type { ApiEvent } from '@kofra/api';

const field = (e: ApiEvent, name: string) =>
	typeof e.data[name] === 'string' ? (e.data[name] as string) : '';

/** One readable line per event; an event type the console does not know yet shows as is. */
export function describeEvent(e: ApiEvent): string {
	switch (e.type) {
		case 'bucket.created':
			return `Bucket ${field(e, 'bucket')} created`;
		case 'bucket.deleted':
			return `Bucket ${field(e, 'bucket')} deleted`;
		case 'key.created':
			return `Access key ${field(e, 'key_id')} created`;
		case 'key.revoked':
			return `Access key ${field(e, 'key_id')} revoked`;
		case 'account.deletion_requested':
			return 'Workspace deletion requested';
		default:
			return e.type;
	}
}
