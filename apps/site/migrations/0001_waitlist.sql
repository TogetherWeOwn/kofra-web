-- Early-access waitlist (see src/lib/server/waitlist.ts for the storage rationale).
-- No plaintext address: email_hash is an HMAC with a Worker secret, email_enc is AES-256-GCM.
CREATE TABLE waitlist (
	email_hash TEXT PRIMARY KEY,
	-- NULL once the row is suppressed: only the keyed hash is left.
	email_enc TEXT,
	status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'suppressed')),
	token_hash TEXT,
	token_expires_at INTEGER,
	-- First request for this address; never moved, so retention cannot be extended.
	created_at INTEGER NOT NULL,
	confirmed_at INTEGER,
	last_sent_at INTEGER NOT NULL,
	-- Confirmation emails sent for this row; capped in src/lib/server/waitlist.ts.
	send_count INTEGER NOT NULL DEFAULT 0,
	CHECK (status = 'suppressed' OR email_enc IS NOT NULL)
) STRICT;

CREATE UNIQUE INDEX waitlist_token ON waitlist (token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX waitlist_unconfirmed_created ON waitlist (status, created_at) WHERE status <> 'confirmed';
-- For the daily send cap (rows with a recent send).
CREATE INDEX waitlist_last_sent ON waitlist (last_sent_at);
