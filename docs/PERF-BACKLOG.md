# Performance and score backlog

Lighthouse scores, LCP and TBT are warnings on CI runners, because shared runners are noisy.
The hard gates are deterministic: axe (zero serious or critical findings), the forbidden-word
check, per-page JS and CSS byte budgets, Lighthouse accessibility 100 and CLS ≤ 0.1, and the
ratchet against `apps/site/lighthouse-baseline.json`.

**Loop guard.** When a score or performance item needs more than two fix attempts, stop, record
it here with the measurement, and move on. A full optimisation pass happens once the site is
complete.

| Date | Page | Item | Measurement | Attempts | Notes |
| ---- | ---- | ---- | ----------- | -------- | ----- |

Open follow-ups from the org web standard (STANDARD.md rules 23 and 24), outside the first site PR:

- **Visual regression against committed baselines** (rule 24): full-page screenshots of every public
  route at desktop and mobile widths, compared in CI. Baselines must be rendered on the CI image
  (font rasterisation differs between hosts), so they land with the staging deploy work. Today the
  layout is checked by the axe suite at both widths and by the screenshot review recorded in the PR.
- **Desktop Lighthouse profile** (rule 23): CI runs the mobile profile, which is the stricter one;
  add a desktop collect if a desktop-only regression ever appears.

No open score items. First full build (2026-11-19, 3-run medians, local Workers runtime): every page
scored 100 for performance, accessibility, best practices and SEO (the `is-crawlable` audit is
skipped because every page is `noindex` until launch), LCP about 0.9 s, TBT 0 ms, CLS 0.

Console (added with the first console build, 2026-11-20):

- **Lighthouse for the console** (warn-only, as for the site): not wired yet. The console's hard
  gates run on every PR: axe on every page in both themes at both widths, the console byte budgets
  (`apps/console/scripts/budgets.mjs`; first build: largest route 54.6 KB JS, 5.9 KB CSS, all
  client JS 82.5 KB gzip) and the e2e journeys. Add a warn-only Lighthouse run of the main console
  routes once the console has sign-in (Lighthouse needs a session to reach them then).
