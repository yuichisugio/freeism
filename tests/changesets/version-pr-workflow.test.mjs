import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflowPath = new URL("../../.github/workflows/version-packages.yml", import.meta.url);
const deployWorkflowPaths = [
  new URL("../../.github/workflows/cloudflare-test.yml", import.meta.url),
  new URL("../../.github/workflows/cloudflare-production.yml", import.meta.url),
];

const pinnedActions = [
  "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
  "pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320",
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
];

test("Version PR workflow only versions private packages on main", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /^on:\n  push:\n    branches:\n      - main$/m);
  assert.match(workflow, /^permissions:\n  contents: write\n  pull-requests: write$/m);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /timeout-minutes: \d+/);
  assert.match(workflow, /^\s+CI: "true"$/m);
  assert.match(workflow, /cancel-in-progress: false/);
  for (const action of pinnedActions) assert.ok(workflow.includes(`uses: ${action}`));
  assert.ok(workflow.indexOf("pnpm install --frozen-lockfile") < workflow.indexOf("changesets/action@"));
  assert.match(workflow, /changesets\/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d/);
  assert.match(workflow, /github-token: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  assert.match(workflow, /version: pnpm version-packages/);
  assert.match(workflow, /commit: "chore: version packages"/);
  assert.match(workflow, /title: "chore: version packages"/);
  assert.doesNotMatch(workflow, /(?:^|\n)\s+publish:/);
  assert.doesNotMatch(workflow, /NPM_TOKEN|npm publish|git tag|gh release|pull_request_target|workflow_dispatch/);
});

test("existing Cloudflare deploy workflows remain read-only", async () => {
  for (const path of deployWorkflowPaths) {
    const workflow = await readFile(path, "utf8");
    assert.match(workflow, /^permissions:\n  contents: read$/m);
    assert.doesNotMatch(workflow, /pull-requests: write|contents: write/);
  }
});
