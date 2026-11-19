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

No open items. First full build (2026-11-19, 3-run medians, local Workers runtime): every page
scored 100 for performance, accessibility, best practices and SEO (the `is-crawlable` audit is
skipped because every page is `noindex` until launch), LCP about 0.9 s, TBT 0 ms, CLS 0.
