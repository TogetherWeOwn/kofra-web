// Waitlist retention: the one place that deletes by age. Used by the sign-up path
// (src/lib/server/waitlist.ts) and by the hourly cron trigger of the entry Worker.

// Plain JavaScript (types in JSDoc): scripts/postbuild.mjs copies this file next to the Worker
// entry, because wrangler does not re-bundle the adapter output. It must not import anything.

/** An unconfirmed sign-up loses its address this long after the first request for it. */
export const PENDING_RETENTION_S = 7 * 24 * 60 * 60;
/**
 * After that, only the keyed hash stays for this long ("suppressed"), so the same address
 * cannot be sent confirmation emails again straight away. Then the row is deleted.
 */
export const SUPPRESSION_S = 30 * 24 * 60 * 60;

/**
 * @typedef {{ prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } }} PurgeDb
 */

/**
 * Applies the retention rules at `now` (seconds since the epoch). Confirmed rows are never
 * touched. Safe to run at any time and any number of times.
 * @param {PurgeDb} db
 * @param {number} now
 */
export async function purgeExpired(db, now) {
	await db
		.prepare(
			`UPDATE waitlist SET status = 'suppressed', email_enc = NULL, token_hash = NULL,
			   token_expires_at = NULL
			 WHERE status = 'pending' AND created_at < ?`
		)
		.bind(now - PENDING_RETENTION_S)
		.run();
	await db
		.prepare("DELETE FROM waitlist WHERE status = 'suppressed' AND created_at < ?")
		.bind(now - PENDING_RETENTION_S - SUPPRESSION_S)
		.run();
}

/**
 * Cron handler of the entry Worker. Runs whenever the database is bound, also while the form is
 * switched off: addresses collected earlier must still be deleted on time. Without the binding
 * there is nothing to do. It reads no secret and never decrypts anything.
 * @param {unknown} _controller
 * @param {{ WAITLIST_DB?: PurgeDb }} env
 */
export async function purgeScheduled(_controller, env) {
	if (!env.WAITLIST_DB) return;
	await purgeExpired(env.WAITLIST_DB, Math.floor(Date.now() / 1000));
}
