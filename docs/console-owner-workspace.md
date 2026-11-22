# Console data mode `tenant0`: the owner's own workspace

Status: design for the staging console. The console keeps its `demo` mode; `tenant0` is a
second data mode that serves the operator's own storage account (workspace 0) until the
Kofra API exists. When the API ships, `tenant0` is replaced by the real API client and
deleted; the pages do not change.

## 1. Shape

```
browser ──(Access at the edge)──► console Worker ──(service binding)──► storage service
                                   │  gate: Access JWT, email allow list, same origin
                                   │  locals.api   = Kofra SDK over the tenant0 transport
                                   │  locals.files = file browser (list, upload, delete)
```

- `CONSOLE_DATA` picks the data source.
  - `demo` serves sample data without service bindings. The legacy `CONSOLE_MODE=demo`
    also works when `CONSOLE_DATA` is unset.
  - `tenant0` requires Cloudflare Access settings and storage credentials from section 3.
    It uses the `STORAGE` binding or, for local tests, a loopback HTTP `STORAGE_ORIGIN`.
  - `live` requires the `ACCOUNT` and `API` service bindings and an `ASSERTION_KEY` of
    exactly 64 lowercase hexadecimal characters.
  - `live-fake` uses an in-memory account service and sample workspace data without
    bindings. It accepts only loopback requests and serves passkeys on `localhost`.
- An unsupported mode or missing or invalid required configuration makes the console
  refuse every request with 503. A `CONSOLE_MODE` that disagrees with `CONSOLE_DATA` also
  makes the console refuse every request.
- `locals.api` stays the generated SDK (`Kofra`). In `tenant0` its `fetch` is a local
  transport that answers the `/v1` contract (vendor/openapi.json) from the storage service's
  admin API and S3 API, exactly as the demo transport answers it from a cookie. Swapping in
  the real API later means building `Kofra` with the API's base URL and a user token.
- Everything the contract does not cover yet (object listing, uploads, object deletes,
  connecting a bucket) goes through `locals.files`, a `FileStore` interface with a demo and
  a `tenant0` implementation. The future API will need the same operations; the interface is
  the list of what it must offer.
- `locals.workspace` tells pages what the data source can do (`features`), so a page hides
  what has no data instead of showing zeros.

## 2. Authentication (fail closed)

In `tenant0` mode every request the Worker handles must carry a valid
`Cf-Access-Jwt-Assertion`: RS256 under a key from the team's certs endpoint, `iss` equal to
the team domain, `aud` holding the application's AUD tag, inside `exp`/`nbf` (30 s leeway),
and an `email` on `ALLOWED_EMAILS`. Anything else, including a missing setting or an
unreachable certs endpoint, is a plain 403 before any page code runs and before any call
to the storage service.

- `DEV_AUTH=local` skips the check only when all three hold: the request names a loopback
  host, the storage service is reached through `STORAGE_ORIGIN` (no binding), and that
  origin is a loopback `http` URL. A deployed Worker has a binding and a real host, so the
  flag cannot open it; the private deploy script refuses to deploy either setting.
- Non-GET requests must send an `Origin` equal to the console's own origin (SvelteKit checks
  form posts; the hook also checks JSON posts and upload PUTs).
- Static build files (public code, no data) are served by the platform without the hook;
  Access still guards them at the edge.

## 3. Secrets and settings

| Name                               | Kind            | Use                                                         |
| ---------------------------------- | --------------- | ----------------------------------------------------------- |
| `CONSOLE_DATA`                     | var             | `demo`, `tenant0`, `live`, or `live-fake`                   |
| `CONSOLE_MODE`                     | var             | Legacy mode. Must match `CONSOLE_DATA` if both are set.     |
| `ACCESS_TEAM_DOMAIN`               | var             | `<team>.cloudflareaccess.com`                               |
| `ACCESS_AUD`, `ALLOWED_EMAILS`     | secret          | Access application tag; comma-separated emails              |
| `STORAGE`                          | service binding | the storage Worker (production)                             |
| `STORAGE_ORIGIN`                   | var             | local tests only: loopback `http` origin of a fake          |
| `STORAGE_HOST`                     | var             | public S3 host; signed into every request and presigned URL |
| `STORAGE_REGION`                   | var             | SigV4 region, default `auto`                                |
| `STORAGE_KEY_ID`, `STORAGE_SECRET` | secret          | the console's own S3 key                                    |
| `STORAGE_ADMIN_TOKEN`              | secret          | admin bearer token (full admin)                             |
| `WORKSPACE_NAME`                   | var             | shown as the workspace name                                 |
| `PROTECTED_BUCKETS`                | var             | extra buckets that can never be deleted (`files` always is) |

Secrets are set with `wrangler secret put` reading stdin. None of them reaches a page, a
log line or an error message; the browser only ever talks to the console.

## 4. Operations and where tenant 0 differs from the API

| Contract operation                  | tenant0 source                                                                                                                                         | Differences                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account.get`                       | settings only                                                                                                                                          | fixed id `ws_tenant0`; no limits; no suspension or deletion                                                                                                                     |
| `account.delete`, `cancel_deletion` | refused (`role_forbidden`)                                                                                                                             | the workspace cannot be deleted here                                                                                                                                            |
| `buckets.list`, `buckets.get`       | S3 ListBuckets with the console key + usage counters                                                                                                   | lists the buckets the console key can reach ("connected"); others are in `files.otherBuckets()`                                                                                 |
| `buckets.create`                    | `POST /_admin/buckets` then a `rw` grant for the console key                                                                                           | buckets are created as real data (never disposable)                                                                                                                             |
| `buckets.delete`                    | S3 `DELETE /<bucket>` with the admin token                                                                                                             | refused for protected buckets, for buckets the console cannot see into, and for any bucket with a file or an open upload; the service also refuses a bucket that ever held data |
| `keys.list`                         | `GET /_admin/keys`                                                                                                                                     | no names, no last-used time; the console's own key is listed and cannot be revoked                                                                                              |
| `keys.create`                       | `POST /_admin/keys` with the larger of the read and read-write sets, then one `POST /_admin/keys/<id>/grants` per bucket of the other set (at most 16) | if a grant fails, the key is revoked and nothing is returned                                                                                                                    |
| `keys.update`                       | `POST /_admin/keys/<id>/grants`                                                                                                                        | grants only widen; names are not stored                                                                                                                                         |
| `keys.revoke`                       | `DELETE /_admin/keys/<id>`                                                                                                                             | refused for the console's own key                                                                                                                                               |
| `usage.get`, `usage.buckets`        | `GET /_admin/usage/buckets`                                                                                                                            | stored bytes and files only; no upload, download or request totals; `seeded: false` is shown as "still counting"                                                                |
| `usage.days`                        | none                                                                                                                                                   | empty: no daily history yet                                                                                                                                                     |
| `events.list`                       | none                                                                                                                                                   | empty feed                                                                                                                                                                      |
| `objects.presign` (GET)             | SigV4 query presign with the console key                                                                                                               | URL points at `STORAGE_HOST`; files a browser can show open in the tab                                                                                                          |

`FileStore` (not in the contract yet):

- `list(bucket, prefix, cursor)`: ListObjectsV2 with `/` as delimiter, 200 per page.
- `startUpload(bucket, key, size, type)`: the storage service sends no CORS headers, so a
  browser cannot PUT to it directly. The console hands out a URL on itself carrying a token
  (HMAC-SHA256, key derived from the console's S3 secret) that binds bucket, key, size, type,
  expiry and, for multipart, the upload id. Files under 16 MiB go in one PUT (token valid
  15 minutes); larger ones are multipart in 16 MiB parts (token valid 12 hours). The Worker
  streams each body to the service with a fixed length. Uploads never overwrite: the PUT
  and the multipart completion send `If-None-Match: *`. The service never clears an
  unfinished multipart upload by itself, so the page aborts it when a part fails or the
  page is left (keepalive request on `pagehide`), and the abort route still accepts an
  expired token (signature, purpose, bucket and upload id are checked). Closing the tab while an upload is
  being started can still leave one; the bucket's delete page lists unfinished uploads when
  nothing else is left and stops exactly the ones it showed (signed digest), only those older
  than 13 hours (no console upload can still be running), 20 per request.
- `confirmDelete(bucket, keys)` and `deleteFiles(bucket, confirmed)`: up to 25 files (one storage call each, inside the platform's limit of 32 calls to another
  Worker per request). The
  confirmation page lists every file with its size; its form carries the keys, their ETags
  and a signed SHA-256 digest of the bucket and the ordered (key, ETag) pairs. The action re-checks the HMAC and deletes each file with
  `If-Match: <ETag>`, so a file that changed after the page was shown is kept and reported.
- `otherBuckets()` and `connect(bucket, access)`: buckets the console key has no grant on
  (from the usage counters: the admin API has no full bucket list, so an empty bucket is not
  listed until it holds a file, but `/buckets/<name>/connect` opens it all the same),
  and a confirmation page that grants it `read` or `read_write` (grants only widen).

## 5. Protecting existing data

- The `files` bucket (and every bucket in `PROTECTED_BUCKETS`) is refused by
  `buckets.delete`, in the dry run and in the real call, before any request leaves the
  Worker.
- A bucket delete also needs: a connected bucket, an empty first page of ListObjectsV2, no
  open multipart uploads, and zero live files in the usage counters.
- Object deletes happen only through the confirmation page (section 4).
- Uploads never replace an existing file.
- The console never calls the service's status route.

## 6. Tests

- Unit: the Access verifier (forged, expired, wrong audience or issuer, unknown key, wrong
  email, missing settings, certs down), the gate and the dev bypass conditions, config
  (every missing `tenant0` setting gives 503), SigV4 against the AWS example vector, upload
  and confirmation tokens, and the transport against an in-memory fake of the service
  (contract-validated responses, the delete guards, key creation rollback).
- Playwright: the built Worker in the local Workers runtime in `tenant0` mode against a
  local fake of the admin and S3 API (`e2e/fake-storage.ts`): list, create, browse folders,
  upload (single and multipart), download, delete with confirmation, connect, keys create
  and revoke, usage; and a second server "as deployed" (no `DEV_AUTH`) that must answer 403.
