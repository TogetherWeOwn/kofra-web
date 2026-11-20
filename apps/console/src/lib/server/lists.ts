// Lists the API returns oldest first (daily usage, the event feed): helpers that read the
// newest part without assuming the first page is the latest one.
import type { ApiEvent, Kofra, UsageDay } from '@kofra/api';

const DAY = 86_400_000;

/** The last `days` days of usage, oldest first. */
export async function recentDays(api: Kofra, days: number, now = Date.now()): Promise<UsageDay[]> {
	const after = new Date(now - (days + 1) * DAY).toISOString().slice(0, 10);
	const out: UsageDay[] = [];
	let cursor: string | undefined;
	do {
		const page = await api.usage.days({ after, limit: 200, cursor });
		out.push(...page.data);
		cursor = page.next_cursor ?? undefined;
	} while (cursor);
	return out.slice(-days);
}

/** Every day of usage the API holds, oldest first (for the CSV export). */
export async function allDays(api: Kofra): Promise<UsageDay[]> {
	const out: UsageDay[] = [];
	let cursor: string | undefined;
	do {
		const page = await api.usage.days({ limit: 200, cursor });
		out.push(...page.data);
		cursor = page.next_cursor ?? undefined;
	} while (cursor);
	return out;
}

/**
 * The newest `n` events, newest first. The feed always returns a cursor to poll from, so
 * reading stops at an empty page, and after `maxPages` pages as a bound on work per view.
 * TODO(api): ask for a newest-first view of the feed, so this need not read from the start.
 */
export async function latestEvents(api: Kofra, n: number, maxPages = 10): Promise<ApiEvent[]> {
	const keep: ApiEvent[] = [];
	let cursor: string | undefined;
	for (let i = 0; i < maxPages; i++) {
		const page = await api.events.list({ limit: 200, cursor });
		if (page.data.length === 0) break;
		keep.push(...page.data);
		keep.splice(0, Math.max(0, keep.length - n));
		if (!page.next_cursor || page.next_cursor === cursor) break;
		cursor = page.next_cursor;
	}
	return keep.reverse();
}
