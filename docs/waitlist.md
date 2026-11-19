# Early-access waitlist

The site can collect email addresses on `/early-access` and confirm them by double opt-in.
**It is off by default** (`WAITLIST_ENABLED` is `"false"` in `apps/site/wrangler.jsonc`) and must
stay off until the legal entity and the privacy policy are approved and in force.

While it is off, the form is not rendered, no third-party script is loaded, and
`POST /early-access/join` and `/early-access/confirm` answer 404. The four result pages
(`/early-access/sent`, `try-again`, `confirmed`, `link-expired`) are static, `noindex` and harmless.

## How it works

1. The visitor enters an address and passes a Cloudflare Turnstile check. The form is a plain
   same-origin POST; cross-site posts are refused by the framework's origin check.
2. The Worker checks a per-IP rate limit (5 requests a minute), verifies the Turnstile token with
   Cloudflare (including the hostname and the action), stores the address and emails a
   confirmation link. The link is valid for 24 hours.
3. The link opens a page with a **Confirm** button. Only the button (a POST) confirms, so mail
   scanners that open links cannot confirm for someone. A link works once.

The form answers the same for a new, a pending and an already confirmed address, and the work runs
after the response is sent, so neither the answer nor its timing shows who is on the list. An
address gets at most one confirmation email an hour.

## What is stored

One row per address in a D1 table (`apps/site/migrations/0001_waitlist.sql`). No plaintext
address is stored, and none is written to logs.

| Column                           | Content                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `email_hash`                     | HMAC-SHA-256 of the normalised address, keyed with `WAITLIST_HMAC_KEY`                                 |
| `email_enc`                      | AES-256-GCM of the address, keyed with `WAITLIST_ENC_KEY`, random nonce per row, bound to `email_hash` |
| `token_hash`, `token_expires_at` | SHA-256 of the confirmation token (256 random bits) and its expiry                                     |
| `status`, timestamps             | `pending` or `confirmed`; created, confirmed, last email sent                                          |

A copy of the database without the Worker secrets reveals no address and cannot be searched for
one. The two keys are separate secrets; the Worker refuses to run if they are equal, missing or
not 32 bytes.

## Retention

- **Unconfirmed** rows are deleted 7 days after the latest sign-up request for that address. The
  deletion runs on every sign-up. In a quiet period, run it by hand:

  ```sh
  npx wrangler d1 execute kofra-waitlist --remote --command \
    "DELETE FROM waitlist WHERE status = 'pending' AND created_at < unixepoch() - 604800"
  ```

- **Confirmed** rows are kept until the launch invitation has been sent or the person asks to be
  removed, then deleted. After the invitation, delete the table contents.

The privacy policy must state these periods, the purpose (one launch email), and that the form
uses Cloudflare Turnstile.

## Cost

- **Email:** the zone is onboarded to Cloudflare Email Sending. On Workers Paid, 3,000 outbound
  emails a month are included per account, then $0.35 per 1,000. The quota is shared with every
  other sender on the account. Emails to verified destination addresses are free.
  Each sign-up sends one email (at most one an hour per address).
- **Turnstile, D1 and the rate-limit binding:** within their free allowances at this volume.

## Enable it

Run the commands in `apps/site`. Never put a secret value on a command line, in a file in the
repository, or in CI logs.

1. **Prerequisites.** The legal entity and the privacy policy are approved and published. The
   policy mentions the waitlist, the retention above and Turnstile (the draft says the site loads
   no third-party scripts; that sentence must change).

2. **Database.** Create it, add the binding, apply the migration:

   ```sh
   npx wrangler d1 create kofra-waitlist
   ```

   Add to `wrangler.jsonc`, with the `database_id` the command printed:

   ```jsonc
   "d1_databases": [
   	{
   		"binding": "WAITLIST_DB",
   		"database_name": "kofra-waitlist",
   		"database_id": "<id from the command>",
   		"migrations_dir": "migrations"
   	}
   ]
   ```

   ```sh
   npx wrangler d1 migrations apply kofra-waitlist --remote
   ```

3. **Email binding.** Add to `wrangler.jsonc`:

   ```jsonc
   "send_email": [{ "name": "EMAIL" }]
   ```

4. **Turnstile.** Create a Turnstile widget for the site's hostname in the Cloudflare dashboard.
   The site key is public and goes in `vars`. The secret key is set in step 5. Cloudflare's
   always-pass test keys do not work here, on purpose: the Worker checks the hostname and action.

5. **Secrets.** Generate each key with `openssl rand` and pipe it straight into
   `wrangler secret put`, which reads the value from standard input. Nothing is printed and nothing
   appears in the process list:

   ```sh
   openssl rand -base64 32 | npx wrangler secret put WAITLIST_HMAC_KEY
   openssl rand -base64 32 | npx wrangler secret put WAITLIST_ENC_KEY
   npx wrangler secret put TURNSTILE_SECRET_KEY   # paste the secret key at the hidden prompt
   ```

   The two keys must be two separate `openssl rand` runs. Worker secrets cannot be read back. If
   you need a backup of `WAITLIST_ENC_KEY` (without it the stored addresses cannot be decrypted),
   write it to a private file first and feed the file to wrangler:

   ```sh
   (umask 077 && openssl rand -base64 32 > waitlist-enc.key)
   npx wrangler secret put WAITLIST_ENC_KEY < waitlist-enc.key
   ```

   Move that file into a password manager or other secret store and delete it from disk. Do not
   commit it.

6. **Switch it on.** In `wrangler.jsonc` `vars`:

   ```jsonc
   "WAITLIST_ENABLED": "true",
   "WAITLIST_FROM": "<sender address on the onboarded domain>",
   "TURNSTILE_SITE_KEY": "<site key>"
   ```

   The build reads these too: the form is rendered only when the flag is `"true"` and a site key
   is set. Build and deploy the site as usual.

7. **Check.**
   - The build log ends with `waitlist=true`.
   - `/early-access` shows the form, and its `Content-Security-Policy` header lists
     `https://challenges.cloudflare.com` in `script-src` and `frame-src`. Every other page still
     has `script-src 'self'` only.
   - Sign up with your own address, confirm from the email, and see "You are on the list".

If any binding or secret is missing or malformed, the endpoints keep answering 404 (fail closed)
even with the flag on. A form that renders but always leads to a 404 means step 2, 3 or 5 is
incomplete.

## Switch it off

Set `WAITLIST_ENABLED` to `"false"`, build and deploy. The form, the Turnstile script and the
wider policy disappear, and the endpoints answer 404 again. Stored rows stay until deleted.

## Content-Security-Policy

Every page has the strict site-wide policy from `apps/site/_headers`. When (and only when) the
built `/early-access` page contains the Turnstile script, `scripts/postbuild.mjs` appends one rule
to the built `_headers` that replaces the policy for that page alone
(`src/lib/turnstile-csp.js`). The build fails if any other page loads Turnstile, and the
byte-budget check (`scripts/budgets.mjs`) refuses third-party scripts everywhere else.

## Not built yet

- The launch invitation job (decrypts confirmed addresses with `decryptEmail`, sends, deletes).
- A removal tool for "delete my address" requests. Removal means computing the address's
  `email_hash` with `WAITLIST_HMAC_KEY` and deleting that row; it needs the key, so it must run as
  Worker code, not as a shell one-liner with the key on the command line.
- A scheduled purge. Today the 7-day deletion runs on sign-ups (or by hand, see Retention).
- Key rotation. Changing `WAITLIST_HMAC_KEY` orphans existing rows; changing `WAITLIST_ENC_KEY`
  makes them undecryptable. Do not change either while rows exist.
