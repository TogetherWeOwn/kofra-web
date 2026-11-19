# Contributing

The organisation-wide guide applies: see
[TogetherWeOwn/.github CONTRIBUTING.md](https://github.com/TogetherWeOwn/.github/blob/main/CONTRIBUTING.md).

In short, for this repository:

1. Work on a branch and open a pull request against `main`. Direct pushes and force pushes to `main` are
   blocked; pull requests are squash-merged.
2. The PR title is a Conventional Commits header, for example `feat(console): add bucket list`.
3. These checks must pass: `ci-ok` (workflow lint, dependency scan, lint, typecheck, unit tests, build, Playwright smoke), `gitleaks`,
   CodeQL and `pr-standards`. Every review thread must be resolved.
4. Run `pnpm run lint`, `pnpm run check`, `pnpm run test:unit` and `pnpm run test:e2e` locally before you
   push.
5. Never commit secrets, `.env` or `.dev.vars` files, or production configuration values.
