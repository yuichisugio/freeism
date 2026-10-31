# freeism

- [freeism](#freeism)
  - [Language](#language)
  - [Overview](#overview)
  - [Folder structure](#folder-structure)
  - [Release workflow](#release-workflow)
  - [Pre-commit checks](#pre-commit-checks)
  - [Cloudflare credentials for CI](#cloudflare-credentials-for-ci)

## Language

[日本語](docs/README.ja.md) | English(This page)

## Overview

- A monorepo for web apps, analysis tools, and specification documents related to Freeism.

## Folder structure

| Path                                                       | Description                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`projects/main-web-app/`](./projects/main-web-app/)       | `freeism.app` portal                                                                            |
| [`projects/docs-web-app/`](./projects/docs-web-app/)       | `docs.freeism.app` Blume documentation site and Freeism specification                           |
| [`docs/`](./docs/)                                         | Markdown for the repository root (this README in Japanese, the Japanese code of conduct, etc.). |
| [`projects/points-web-app/`](./projects/points-web-app/)   | `points.freeism.app` frontend/backend specs and implementation plan                             |
| [`projects/markets-web-app/`](./projects/markets-web-app/) | `markets.freeism.app` frontend/backend specs and implementation plan                            |
| [`projects/web-app/`](./projects/web-app/)                 | Legacy Next.js implementation retained until the v0.2 cutover                                   |
| [`docs/web-app/`](./docs/web-app/)                         | Cross-app architecture, authentication, API, security, and migration manifest                   |
| [`projects/calc-contrib/`](./projects/calc-contrib/)       | Software that calculates contribution scores                                                    |
| [`projects/find-contrib/`](./projects/find-contrib/)       | Software that fetches dependencies                                                              |

```
freeism/
├── README.md                 # README (English)
├── CODE_OF_CONDUCT.md        # Code of conduct (English)
├── LICENSE                   # License
├── docs/                     # Documentation for this repository
└── projects/                 # Monorepo projects
    ├── docs-web-app/         # Freeism specification
    ├── main-web-app/         # freeism.app portal
    ├── points-web-app/       # points.freeism.app
    ├── markets-web-app/      # markets.freeism.app
    ├── web-app/              # Legacy app until v0.2 cutover
    ├── calc-contrib/         # Contribution calculation
    └── find-contrib/         # Dependency fetching
```

## Release workflow

For release-relevant changes, run `pnpm changeset`, select the affected application and semver bump, then add the generated `.changeset/*.md` with a user-facing summary to the usual pull request. After it merges to `main`, Changesets creates or updates a Version PR. Merging that PR finalizes package versions and `CHANGELOG.md` files. Documentation-only, CI-only, and Changesets-configuration changes do not need a Changeset.

This workflow does not publish to npm or create Git tags or GitHub Releases.

## Pre-commit checks

Pre-commit checks run through Vite+ `vp staged`, configured in the `staged` block of the root `vite.config.ts`.
No `staged` rules are configured yet, so no pre-commit check runs.
To add one, write the rule in `staged`, commit `.vite-hooks/pre-commit` containing `vp staged`, and run `pnpm exec vp hooks enable` in each clone.
See the [Japanese README](docs/README.ja.md#コミット前のチェック) for an example.

## Cloudflare credentials for CI

GitHub Actions deployments access Cloudflare with the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets of each GitHub Environment.

| Environment          | Workflows                                                                                                    | Trigger          |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------- |
| `web-app-staging`    | `cloudflare-test.yml`, `main-docs-cloudflare-test.yml`, `main-web-app-cloudflare-test.yml`                   | Push to `test/*` |
| `web-app-staging`    | `points-pr-preview.yml`                                                                                      | Pull request     |
| `web-app-production` | `cloudflare-production.yml`, `main-docs-cloudflare-production.yml`, `main-web-app-cloudflare-production.yml` | Push to `main`   |

Create an Account API Token in the Cloudflare dashboard under Manage account → Account API tokens, with these two resource scopes.
Attach Workers and D1 to the account scope; they have no effect on the zone scope.

| Resource scope                 | Permissions               |
| ------------------------------ | ------------------------- |
| The Freeism Cloudflare account | Workers: Admin, D1: Write |
| Zone `freeism.app`             | Workers Routes: Edit      |

Register the secrets with repository admin rights; `gh secret set` without a value prompts for hidden input.
See the [Japanese README](docs/README.ja.md#ci-の-cloudflare-認証) for the registration and verification commands.
