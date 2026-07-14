import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const TEST_WORKFLOW = ".github/workflows/cloudflare-test.yml";
const PRODUCTION_WORKFLOW = ".github/workflows/cloudflare-production.yml";

async function workflow(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function assertInOrder(source, fragments) {
  let cursor = -1;
  for (const fragment of fragments) {
    const next = source.indexOf(fragment, cursor + 1);
    assert.notEqual(next, -1, `missing workflow fragment: ${fragment}`);
    assert.ok(next > cursor, `workflow fragment is out of order: ${fragment}`);
    cursor = next;
  }
}

function assertCommonSafety(source, environment, concurrencyGroup) {
  assert.match(source, /permissions:\s*\n\s+contents: read/);
  assert.match(source, new RegExp(`environment: ${environment}`));
  assert.match(source, new RegExp(`group: ${concurrencyGroup}`));
  assert.match(source, /cancel-in-progress: false/);
  assert.match(source, /queue: max/);
  assert.doesNotMatch(source, /pull_request_target|workflow_dispatch/);
  assert.match(source, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(source, /pnpm\/action-setup@[0-9a-f]{40}/);
  assert.match(source, /actions\/setup-node@[0-9a-f]{40}/);
  assert.match(source, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(source, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
}

test("test/* push deploys the shared Cloudflare test environment in state-safe order", async () => {
  const source = await workflow(TEST_WORKFLOW);

  assert.match(source, /branches:\s*\n\s+- ["']test\/\*["']/);
  assert.doesNotMatch(source, /branches:\s*\n\s+- main/);
  assertCommonSafety(source, "web-app-staging", "freeism-web-app-test-deploy");
  assertInOrder(source, [
    "pnpm install --frozen-lockfile",
    "pnpm contract:web-app:check",
    "@freeism/points-web-app test",
    "@freeism/points-web-app test:worker",
    "@freeism/markets-web-app test",
    "@freeism/markets-web-app test:worker",
    "@freeism/markets-web-app test:release",
    "source projects/points-web-app/.dev.vars.example",
    "@freeism/points-web-app build:staging",
    "@freeism/points-web-app build:assert",
    "source projects/markets-web-app/.dev.vars.example",
    "@freeism/markets-web-app build:staging",
    "@freeism/markets-web-app build:assert",
    "@freeism/points-web-app db:migrate:staging",
    "@freeism/markets-web-app db:migrate:staging",
    "@freeism/points-web-app deploy:staging",
    "@freeism/markets-web-app deploy:staging",
    "@freeism/points-web-app smoke:staging",
    "@freeism/markets-web-app smoke:staging",
  ]);
  assert.doesNotMatch(source, /db:migrate:production|deploy:production|smoke:production/);
});

test("main push deploys only the Cloudflare production environment in state-safe order", async () => {
  const source = await workflow(PRODUCTION_WORKFLOW);

  assert.match(source, /branches:\s*\n\s+- main/);
  assert.doesNotMatch(source, /test\/\*/);
  assertCommonSafety(source, "web-app-production", "freeism-web-app-production-deploy");
  assertInOrder(source, [
    "pnpm install --frozen-lockfile",
    "CLOUDFLARE_ENV=production pnpm --filter @freeism/markets-web-app verify:better-auth-release",
    "pnpm contract:web-app:check",
    "@freeism/points-web-app test",
    "@freeism/points-web-app test:worker",
    "@freeism/markets-web-app test",
    "@freeism/markets-web-app test:worker",
    "@freeism/markets-web-app test:release",
    "source projects/points-web-app/.dev.vars.example",
    "@freeism/points-web-app build:production",
    "@freeism/points-web-app build:assert",
    "source projects/markets-web-app/.dev.vars.example",
    "@freeism/markets-web-app build:production",
    "@freeism/markets-web-app build:assert",
    "@freeism/points-web-app db:migrate:production",
    "@freeism/markets-web-app db:migrate:production",
    "@freeism/points-web-app deploy:production",
    "@freeism/markets-web-app deploy:production",
    "@freeism/points-web-app smoke:production",
    "@freeism/markets-web-app smoke:production",
  ]);
  assert.doesNotMatch(source, /db:migrate:staging|deploy:staging|smoke:staging/);
});
