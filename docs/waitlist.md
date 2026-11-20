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
2. The Worker checks a per-client rate limit (5 requests a minute for an IPv4 address or an IPv6
   /64), verifies the Turnstile token with
   Cloudflare (including the hostname and the action), stores the address and emails a
   confirmation link. The link is valid for 24 hours.
3. The link opens a page with a **Confirm** button. Only the button (a POST) confirms, so mail
   scanners that open links cannot confirm for someone. A link works once.

The form answers the same for a new, a pending, an already confirmed and a refused address, and
the work runs after the response is sent, so neither the answer nor its timing shows who is on the
list.

## Limits on confirmation emails

Anyone can type anyone's address into the form, so the number of emails is capped. All checks
are one atomic database statement: requests that arrive together cannot each pass and each send.

- **Per address:** one email an hour, and 3 in total for a sign-up. After the third, the address
  gets nothing more until it confirms or its row is deleted.
- **No late links:** no email is sent if its 24-hour link would outlive the row (see Retention).
- **All addresses together:** 50 emails in any 24 hours by default; set `WAITLIST_DAILY_SEND_CAP`
  (a whole number, 1 to 100000) to change it. Above the cap, sign-ups get the usual answer but are
  **not stored and not emailed**, and the Worker logs `waitlist: daily send cap reached` (no
  address). The cap protects the shared email quota (see Cost); pick it so that 30 days at the cap
  stay inside what the account can afford. Someone who can pass Turnstile repeatedly can use up
  the cap and block sign-ups for a day; that is the accepted trade-off against an unbounded bill.
- A malformed cap value switches the waitlist off (fail closed).

## Which addresses are accepted, and what counts as the same address

- Only a plain `local@domain` address. Refused: more than one `@`; spaces; control and invisible
  characters (zero-width, bidirectional marks); `, ; : ( ) [ ] \ < > "`; a local part that starts
  or ends with a dot or has two dots in a row; a domain that is not dot-separated letter, digit
  and hyphen labels (so no IP addresses and no `[...]` literals).
- The address is trimmed, lower-cased and Unicode-normalised (NFC). The domain is converted to its
  one ASCII (IDNA) spelling, so `ｅxample.com` and `example.com`, or `bücher.example` and
  `xn--bcher-kva.example`, are the same address.
- **Plus- and dot-variants are different addresses.** `ada+one@example.com`, `a.da@example.com`
  and `ada@example.com` each get their own row. Folding them is only correct for some providers,
  and guessing wrong would merge two people's mailboxes. The cost is that one mailbox can be
  signed up several times; the per-address and daily caps bound the emails this can cause, and
  the invitation job should send one launch email per row regardless.

## What is stored

One row per address in a D1 table (`apps/site/migrations/0001_waitlist.sql`). No plaintext
address is stored, and none is written to logs.

| Column                             | Content                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `email_hash`                       | HMAC-SHA-256 of the normalised address, keyed with `WAITLIST_HMAC_KEY`                                                                    |
| `email_enc`                        | AES-256-GCM of the address padded to 256 bytes, keyed with `WAITLIST_ENC_KEY`, random nonce, bound to `email_hash`; empty once suppressed |
| `token_hash`, `token_expires_at`   | SHA-256 of the confirmation token (256 random bits) and its expiry                                                                        |
| `status`, timestamps, `send_count` | `pending`, `confirmed` or `suppressed`; first request, confirmed, last email sent; emails sent                                            |

A copy of the database without the Worker secrets reveals no address, not even its length, and
cannot be searched for one. The two keys are separate secrets; the Worker refuses to run if they are equal, missing or
not 32 bytes.

## Retention

- **Unconfirmed** rows lose the encrypted address and the token 7 days after the **first** sign-up
  request for that address. Asking again later sends a new link but does not move that date.
- What is left is the keyed hash alone (`suppressed`). It stays 30 more days, so the same address
  cannot be emailed again immediately, and is then deleted. The hash cannot be turned back into
  an address without the Worker secret.
- **Confirmed** rows are kept until the launch invitation has been sent or the person asks to be
  removed, then deleted. After the invitation, delete the table contents.

The rules are applied on every sign-up and by a cron trigger every hour
(`triggers.crons` in `wrangler.jsonc`, handler in `src/lib/waitlist-purge.js`), so they also hold
when nobody signs up. The cron handler needs only the `WAITLIST_DB` binding and keeps running
when the form is switched off, because addresses collected earlier must still be deleted on time.
Without the binding it does nothing. It reads no secret and decrypts nothing.

The privacy policy must state these periods (7 days, then the hash for 30 more), the purpose (one
launch email), and that the form uses Cloudflare Turnstile.

## Where an address can appear outside the database

- **Email provider logs.** The email service's activity log may keep recipient addresses of sent
  emails. This has not been verified. Check the log and its retention before enabling, and cover
  it in the privacy policy.
- **Worker logs.** The confirmation link carries the token in its query string
  (`/early-access/confirm?token=...`). Keep Workers observability and invocation logs off for
  this Worker (`wrangler.jsonc` does not enable them), or redact the query string of that path before
  logs are stored or exported. A logged token can confirm an address for 24 hours.
- The Worker's own log lines are fixed strings without an address.

## Cost

- **Email:** the zone is onboarded to Cloudflare Email Sending. On Workers Paid, 3,000 outbound
  emails a month are included per account, then $0.35 per 1,000. The quota is shared with every
  other sender on the account. Emails to verified destination addresses are free.
  A sign-up sends one email, at most 3 per address, and at most `WAITLIST_DAILY_SEND_CAP` a day
  in total (default 50, so at most about 1,500 a month).
- **Turnstile, D1, the hourly cron trigger and the rate-limit binding:** within their free allowances at this volume.

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

   Optionally set `"WAITLIST_DAILY_SEND_CAP"` (see Limits). The build reads the first three too: the form is rendered only when the flag is `"true"` and a site key
   is set. Build and deploy the site as usual.

7. **Check.**
   - The build log ends with `waitlist=true`.
   - `/early-access` shows the form, and its `Content-Security-Policy` header lists
     `https://challenges.cloudflare.com` in `script-src` and `frame-src`. Every other page still
     has `script-src 'self'` only.
   - Sign up with your own address, confirm from the email, and see "You are on the list".
   - The Worker's settings show the hourly cron trigger.

If any binding or secret is missing or malformed, the endpoints keep answering 404 (fail closed)
even with the flag on. A form that renders but always leads to a 404 means step 2, 3 or 5 is
incomplete.

## Switch it off

Set `WAITLIST_ENABLED` to `"false"`, build and deploy. The form, the Turnstile script and the
wider policy disappear, and the endpoints answer 404 again. Confirmed rows stay until deleted;
unconfirmed ones keep expiring on schedule as long as the database binding stays in place.

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
- Key rotation. Changing `WAITLIST_HMAC_KEY` orphans existing rows; changing `WAITLIST_ENC_KEY`
  makes them undecryptable. Do not change either while rows exist.
