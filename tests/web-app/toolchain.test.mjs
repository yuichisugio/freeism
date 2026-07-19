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
resolvePeersFromWorkspaceRoot: false
onlyBuiltDependencies:
  - esbuild
  - workerd
`;

const expectedDevDependencies = {
  "@changesets/cli": "2.31.1",
  "@typescript/native": "npm:typescript@7.0.2",
  "openapi-typescript": "7.13.0",
  tsx: "4.23.0",
  typescript: "npm:@typescript/typescript6@6.0.2",
  "vite-plus": "0.2.4",
};

const removedSettings = [
  "minimumReleaseAgeExclude",
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

test("all applications use the TypeScript 6 compatibility API package", async () => {
  for (const relativePath of [
    "projects/main-web-app/package.json",
    "projects/docs-web-app/package.json",
    "projects/points-web-app/package.json",
    "projects/markets-web-app/package.json",
    "projects/web-app/package.json",
  ]) {
    const manifest = JSON.parse(await readRepoFile(relativePath));
    assert.equal(manifest.private, true, `${relativePath} must be private`);
    assert.equal(
      manifest.devDependencies.typescript,
      "npm:@typescript/typescript6@6.0.2",
      `${relativePath} must expose the TypeScript 6 compatibility API`,
    );
  }
});

test("legacy script config keeps paths without the removed baseUrl option", async () => {
  const config = JSON.parse(await readRepoFile("projects/web-app/tsconfig.scripts.json"));

  assert.equal(Object.hasOwn(config.compilerOptions, "baseUrl"), false);
  assert.deepEqual(config.compilerOptions.paths, {
    "@/*": ["./src/*"],
    "@/scripts/*": ["./scripts/*"],
    "@/lib/*": ["./src/lib/*"],
    "@/prisma/client/*": ["./src/prisma/client/*"],
  });
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
