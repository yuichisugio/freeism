import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ACTIONS = [
  "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
  "pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320",
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
];

const COMMON_PATHS = [
  "projects/main-web-app/**",
  "projects/docs-web-app/**",
  "scripts/sites/**",
  "tests/sites/**",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".node-version",
];

const WORKFLOWS = {
  validation: {
    path: ".github/workflows/main-docs-ci.yml",
    event: "pull_request",
    trigger: "pull_request:\n    paths:",
  },
  staging: {
    path: ".github/workflows/main-docs-cloudflare-test.yml",
    event: "push",
    trigger: 'push:\n    branches:\n      - "test/*"\n    paths:',
    environment: "web-app-staging",
    concurrency: "freeism-main-docs-staging-deploy",
    suffix: "staging",
  },
  production: {
    path: ".github/workflows/main-docs-cloudflare-production.yml",
    event: "push",
    trigger: "push:\n    branches:\n      - main\n    paths:",
    environment: "web-app-production",
    concurrency: "freeism-main-docs-production-deploy",
    suffix: "production",
  },
};

async function readWorkflow(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function onSection(workflow) {
  const match = workflow.match(/^on:\n([\s\S]*?)^permissions:\n/m);
  assert.ok(match, "workflow must put permissions immediately after its trigger section");
  return match[1];
}

function listedPaths(triggerSection) {
  const paths = triggerSection.match(/    paths:\n((?:      - .+\n)+)/);
  assert.ok(paths, "trigger must define a paths allowlist");
  return paths[1].trim().split("\n").map((line) => line.replace(/^\s*-\s*/, ""));
}

function assertInOrder(workflow, commands) {
  let previous = -1;
  for (const command of commands) {
    const current = workflow.indexOf(command);
    assert.ok(current > previous, `${command} must appear in the required order`);
    previous = current;
  }
}

test("all portal/docs workflows are pinned, read-only, and narrowly path-filtered", async () => {
  for (const contract of Object.values(WORKFLOWS)) {
    const workflow = await readWorkflow(contract.path);

    assert.match(workflow, /^permissions:\n  contents: read$/m);
    assert.match(workflow, /runs-on: ubuntu-24\.04/);
    assert.match(workflow, /timeout-minutes: 30/);
    assert.match(workflow, /^\s+CI: "true"$/m);
    for (const action of ACTIONS) assert.ok(workflow.includes(`uses: ${action}`));

    const trigger = onSection(workflow);
    assert.ok(trigger.includes(contract.trigger));
    assert.deepEqual(
      [...trigger.matchAll(/^  ([a-z_]+):/gm)].map((match) => match[1]),
      [contract.event],
    );
    assert.deepEqual(listedPaths(trigger), [...COMMON_PATHS, contract.path]);

    assert.doesNotMatch(workflow, /pull_request_target|workflow_dispatch/);
    assert.doesNotMatch(workflow, /@freeism\/(?:points|markets)-web-app/i);
    assert.doesNotMatch(workflow, /(?:db:)?migrat|terraform\s+apply/i);
    assert.doesNotMatch(workflow, /(?:npm|pnpm)\s+(?:install|add)\s+(?:--global|-g)\b/);
  }
});

test("pull-request validation is unprivileged and runs every portal/docs check", async () => {
  const workflow = await readWorkflow(WORKFLOWS.validation.path);
  const trigger = onSection(workflow);

  assert.doesNotMatch(trigger, /^\s{2}push:/m);
  assert.doesNotMatch(workflow, /environment:|secrets\.|CLOUDFLARE_|WRANGLER_|deploy:|smoke:/);
  assertInOrder(workflow, [
    "pnpm install --frozen-lockfile",
    "pnpm --filter main-web-app test",
    "pnpm --filter docs-web-app test",
    "pnpm --filter main-web-app check",
    "pnpm --filter docs-web-app check",
    "pnpm --filter main-web-app build",
    "pnpm --filter docs-web-app build",
    "node --test tests/sites/*.test.mjs",
  ]);
});

for (const name of ["staging", "production"]) {
  test(`${name} deployment uses isolated credentials and preserves deploy order`, async () => {
    const contract = WORKFLOWS[name];
    const workflow = await readWorkflow(contract.path);
    const trigger = onSection(workflow);

    assert.doesNotMatch(trigger, /^\s{2}pull_request:/m);
    assert.match(workflow, new RegExp(`environment: ${contract.environment}`));
    assert.match(workflow, new RegExp(`group: ${contract.concurrency}`));
    assert.match(workflow, /cancel-in-progress: false/);
    assert.match(workflow, /^\s+WRANGLER_SEND_METRICS: "false"$/m);

    const secrets = [...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]);
    assert.deepEqual(secrets, ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);

    assertInOrder(workflow, [
      "pnpm install --frozen-lockfile",
      "pnpm --filter main-web-app test",
      "pnpm --filter docs-web-app test",
      "pnpm --filter main-web-app check",
      "pnpm --filter docs-web-app check",
      "pnpm --filter main-web-app build",
      "pnpm --filter docs-web-app build",
      `pnpm --filter main-web-app deploy:${contract.suffix}`,
      `pnpm --filter docs-web-app deploy:${contract.suffix}`,
      `pnpm --filter main-web-app smoke:${contract.suffix}`,
      `pnpm --filter docs-web-app smoke:${contract.suffix}`,
    ]);
  });
}
