# Freeism Main / Docs Cloudflare Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the Freeism portal and Blume documentation site to isolated Cloudflare staging and production Workers, and make the same verified delivery repeatable from GitHub Actions.

**Architecture:** Each Astro static output is served by a Workers Static Assets Worker with explicit `staging` and `production` named environments. Portal/docs deployment workflows are isolated from the Points/Markets workflows, while Terraform relinquishes the production apex DNS record to Wrangler and owns only the `www` to apex redirect. A shared Node smoke command validates live HTTP, canonical URLs, and required content after each deployment.

**Tech Stack:** Node 26.x, pnpm 10.33.3, Astro 6/7, Blume 1.0.3, Wrangler 4.108.0, Cloudflare Workers Static Assets, GitHub Actions, Terraform 1.15.7 / Cloudflare Provider 5.21.1.

## Global Constraints

- Do not change any canonical Markdown under `projects/docs-web-app/src/**`; the six canonical SHA-256 values must remain unchanged.
- Use Workers `main-web-app-staging`, `main-web-app-production`, `docs-web-app-staging`, and `docs-web-app-production` only.
- Use custom domains `staging.freeism.app`, `freeism.app`, `staging.docs.freeism.app`, and `docs.freeism.app` exactly.
- Keep `workers_dev: false`, `preview_urls: false`, `assets.not_found_handling: "404-page"`, and `assets.html_handling: "auto-trailing-slash"` in both environments.
- Pin Wrangler exactly to `4.108.0`; do not add a release-age exclusion or weaken `minimumReleaseAge: 4320`.
- Keep staging and production GitHub Environment credentials separate; never copy the local Wrangler OAuth token into GitHub.
- Portal/docs workflows must not deploy or migrate Points/Markets resources.
- Wrangler owns Worker custom domains and the apex DNS record. Terraform owns only the proxied `www` redirect endpoint and redirects it to `https://freeism.app/` without path or query preservation.
- Staging portal/docs are public static content and do not receive Cloudflare Access applications in this change.

---

### Task 1: Static site Workers and smoke contract

**Files:**
- Create: `tests/sites/cloudflare-static-sites.test.mjs`
- Create: `scripts/sites/smoke-static-site.mjs`
- Create: `projects/main-web-app/wrangler.jsonc`
- Create: `projects/docs-web-app/wrangler.jsonc`
- Modify: `projects/main-web-app/package.json`
- Modify: `projects/docs-web-app/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces package scripts `deploy:staging`, `deploy:production`, `smoke:staging`, and `smoke:production` in both site packages.
- Produces `validateStaticSite({ baseUrl, canonicalUrl, requiredText, requiredLinks, fetchImpl }) -> Promise<void>` for unit testing and CLI use.
- CLI arguments are `--url`, `--canonical`, repeated `--text`, and repeated `--link`.

- [ ] **Step 1: Write the failing static deployment contract**

Create `tests/sites/cloudflare-static-sites.test.mjs`. Read both package manifests and both future `wrangler.jsonc` files. Assert the exact Worker/domain matrix, global asset policy, exact Wrangler dependency, and four package scripts. Import `validateStaticSite` and test it with an injected `fetchImpl` returning representative portal/docs HTML; assert rejection for a non-2xx response, wrong canonical URL, missing required text, and missing required link.

The required Wrangler shape is:

```json
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "main-web-app",
  "compatibility_date": "2026-07-15",
  "workers_dev": false,
  "preview_urls": false,
  "assets": {
    "directory": "./dist",
    "not_found_handling": "404-page",
    "html_handling": "auto-trailing-slash"
  },
  "env": {
    "staging": {
      "name": "main-web-app-staging",
      "workers_dev": false,
      "preview_urls": false,
      "routes": [{ "pattern": "staging.freeism.app", "custom_domain": true }]
    },
    "production": {
      "name": "main-web-app-production",
      "workers_dev": false,
      "preview_urls": false,
      "routes": [{ "pattern": "freeism.app", "custom_domain": true }]
    }
  }
}
```

The docs config uses base name `docs-web-app` and the docs Worker/domain values from Global Constraints.

- [ ] **Step 2: Verify RED**

Run:

```bash
mise x node@26 -- node --test tests/sites/cloudflare-static-sites.test.mjs
```

Expected: FAIL because both Wrangler files and the smoke module do not exist.

- [ ] **Step 3: Implement the minimal config and smoke command**

Create both JSON-compatible `.jsonc` files with the exact shape above. Add exact `wrangler: "4.108.0"` to each package and these scripts:

```json
{
  "deploy:staging": "wrangler deploy --env staging",
  "deploy:production": "wrangler deploy --env production",
  "smoke:staging": "node ../../scripts/sites/smoke-static-site.mjs --url https://staging.freeism.app/ --canonical https://freeism.app/ --text Freeism --link https://docs.freeism.app/ --link https://points.freeism.app/ --link https://markets.freeism.app/",
  "smoke:production": "node ../../scripts/sites/smoke-static-site.mjs --url https://freeism.app/ --canonical https://freeism.app/ --text Freeism --link https://docs.freeism.app/ --link https://points.freeism.app/ --link https://markets.freeism.app/"
}
```

The docs scripts use the same command with staging/production URLs, production canonical `https://docs.freeism.app/`, text `無料主義 v3`, and links to `https://docs.freeism.app/en/`, `https://docs.freeism.app/notes/`, and `https://docs.freeism.app/en/notes/`. The smoke module retries three times with one-second gaps, sets a ten-second timeout per request, requires a 2xx response, resolves `<link rel="canonical">`, and checks text/link fragments without logging response bodies or credentials.

Update only the two importer blocks and necessary package/snapshot entries in `pnpm-lock.yaml`; preserve all other workspace importers.

- [ ] **Step 4: Verify GREEN and frozen install**

Run:

```bash
mise x node@26 -- node --test tests/sites/cloudflare-static-sites.test.mjs
mise x node@26 -- pnpm install --frozen-lockfile --ignore-scripts
mise x node@26 -- pnpm --dir projects/main-web-app test
mise x node@26 -- pnpm --dir projects/docs-web-app test
```

Expected: the new contract, main 5 tests, and docs 11 tests PASS; frozen install does not modify the lockfile.

- [ ] **Step 5: Commit**

```bash
git add tests/sites/cloudflare-static-sites.test.mjs scripts/sites/smoke-static-site.mjs projects/main-web-app/wrangler.jsonc projects/docs-web-app/wrangler.jsonc projects/main-web-app/package.json projects/docs-web-app/package.json pnpm-lock.yaml
git commit -m "feat: configure portal and docs Workers delivery"
```

### Task 2: Portal/docs CI/CD workflows

**Files:**
- Create: `.github/workflows/main-docs-cloudflare-test.yml`
- Create: `.github/workflows/main-docs-cloudflare-production.yml`
- Create: `.github/workflows/main-docs-ci.yml`
- Create: `tests/sites/cloudflare-site-workflows.test.mjs`

**Interfaces:**
- Consumes the eight package scripts from Task 1.
- Produces an unprivileged pull-request validation workflow plus isolated staging and production workflows using `web-app-staging` and `web-app-production` Environment secrets.

- [ ] **Step 1: Write the failing workflow contract**

Create `tests/sites/cloudflare-site-workflows.test.mjs`. Assert all three workflows use `contents: read` and pinned checkout/pnpm/setup-node SHAs already used by `.github/workflows/cloudflare-test.yml`. Assert both deploy workflows use exact Environment names, distinct concurrency groups, `cancel-in-progress: false`, and only Environment secrets `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN`.

Assert validation triggers only on `pull_request`, staging triggers only on `test/*`, and production triggers only on `main`. All three must have `paths` for:

```text
projects/main-web-app/**
projects/docs-web-app/**
scripts/sites/**
tests/sites/**
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
.node-version
the corresponding workflow file itself
```

For deploy workflows assert order: frozen install; both package tests/checks/builds; main deploy; docs deploy; main smoke; docs smoke. For PR validation assert frozen install followed by both package tests/checks/builds and both contract tests, with no Environment, secret, deploy, or smoke reference. Assert no Points/Markets package name, migration command, Terraform apply, `pull_request_target`, `workflow_dispatch`, or global install appears.

- [ ] **Step 2: Verify RED**

Run:

```bash
mise x node@26 -- node --test tests/sites/cloudflare-site-workflows.test.mjs
```

Expected: FAIL because the three workflows do not exist.

- [ ] **Step 3: Implement both workflows**

Use `ubuntu-24.04`, `timeout-minutes: 30`, and `CI: "true"` in all workflows. Set `WRANGLER_SEND_METRICS: "false"` only in deploy workflows. Use concurrency groups `freeism-main-docs-staging-deploy` and `freeism-main-docs-production-deploy`. Build/test/check each package before any deploy. Deploy and smoke portal before docs so the portal never points to a newly failed docs build. The PR workflow runs `node --test tests/sites/*.test.mjs` after the package builds and has no Cloudflare credentials.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
mise x node@26 -- node --test tests/sites/cloudflare-site-workflows.test.mjs tests/sites/cloudflare-static-sites.test.mjs
```

Expected: PASS with all workflow safety and order assertions.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/main-docs-ci.yml .github/workflows/main-docs-cloudflare-test.yml .github/workflows/main-docs-cloudflare-production.yml tests/sites/cloudflare-site-workflows.test.mjs
git commit -m "ci: deploy portal and docs to Cloudflare"
```

### Task 3: Apex and www ownership cutover

**Files:**
- Modify: `infra/cloudflare/modules/web-app-edge/main.tf`
- Modify: `infra/cloudflare/modules/web-app-edge/edge.tftest.hcl`
- Modify: `docs/web-app/v0.2/architecture.md`
- Modify: `docs/web-app/v0.2/decision-register.md`
- Modify: `plan/web-app/v0.2-migration.md`

**Interfaces:**
- Produces Terraform ownership where Wrangler owns `freeism.app` and Terraform owns only the proxied `www.freeism.app` redirect endpoint.

- [ ] **Step 1: Change the Terraform test first**

Update `production_shared_edge_contract` to require zero `cloudflare_dns_record.apex` instances, one proxied `www` record, and one redirect rule whose expression is only `http.host eq "www.freeism.app"`, status is 301, query is discarded, and target is `https://freeism.app/`.

- [ ] **Step 2: Verify RED**

Run:

```bash
terraform -chdir=infra/cloudflare/modules/web-app-edge test
```

Expected: FAIL because current Terraform still owns apex and redirects both hosts to Points.

- [ ] **Step 3: Implement the minimal Terraform and documentation change**

Delete only `cloudflare_dns_record.apex`. Keep `www` as the Terraform-owned proxied redirect endpoint. Narrow the ruleset expression and target exactly as specified. Update the three architecture/decision/migration documents to state that Wrangler owns portal/docs custom domains, Terraform owns only www normalization and other existing zone-wide controls, and the obsolete Points redirect must not be recreated. Do not change the canonical docs site Markdown.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
terraform fmt -check -recursive infra/cloudflare
terraform -chdir=infra/cloudflare/modules/web-app-edge test
git diff --check
```

Expected: formatting and Terraform tests PASS.

- [ ] **Step 5: Commit**

```bash
git add infra/cloudflare/modules/web-app-edge/main.tf infra/cloudflare/modules/web-app-edge/edge.tftest.hcl docs/web-app/v0.2/architecture.md docs/web-app/v0.2/decision-register.md plan/web-app/v0.2-migration.md
git commit -m "infra: hand apex delivery to the portal Worker"
```

### Task 4: Deploy, configure GitHub, verify, and publish the PR

**Files:**
- Modify only if verification finds a release defect in Task 1-3 files.

**Interfaces:**
- Consumes both Wrangler configs/workflows and the existing authenticated Cloudflare account.
- Produces four deployed Workers, four live custom domains, two GitHub Environments with scoped deploy secrets, a pushed branch, and a ready-for-review PR against `main`.

- [ ] **Step 1: Run complete local verification and dry-runs**

Run Node 26 / pnpm 10.33.3 frozen install, both site tests/checks/builds, both site contract tests, Terraform fmt/test, `wrangler deploy --dry-run --env staging`, `wrangler deploy --dry-run --env production`, canonical six-file SHA-256 comparison, and `git diff --check`.

Expected: all task-owned checks PASS. Existing unrelated baseline failures must be demonstrated by identity with `origin/main` and are not changed in this branch.

- [ ] **Step 2: Create staging GitHub Environment and scoped credentials**

Create `web-app-staging` if absent and retain `web-app-production`. Store `CLOUDFLARE_ACCOUNT_ID` and distinct scoped `CLOUDFLARE_API_TOKEN` values in each Environment. Never print token values. Verify only Environment names and secret names through GitHub APIs.

- [ ] **Step 3: Deploy and verify staging**

Build both packages, deploy `main-web-app-staging` then `docs-web-app-staging`, run both staging smoke scripts, then verify desktop/mobile rendering, console errors, broken assets, portal links, docs search, and the four docs routes in a real browser.

- [ ] **Step 4: Deploy production assets and perform the DNS cutover**

Record the current apex/www DNS and redirect identifiers without secret values. Build and upload both production Workers. Remove the obsolete apex/self/Points redirect and Vercel `www` CNAME; connect `freeism.app` and `docs.freeism.app` through Wrangler custom domains; create the proxied www redirect endpoint to apex. Do not change Points/Markets routes or resources.

- [ ] **Step 5: Verify production and rollback readiness**

Run both production smoke scripts and browser checks. Confirm `www.freeism.app` returns a permanent redirect to `https://freeism.app/`, docs 404 is non-2xx, and Worker deployment history contains the new versions. If any check fails, rollback the affected Worker/custom domain before proceeding.

- [ ] **Step 6: Final review, push, and PR**

Run a whole-branch independent review, commit any verified fixes, push `codex/deploy-main-docs-cloudflare`, and open a non-draft PR against `main`. The PR body must document the four live URLs, Worker names, DNS ownership cutover, CI secret names (not values), checks, rollback path, and any unrelated baseline failure.
