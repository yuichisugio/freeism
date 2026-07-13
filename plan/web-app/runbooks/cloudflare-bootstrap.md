# Cloudflare web-app bootstrap runbook

## Scope and ownership

- Terraform `1.15.7` and `cloudflare/cloudflare` `5.21.1` are exact pins.
- `production` workspace alone owns zone-wide apex/www DNS, root redirect, managed WAF, IP/path rate limit, and Email Routing enablement. `staging` must never create those resources.
- `staging` owns only staging Access resources. Turnstile, native notification policies, and verified destination inventory are environment-specific.
- Worker, custom domain, D1, Durable Object, Workflow, Service Binding, and Worker Secret resources remain Wrangler/application-owned. Terraform must not add them.
- The `freeism-terraform-state` R2 bucket is a one-time bootstrap resource, not part of normal Terraform state and not a D1 backup.

Cloudflare's current alert-type inventory exposes incident, edge HTTP error, and billing usage policies, but no Worker-script runtime-exception-specific type was confirmed. The minimal IaC therefore uses environment-wide `incident_alert`, `http_alert_edge_error`, and `billing_usage_alert`; app-specific exceptions are correlated with Workers Logs/Traces and the D1 monitor. Do not invent an undocumented alert type.

## Required local guard

```bash
export TERRAFORM_BIN="/path/to/verified/terraform-1.15.7"
"${TERRAFORM_BIN}" version -json
pnpm --filter @freeism/points-web-app exec wrangler --version
```

Expected versions are Terraform `1.15.7` and Wrangler `4.108.0`. Secrets are supplied only through the shell or GitHub Environment. Never put them in HCL, tfvars, plans, evidence, or command history.

## Owner-reviewed bootstrap order

The repository owner checks the Cloudflare account, environments, desired names, and proposed create/update/delete set before any mutation. Then perform these items in order:

1. Confirm Workers Paid and production D1 Time Travel retention of 30 days in the API/dashboard.
2. Bootstrap `freeism-terraform-state` using the check/apply/check procedure below.
3. Create a bucket-scoped Object Read & Write credential. Save it as `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_ENDPOINT_URL_S3` in both `web-app-staging` and `web-app-production` GitHub Environments.
4. Keep required reviewers and wait timers at zero for both GitHub Environments; do not add a production manual approval.
5. Create separate staging and production Cloudflare API tokens with only the permissions required by each reviewed plan.
6. Before Gate B, create only the Points staging Worker, D1, custom domain, staging Google OAuth App, Markets USER/M2M/SETTLEMENT confidential clients, redirect URIs, pairwise secret, and minimum Worker Secrets. Do not create DO, Workflow, or production runtime resources yet.
7. Create the staging E2E Access Service Token and store `CF_ACCESS_CLIENT_ID_STAGING` and `CF_ACCESS_CLIENT_SECRET_STAGING` only in `web-app-staging`.
8. Run Task 6A Gate B. Continue to Points Task 14+ and Markets only after PASS.
9. After child bindings stabilize, create the remaining environment-specific D1, DO, Workflow, Service Binding, OAuth, redirect URI, and Worker Secret inventory.
10. Configure environment-specific `OPS_METRICS`, five-minute monitor Cron, and verified alert destinations in child Worker configs.
11. Regenerate binding types with pinned Wrangler and record only hashes of IDs/inventory in evidence.

Google OAuth App configuration is verified in Google Cloud; Better Auth static client inventory is verified through the app configuration. These are not fabricated as Terraform resources.

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
