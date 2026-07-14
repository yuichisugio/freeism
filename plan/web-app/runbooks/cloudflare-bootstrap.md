# Cloudflare web-app bootstrap runbook

## Scope and ownership

- Terraform `1.15.7` and `cloudflare/cloudflare` `5.21.1` are exact pins.
- `production` workspace alone owns zone-wide apex/www DNS, root redirect, managed WAF, IP/path rate limit, and Email Routing enablement. `staging` must never create those resources.
- `staging` owns only staging Access resources. Turnstile, native notification policies, and verified destination inventory are environment-specific.
- `staging` is the internal Cloudflare name of the shared test environment. Only pushes to `test/*` deploy it; pushes to `main` deploy `production` directly and never promote a staging artifact.
- Worker, custom domain, D1, Durable Object, Workflow, Service Binding, and Worker Secret resources remain Wrangler/application-owned. Terraform must not add them.
- The `freeism-terraform-state` R2 bucket is a one-time bootstrap resource, not part of normal Terraform state and not a D1 backup.
- Staging may be deployed on Workers Free. Its flattened Worker configuration must omit paid-only per-Worker `limits.cpu_ms` and `limits.subrequests` and run within the Free-plan defaults. Workers Paid remains a production release gate; do not weaken the production limits or release gate to match staging.

Cloudflare's current alert-type inventory exposes incident, edge HTTP error, and billing usage policies, but no Worker-script runtime-exception-specific type was confirmed. The minimal IaC therefore uses environment-wide `incident_alert`, `http_alert_edge_error`, and `billing_usage_alert`; app-specific exceptions are correlated with Workers Logs/Traces and the D1 monitor. Do not invent an undocumented alert type.

## Required local guard

```bash
export TERRAFORM_BIN="/path/to/verified/terraform-1.15.7"
"${TERRAFORM_BIN}" version -json
pnpm --filter @freeism/points-web-app exec wrangler --version
```

Expected versions are Terraform `1.15.7` and Wrangler `4.108.0`. Secrets are supplied only through the shell or GitHub Environment. Never put them in HCL, tfvars, plans, evidence, or command history.

## One-time Cloudflare account activation

Before the first Worker deployment, perform these account-level Dashboard actions once:

1. Open **Workers & Pages** once and finish the account `workers.dev` subdomain initialization. This initializes the account only; both app configurations must keep `workers_dev: false` and `preview_urls: false`, so no `workers.dev` or preview URL is published.
2. Open **Analytics & Logs > Workers Analytics Engine** and enable Analytics Engine if the account presents the enable action. Dataset bindings remain defined in each app's Wrangler configuration; the dataset itself is created on its first write and must not be fabricated as a Terraform resource.

References: [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) and [Workers Analytics Engine setup](https://developers.cloudflare.com/analytics/analytics-engine/get-started/).

## Owner-reviewed bootstrap order

The repository owner checks the Cloudflare account, environments, desired names, and proposed create/update/delete set before any mutation. Then perform these items in order:

1. Confirm staging uses Workers Free without paid-only Worker-level limits. Separately confirm Workers Paid and D1 Time Travel retention of 30 days before any production deployment.
2. Complete the one-time Workers and Analytics Engine account activation above.
3. Bootstrap `freeism-terraform-state` using the check/apply/check procedure below.
4. Create a bucket-scoped Object Read & Write credential. Save it as `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_ENDPOINT_URL_S3` in both `web-app-staging` and `web-app-production` GitHub Environments.
5. Keep required reviewers and wait timers at zero for both GitHub Environments; do not add a production manual approval.
6. Create separate staging and production Cloudflare API tokens with only the permissions required by each reviewed plan.
7. Create the named Points and Markets staging D1 databases, custom domains, staging OAuth applications, pairwise secret, minimum Worker Secrets, and other already-reviewed staging bindings. Do not create production runtime resources yet.
8. Create the staging E2E Access Service Token and store `CF_ACCESS_CLIENT_ID_STAGING` and `CF_ACCESS_CLIENT_SECRET_STAGING` only in `web-app-staging`.
9. Apply both named staging D1 migration sets, deploy Points, complete Gate B and OAuth client bootstrap, and then deploy Markets. Do not reverse this D1 migrations -> Points -> Markets dependency order.
10. Wait for both custom domains to finish TLS provisioning before smoke tests; a transient certificate/DNS failure while provisioning is not a successful smoke result.
11. Configure environment-specific Analytics Engine bindings, five-minute monitor Cron, and verified alert destinations in child Worker configs.
12. Regenerate binding types with pinned Wrangler and record only hashes of IDs/inventory in evidence.

Google OAuth App configuration is verified in Google Cloud; Better Auth static client inventory is verified through the app configuration. These are not fabricated as Terraform resources.

## Staging authentication settings

Before the first authentication smoke test, configure these external settings manually:

- Add `https://staging.points.freeism.app/api/auth/callback/google` and `https://staging.markets.freeism.app/api/auth/callback/google` as authorized redirect URIs for the staging Google OAuth client. Store the client ID/secret only as Worker Secrets.
- Create the Points staging **GitHub OAuth App** with homepage `https://staging.points.freeism.app` and callback `https://staging.points.freeism.app/api/auth/callback/github`. GitHub is an ownership/linking provider in v0.2; its email is not an identity key.
- Set `INITIAL_ADMIN_GOOGLE_ACCOUNT_ID` to the intended administrator's Google OIDC `sub`, never their email address. If it is not known before first login, a temporary non-matching value may be used only to discover the real `provider_id=google` account ID in staging; replace it before admin acceptance.
- `BETTER_AUTH_SECRETS` must contain one or more comma-separated `version:secret` entries. Each version is a unique positive JavaScript-safe integer and each secret is at least 32 characters. Points and Markets may use separate values, but neither may receive a bare unversioned secret.
- For automated staging validation, Cloudflare's always-pass Turnstile test pair may be used: site key `1x00000000000000000000AA` and secret key `1x0000000000000000000000000000000AA`. These are public test credentials and must never be copied to production; production uses its own protected widget secret.

Any temporary OAuth client IDs/secrets or other bootstrap placeholder is staging-only. It is not a production credential and must be replaced by the registered value before staging acceptance. Never infer that a placeholder proves authentication works.

### One-time standard OAuth client registration

Create the three confidential clients only through Better Auth's standard `/api/auth/oauth2/register` endpoint. For the bootstrap deployment, set a one-time `POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN`; without that binding, dynamic registration remains disabled.

Use `registerPointsOAuthClients()` from `projects/points-web-app/src/backend/auth/register-points-oauth-clients.ts` in the secured bootstrap runner. It registers USER, M2M, and SETTLEMENT clients with separate grants, scopes, pairwise subject policy, redirect URIs, and resource links. Its required `onRegistered` callback persists each client ID and secret directly to the corresponding Points/Markets Worker Secrets before the next client is registered, so a later registration failure does not make an earlier secret unrecoverable. If a later GitHub deployment workflow needs the same credentials, copy them directly into the protected environment at registration time; do not print or write the response to an artifact.

Run the secured staging runner without echoing the token:

```bash
POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN="..." \
  pnpm --filter @freeism/points-web-app oauth:bootstrap:staging
```

The runner registers and persists exactly three clients (`USER`, `M2M`, `SETTLEMENT`), deletes `POINTS_OAUTH_CLIENT_BOOTSTRAP_TOKEN` from the Points Worker, and verifies that another registration attempt returns `403`. Confirm the six matching ID/secret names exist in each Worker's inventory, and that the bootstrap-token name no longer exists, without reading any value:

```bash
pnpm --filter @freeism/points-web-app exec wrangler secret list --config wrangler.jsonc --env staging
pnpm --filter @freeism/markets-web-app exec wrangler secret list --config wrangler.jsonc --env staging
```

Points must contain the `MARKETS_{USER,M2M,SETTLEMENT}_OAUTH_CLIENT_{ID,SECRET}` names; Markets must contain the `POINTS_{USER,M2M,SETTLEMENT}_CLIENT_{ID,SECRET}` names. Then redeploy the same Points build and deploy/redeploy Markets. Finally verify an M2M opaque token and standard introspection before recording only hashes of the three client IDs in the evidence file. Never insert `oauth_client` rows or raw client secrets with SQL.

## Staging runtime deployment order

Use the checked-in package scripts and keep this order:

```bash
pnpm --filter @freeism/points-web-app db:migrate:staging
pnpm --filter @freeism/markets-web-app db:migrate:staging

pnpm --filter @freeism/points-web-app build:staging
pnpm --filter @freeism/points-web-app deploy:staging

# Complete the one-time OAuth bootstrap above after the Points endpoint is live.

pnpm --filter @freeism/markets-web-app build:staging
pnpm --filter @freeism/markets-web-app deploy:staging
```

After deployment, wait until Cloudflare has provisioned TLS for both custom domains. Only then run `smoke:staging` for Points followed by Markets. Keep `workers_dev` and preview URLs disabled throughout.

## State bucket check/apply/check

Set a short-lived token with R2 read/write and the exact account ID, then run:

```bash
node scripts/web-app/bootstrap-terraform-state.mjs --check
node scripts/web-app/bootstrap-terraform-state.mjs --apply
node scripts/web-app/bootstrap-terraform-state.mjs --check
```

`--check` performs Cloudflare R2 bucket get plus filtered list. Absence is reported with exit 0. Read errors, account/name disagreement, and duplicate list results stop with non-zero. `--apply` creates only an absent bucket and repeats get/list verification. It never deletes or changes an existing bucket.

Create the bucket-scoped S3 credential separately, then export:

```bash
export AWS_ENDPOINT_URL_S3="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
```

## Local validation and planning

```bash
"${TERRAFORM_BIN}" fmt -recursive infra/cloudflare
"${TERRAFORM_BIN}" -chdir=infra/cloudflare/modules/web-app-edge init -backend=false
"${TERRAFORM_BIN}" -chdir=infra/cloudflare/modules/web-app-edge validate
"${TERRAFORM_BIN}" -chdir=infra/cloudflare/modules/web-app-edge test
"${TERRAFORM_BIN}" -chdir=infra/cloudflare init -backend=false
"${TERRAFORM_BIN}" -chdir=infra/cloudflare validate
```

For remote work, select a workspace matching `environment`. The configuration rejects a mismatch:

```bash
"${TERRAFORM_BIN}" -chdir=infra/cloudflare init -reconfigure
"${TERRAFORM_BIN}" -chdir=infra/cloudflare workspace select -or-create staging
"${TERRAFORM_BIN}" -chdir=infra/cloudflare plan -var-file=environments/staging.tfvars.example
```

Use the plan's two-terminal `-lock-timeout=0s` procedure to prove the R2 `.tflock`. Answer `no` in Terminal A; never use `force-unlock` unless no Terraform process remains. After the owner reviews the staging plan, apply only that saved plan and require a zero-diff plan. Keep production at plan-only until the release pipeline condition in the parent plan is met.

## Runtime inventory completion

After real staging IDs exist, update only `env.staging` in `projects/points-web-app/wrangler.jsonc`, then run:

```bash
pnpm --filter @freeism/points-web-app exec wrangler types worker-configuration.d.ts --config wrangler.jsonc --env staging
pnpm --filter @freeism/points-web-app exec wrangler types worker-configuration.d.ts --config wrangler.jsonc --env staging --check
pnpm --filter @freeism/points-web-app check
```

Do not add placeholder IDs or secrets to Wrangler configuration.
