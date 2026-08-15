import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ACTIONS = [
  "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
  "pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320",
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
];

const SHARED_PATHS = [
  "scripts/sites/**",
  "tests/sites/**",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".node-version",
];

const APPS = {
  portal: {
    projectPath: "projects/main-web-app/**",
    filter: "main-web-app",
    otherFilter: "docs-web-app",
    workflowPrefix: "main-web-app",
    concurrencyPrefix: "freeism-main",
  },
  docs: {
    projectPath: "projects/docs-web-app/**",
    filter: "docs-web-app",
    otherFilter: "main-web-app",
    workflowPrefix: "main-docs",
    concurrencyPrefix: "freeism-docs",
  },
};

const WORKFLOW_TYPES = {
  validation: {
    filename: "ci.yml",
    event: "pull_request",
    trigger: "pull_request:\n    paths:",
  },
  staging: {
    filename: "cloudflare-test.yml",
    event: "push",
    trigger: 'push:\n    branches:\n      - "test/*"\n    paths:',
    environment: "web-app-staging",
    concurrencySuffix: "staging-deploy",
    suffix: "staging",
  },
  production: {
    filename: "cloudflare-production.yml",
    event: "push",
    trigger: "push:\n    branches:\n      - main\n    paths:",
    environment: "web-app-production",
    concurrencySuffix: "production-deploy",
    suffix: "production",
  },
};

const APP_DEPLOY_WORKFLOWS = {
  staging: {
    path: ".github/workflows/cloudflare-test.yml",
  },
  production: {
    path: ".github/workflows/cloudflare-production.yml",
  },
};

const PORTAL_DOCS_DELIVERY_PATHS = [
  "projects/main-web-app/**",
  "projects/docs-web-app/**",
  "scripts/sites/**",
  "tests/sites/**",
  "docs/superpowers/**",
  "docs/web-app/v0.2/architecture.md",
  "docs/web-app/v0.2/decision-register.md",
  "plan/web-app/v0.2-migration.md",
  "infra/cloudflare/modules/web-app-edge/main.tf",
  "infra/cloudflare/modules/web-app-edge/edge.tftest.hcl",
  "pnpm-lock.yaml",
  ".changeset/**",
  ".github/workflows/main-docs-*.yml",
  ".github/workflows/main-web-app-*.yml",
];

function workflowContract(appName, typeName) {
  const app = APPS[appName];
  const type = WORKFLOW_TYPES[typeName];
  return {
    ...app,
    ...type,
    appName,
    typeName,
    path: `.github/workflows/${app.workflowPrefix}-${type.filename}`,
  };
}

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

function listedIgnoredPaths(triggerSection) {
  const paths = triggerSection.match(/    paths-ignore:\n((?:      - .+\n)+)/);
  assert.ok(paths, "trigger must define a paths-ignore list");
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

function namedStep(workflow, name) {
  const match = workflow.match(new RegExp(`      - name: ${name}\\n([\\s\\S]*?)(?=      - name:|$)`));
  assert.ok(match, `${name} step must exist`);
  return match[0];
}

test("portal and docs workflows are pinned, read-only, isolated, and narrowly path-filtered", async () => {
  for (const appName of Object.keys(APPS)) {
    for (const typeName of Object.keys(WORKFLOW_TYPES)) {
      const contract = workflowContract(appName, typeName);
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
      assert.deepEqual(listedPaths(trigger), [contract.projectPath, ...SHARED_PATHS, contract.path]);

      assert.match(workflow, new RegExp(`pnpm --filter ${contract.filter} (?:test|check|build)`));
      assert.doesNotMatch(workflow, new RegExp(`pnpm --filter ${contract.otherFilter} `));
      assert.doesNotMatch(workflow, /pull_request_target|workflow_dispatch/);
      assert.doesNotMatch(workflow, /@freeism\/(?:points|markets)-web-app/i);
      assert.doesNotMatch(workflow, /(?:db:)?migrat|terraform\s+apply/i);
      assert.doesNotMatch(workflow, /(?:npm|pnpm)\s+(?:install|add)\s+(?:--global|-g)\b/);
    }
  }
});

for (const appName of Object.keys(APPS)) {
  test(`${appName} pull-request validation is unprivileged and app-specific`, async () => {
    const contract = workflowContract(appName, "validation");
    const workflow = await readWorkflow(contract.path);
    const trigger = onSection(workflow);

    assert.doesNotMatch(trigger, /^\s{2}push:/m);
    assert.doesNotMatch(workflow, /environment:|secrets\.|CLOUDFLARE_|WRANGLER_|deploy:|smoke:/);
    assertInOrder(workflow, [
      "pnpm install --frozen-lockfile",
      `pnpm --filter ${contract.filter} test`,
      `pnpm --filter ${contract.filter} check`,
      `pnpm --filter ${contract.filter} build`,
      "node --test tests/sites/*.test.mjs",
    ]);
  });

  for (const typeName of ["staging", "production"]) {
    test(`${appName} ${typeName} deployment uses isolated credentials and app-specific commands`, async () => {
      const contract = workflowContract(appName, typeName);
      const workflow = await readWorkflow(contract.path);
      const trigger = onSection(workflow);

      assert.doesNotMatch(trigger, /^\s{2}pull_request:/m);
      assert.match(workflow, new RegExp(`environment: ${contract.environment}`));
      assert.match(
        workflow,
        new RegExp(`group: ${contract.concurrencyPrefix}-${contract.concurrencySuffix}`),
      );
      assert.match(workflow, /cancel-in-progress: false/);
      assert.match(workflow, /^\s+WRANGLER_SEND_METRICS: "false"$/m);

      const deployStep = namedStep(workflow, `Deploy ${appName}`);
      assert.match(deployStep, /env:\n          CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}\n          CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);

      const withoutDeployStep = workflow.replace(deployStep, "");
      assert.doesNotMatch(withoutDeployStep, /secrets\.|CLOUDFLARE_/);

      const secrets = [...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]);
      assert.deepEqual(secrets, ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);

      assertInOrder(workflow, [
        "pnpm install --frozen-lockfile",
        `pnpm --filter ${contract.filter} test`,
        `pnpm --filter ${contract.filter} check`,
        `pnpm --filter ${contract.filter} build`,
        "node --test tests/sites/*.test.mjs",
        `pnpm --filter ${contract.filter} deploy:${contract.suffix}`,
        `pnpm --filter ${contract.filter} smoke:${contract.suffix}`,
      ]);
    });
  }
}

for (const [name, contract] of Object.entries(APP_DEPLOY_WORKFLOWS)) {
  test(`${name} Points/Markets deployment ignores portal/docs-only delivery pushes`, async () => {
    const workflow = await readWorkflow(contract.path);
    const trigger = onSection(workflow);

    assert.deepEqual(listedIgnoredPaths(trigger), [
      ...PORTAL_DOCS_DELIVERY_PATHS,
      contract.path,
    ]);
  });
}
