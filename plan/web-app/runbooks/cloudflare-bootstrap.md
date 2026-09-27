# Cloudflare web-app bootstrap runbook

## Scope and ownership

- Terraform `1.15.7` and `cloudflare/cloudflare` `5.21.1` are exact pins.
- `production` workspace alone owns zone-wide apex/www DNS, root redirect, managed WAF, IP/path rate limit, and Email Routing enablement. `staging` must never create those resources.
- `staging` owns only staging Access resources. Native notification policies and verified destination inventory are environment-specific.
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

## Bootstrap order

1. Confirm the Cloudflare account, staging and production environments, Worker names, D1 names and custom domains.
2. Bootstrap the Terraform state bucket and apply the reviewed staging edge plan.
3. Create the named Points and Markets D1 databases, apply migrations, set Google/GitHub OAuth application callbacks and required Worker Secrets.
4. Deploy Points and verify login. Add the first ADMIN with the D1 command below if administrative operations are needed.
5. Log in to Points and register Markets as an OAuth client from `/developer`. Store the issued Client ID and the matching private JWK in the Markets Worker, then deploy Markets.
6. Run login, OAuth connection, M2M and Resource API checks against the staging origins. Promote only a tested configuration to production, using separate OAuth applications, Client ID and key pair in each environment.

Google OAuth application settings are managed in Google Cloud. The Points GitHub OAuth application callback is `https://staging.points.freeism.app/api/auth/callback/github` in staging. Google callbacks are `https://staging.points.freeism.app/api/auth/callback/google` and `https://staging.markets.freeism.app/api/auth/callback/google`. Each app stores its own Google/GitHub credentials as Worker Secrets. `BETTER_AUTH_SECRETS` contains one or more comma-separated `version:secret` entries; each secret has at least 32 characters.

### Initial Points ADMIN in D1

After the intended administrator signs in with Google, inspect the linked Google `account_id` and Points user ID. The `account_id` is the Google OIDC `sub`, not an email address. Run from `projects/points-web-app` and choose the exact environment:

```bash
pnpm exec wrangler d1 execute DB --remote --env staging --config wrangler.jsonc \
  --command "SELECT p.id AS points_user_id, a.account_id AS google_sub FROM points_user p JOIN account a ON a.user_id = p.auth_user_id WHERE a.provider_id = 'google'"
```

Confirm exactly one row for the intended person, then replace `GOOGLE_SUB_FROM_QUERY` in the following command with that row's `google_sub` and execute it. The `NOT EXISTS` condition makes this a one-time initial assignment. Confirm the resulting `points_user_id` afterwards.

```bash
pnpm exec wrangler d1 execute DB --remote --env staging --config wrangler.jsonc \
  --command "INSERT INTO admin_membership (id, points_user_id, role) SELECT 'adm_' || lower(hex(randomblob(16))), p.id, 'ADMIN' FROM points_user p JOIN account a ON a.user_id = p.auth_user_id WHERE a.provider_id = 'google' AND a.account_id = 'GOOGLE_SUB_FROM_QUERY' AND NOT EXISTS (SELECT 1 FROM admin_membership)"
pnpm exec wrangler d1 execute DB --remote --env staging --config wrangler.jsonc \
  --command "SELECT id, points_user_id, role FROM admin_membership"
```

For production, repeat the inspection and assignment with `--env production` and the production Points D1. Later ADMIN changes use the authenticated management API and its audit trail.

### Register a Markets OAuth client

Generate a separate Ed25519 key pair for each environment outside the repository. This example writes a private JWK readable only by the current user and a public JWKS for the Points form:

```bash
key_dir="$(mktemp -d)"
KEY_DIR="$key_dir" node --input-type=module <<'NODE'
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const kid = randomUUID();
const attributes = { alg: 'EdDSA', kid, use: 'sig' };
writeFileSync(`${process.env.KEY_DIR}/private-jwk.json`, JSON.stringify({ ...privateKey.export({ format: 'jwk' }), ...attributes }), { mode: 0o600 });
writeFileSync(`${process.env.KEY_DIR}/public-jwks.json`, JSON.stringify({ keys: [{ ...publicKey.export({ format: 'jwk' }), ...attributes }] }), { mode: 0o600 });
NODE
```

Sign in to `https://staging.points.freeism.app/developer` and register Markets with its name, the public JWKS from `public-jwks.json`, and these callback URLs:

- `https://staging.markets.freeism.app/api/points-connection/callback`
- `https://staging.markets.freeism.app/api/points-connection/unlink/callback`

The form accepts an optional HTTPS introduction URL and an optional description. The backend verifies owner, input, redirects and a maximum of five clients per user. Copy the issued Client ID into Markets `POINTS_CLIENT_ID` and the private JWK JSON into `POINTS_CLIENT_PRIVATE_KEY_JWK` without adding them to Git or logs. From `projects/markets-web-app`:

```bash
pnpm exec wrangler secret put POINTS_CLIENT_ID --config wrangler.jsonc --env staging
pnpm exec wrangler secret put POINTS_CLIENT_PRIVATE_KEY_JWK --config wrangler.jsonc --env staging < "$key_dir/private-jwk.json"
```

If Markets is being deployed for the first time, provide those two values with Wrangler's `--secrets-file` option during the first deploy. Keep the private file outside the repository only until it is stored in the intended environment. To rotate, add both current and next public keys to the Points JWKS, switch Markets to the next private JWK, then remove the old public key after existing client assertions have expired. Repeat the registration and key generation separately for production.

### Staging deployment

```bash
pnpm --filter @freeism/points-web-app build:staging
pnpm --filter @freeism/points-web-app db:migrate:staging
pnpm --filter @freeism/points-web-app deploy:staging

# Complete Points login and the Markets client registration above.

pnpm --filter @freeism/markets-web-app build:staging
pnpm --filter @freeism/markets-web-app db:migrate:staging
pnpm --filter @freeism/markets-web-app deploy:staging
```

After both custom domains have valid TLS, run each application's `smoke:staging` check. Verify a Points connection, a user JWT Access Token for the Points API, a scoped M2M token and a rejected request with a different audience. Record checks and identifiers only, without private keys or Token values.

## State bucket check/apply/check

Set a short-lived token with R2 read/write and the exact account ID, then run:

```bash
node infra/cloudflare/scripts/bootstrap-terraform-state.mjs --check
node infra/cloudflare/scripts/bootstrap-terraform-state.mjs --apply
node infra/cloudflare/scripts/bootstrap-terraform-state.mjs --check
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
