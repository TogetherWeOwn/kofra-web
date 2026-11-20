# kofra-web

The public web front end of Kofra: the marketing site, the customer console and the shared UI kit.

**Status:** the marketing site (`apps/site`) is built and in early access; the console (`apps/console`)
runs as a demo with sample data, ahead of sign-in and the management API. Pages, static assets and error responses carry `X-Robots-Tag: noindex` until launch.

## Layout

| Path              | Package          | What it is                                                       |
| ----------------- | ---------------- | ---------------------------------------------------------------- |
| `apps/site`       | `@kofra/site`    | Marketing site; every route is prerendered                       |
| `apps/console`    | `@kofra/console` | Customer console; server-rendered                                |
| `packages/ui`     | `@kofra/ui`      | Shared Svelte 5 components, base styles and the theme script     |
| `packages/tokens` | `@kofra/tokens`  | Design tokens (DTCG `tokens.json`) and generated `tokens.css`    |
| `packages/api`    | `@kofra/api`     | The Kofra API client (TypeScript SDK) and the console's demo API |

Stack: SvelteKit 3, Svelte 5 (runes), TypeScript (strict), Vite, `@sveltejs/adapter-cloudflare` on Cloudflare
Workers with static assets. Tests use Vitest and Playwright. Linting uses ESLint, Prettier and svelte-check.

## Design tokens

`packages/tokens/tokens.json` is the source (DTCG format 2025.10; colours carry their dark value in
`$extensions["app.kofra.modes"].dark`). After editing it, run `pnpm --filter @kofra/tokens run build` to
regenerate `tokens.css`; a unit test fails when the two drift, and another fails when a text or control
colour pair drops below its WCAG contrast minimum in either theme.

## Site quality gates

The site is fully prerendered and ships no JavaScript except the theme switch. CI enforces:

- **Hard (deterministic):** axe-core in Playwright on every page, light and dark, 390 and 1440 px
  (zero serious or critical findings); `scripts/forbidden-words.mjs` over the source and the build;
  per-page byte budgets (`apps/site/scripts/budgets.mjs`); Lighthouse accessibility 100 and CLS ≤ 0.1;
  no Lighthouse regression beyond the noise margin against `apps/site/lighthouse-baseline.json`
  (`apps/site/scripts/lh-ratchet.mjs`).
- **Warnings (noisy on shared runners):** Lighthouse performance, best practices and SEO ≥ 95, LCP
  and TBT, as medians of three runs. On pull requests Lighthouse runs only when site-affecting files
  change (a skip counts as a pass in `ci-ok`); the job summary lists every warning and failure. See [docs/PERF-BACKLOG.md](docs/PERF-BACKLOG.md).

## Console

The console (`apps/console`) is rendered by its Worker and talks to the Kofra management API
through the TypeScript SDK. Until sign-in and the API exist it runs in **demo mode**
(`CONSOLE_MODE=demo`, the only mode): the SDK's transport is an in-memory API that follows the
contract (`packages/api/src/demo`), and each visitor's changes live in one cookie
(sample data only, no identity, no secret). Any other mode answers 503 on every page, so a build
cannot show a workspace without sign-in.

- **API client:** `packages/api/vendor` holds the SDK and the published contract, copied unchanged
  from the `kofra-api` repository by `pnpm --filter @kofra/api run sync <checkout>`; a unit test
  pins their hashes, and another checks every demo answer against the contract's schemas.
- **Screens:** overview, buckets (create, browse, upload, download, delete), access keys (create
  with the secret shown once, revoke), usage (daily charts with a table view, CSV export), billing,
  settings (workspace deletion request and cancel), and a sign-in placeholder. Every destructive
  action has a confirmation page, and the server checks the confirmation too.
- **Billing** uses hosted Stripe Checkout and the Customer Portal, in test mode only: set
  `BILLING=test`, `STRIPE_PRICE_ID`, `STRIPE_PORTAL_CUSTOMER` and the secret `STRIPE_SECRET_KEY`
  (a `sk_test_`/`rk_test_` key; live keys are refused). Off by default.
- **Gates:** axe on every page in both themes at 390 and 1440 px, user journeys in Playwright,
  the CSP with per-response nonces (no inline styles), and JS/CSS byte budgets
  (`apps/console/scripts/budgets.mjs`).

## Search engines and AI assistants

`apps/site/src/lib/registry.ts` lists every page once; everything below is generated from it and
the same content modules the pages render, so nothing can drift:

- **Markdown twins:** every page is also served as Markdown at `<path>.md` (`/index.md` for home),
  and at the page URL itself for requests with `Accept: text/markdown` (a small entry Worker,
  `src/lib/negotiate.js`, installed by `scripts/postbuild.mjs`). Pages link their twin with
  `<link rel="alternate" type="text/markdown">`.
- **`/llms.txt`** (llmstxt.org format) and **`/llms-full.txt`** (all twins in one file).
- **JSON-LD:** Organization, WebSite, BreadcrumbList, FAQPage (`/faq`) and TechArticle (docs), checked
  against schema.org in unit and e2e tests. Product and Offer (`/pricing`) are published only once
  `PRICES_FINAL` in `src/lib/site.ts` is true; example prices never become structured data.
- **SEO basics:** canonical URLs on `https://kofra.app`, `sitemap.xml` with `lastmod`, Open Graph and
  Twitter cards with `static/og.png` (regenerate with `node scripts/og-image.mjs`).

**Indexing is off** for every build: `noindex` meta and header, and a `Disallow: /` robots.txt. A
production launch flips one value: build with `KOFRA_INDEXABLE=true`. That drops `noindex`
everywhere and serves a robots.txt that allows search engines and the AI crawlers that honour it,
with the sitemap line.

## Development

Requires Node 24 (see `.node-version`) and pnpm 10 (`corepack enable` or install pnpm directly).

```sh
pnpm install                 # install all workspaces
pnpm --filter @kofra/site dev     # run the marketing site with Vite
pnpm --filter @kofra/console dev  # run the console with Vite

pnpm run lint       # prettier --check and eslint
pnpm run format     # prettier --write
pnpm run check      # wrangler types, svelte-kit sync, svelte-check / tsc
pnpm run test:unit  # vitest
pnpm run build      # production builds of both apps
pnpm run test:e2e   # Playwright smoke tests against each built app in the local Workers runtime
```

Before the first `test:e2e`, install the browser: `pnpm --filter @kofra/site exec playwright install chromium`.

`worker-configuration.d.ts` in each app is generated by `wrangler types` during `check` and `build`; it is
not committed.

## Deployment

Not enabled. Worker names in each `wrangler.jsonc` are placeholders, `workers_dev` and `preview_urls` are
off, and there is no deploy workflow. Adding one is a separate, reviewed change once launch is approved.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE)
