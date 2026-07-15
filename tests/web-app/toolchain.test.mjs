import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const expectedNpmrc = `engine-strict=true
save-exact=true
`;

const expectedWorkspace = `packages:
  - projects/*
minimumReleaseAge: 4320
blockExoticSubdeps: true
onlyBuiltDependencies:
  - esbuild
  - workerd
`;

const expectedDevDependencies = {
  "openapi-typescript": "7.13.0",
  tsx: "4.23.0",
  typescript: "6.0.3",
  "vite-plus": "0.2.4",
};

const removedSettings = [
  "minimumReleaseAgeExclude",
  "resolvePeersFromWorkspaceRoot",
  "dedupePeerDependents",
  "auditConfig",
  "ignoredBuiltDependencies",
];

const removedFiles = [
  "config/web-app-allowed-licenses.json",
  "scripts/web-app/assert-package-release-age.mjs",
  "scripts/web-app/check-licenses.mjs",
  "scripts/web-app/check-supply-chain.mjs",
];

function repoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

async function readRepoFile(relativePath) {
  return readFile(repoPath(relativePath), "utf8");
}

function normalizeText(contents) {
  return `${contents.replaceAll("\r\n", "\n").trimEnd()}\n`;
}

test("root Node tracks the current major and pnpm stays exact", async () => {
  assert.equal(normalizeText(await readRepoFile(".node-version")), "26\n");

  const manifest = JSON.parse(await readRepoFile("package.json"));
  assert.equal(manifest.packageManager, "pnpm@10.33.3");
  assert.deepEqual(manifest.engines, {
    node: ">=24.11.0",
    pnpm: "10.33.3",
  });
});

test("root tool dependencies are the exact approved set", async () => {
  const manifest = JSON.parse(await readRepoFile("package.json"));

  assert.deepEqual(manifest.devDependencies, expectedDevDependencies);
  assert.equal(
    Object.hasOwn(manifest, "pnpm"),
    false,
    "root package.json must not contain a pnpm block",
  );
});

test("pnpm uses only the minimal standard workspace policy", async () => {
  const npmrc = normalizeText(await readRepoFile(".npmrc"));
  const workspace = normalizeText(await readRepoFile("pnpm-workspace.yaml"));

  assert.equal(npmrc, expectedNpmrc);
  assert.equal(workspace, expectedWorkspace);

  const manifestText = await readRepoFile("package.json");
  for (const setting of removedSettings) {
    assert.doesNotMatch(
      `${workspace}\n${manifestText}`,
      new RegExp(`(?:^|["\\s])${setting}(?:["\\s:]|$)`, "m"),
      `${setting} must not be configured`,
    );
  }
});

test("custom supply-chain implementations are absent", () => {
  for (const relativePath of removedFiles) {
    assert.equal(
      existsSync(repoPath(relativePath)),
      false,
      `${relativePath} must not exist`,
    );
  }
});
