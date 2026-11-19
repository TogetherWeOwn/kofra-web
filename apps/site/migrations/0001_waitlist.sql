-- Early-access waitlist (see src/lib/server/waitlist.ts for the storage rationale).
-- No plaintext address: email_hash is an HMAC with a Worker secret, email_enc is AES-256-GCM.
CREATE TABLE waitlist (
	email_hash TEXT PRIMARY KEY,
	email_enc TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed')),
	token_hash TEXT,
	token_expires_at INTEGER,
	created_at INTEGER NOT NULL,
	confirmed_at INTEGER,
	last_sent_at INTEGER NOT NULL
) STRICT;

CREATE UNIQUE INDEX waitlist_token ON waitlist (token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX waitlist_pending_created ON waitlist (created_at) WHERE status = 'pending';
