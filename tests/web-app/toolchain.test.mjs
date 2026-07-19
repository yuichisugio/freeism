import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const expectedNpmrc = `engine-strict=true
save-exact=true
`;

const expectedWorkspace = `packages:
  - projects/*
  - tools/*
minimumReleaseAge: 4320
minimumReleaseAgeExclude:
  - "vite-plus@0.2.5"
  - "@voidzero-dev/vite-plus-core@0.2.5"
blockExoticSubdeps: true
resolvePeersFromWorkspaceRoot: false
onlyBuiltDependencies:
  - esbuild
  - workerd
`;

const expectedDevDependencies = {
  "@changesets/cli": "2.31.1",
  tsx: "4.23.0",
  typescript: "7.0.2",
  vite: "npm:@voidzero-dev/vite-plus-core@0.2.5",
  "vite-plus": "0.2.5",
};

const removedSettings = [
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

const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const excludedDirectories = new Set(["node_modules", "dist", ".wrangler", "coverage"]);
const applicationManifestPaths = [
  "projects/main-web-app/package.json",
  "projects/docs-web-app/package.json",
  "projects/points-web-app/package.json",
  "projects/markets-web-app/package.json",
  "projects/web-app/package.json",
];
const vitePlusManifestPaths = [
  "package.json",
  "projects/points-web-app/package.json",
  "projects/markets-web-app/package.json",
];
const vitePlusCoreAlias = "npm:@voidzero-dev/vite-plus-core@0.2.5";
const vitestImport = /(?:from\s*|import\s*\(|import\s+|require\s*\()(["'])vitest(?:\/[^"']*)?\1/;

function repoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

async function readRepoFile(relativePath) {
  return readFile(repoPath(relativePath), "utf8");
}

function normalizeText(contents) {
  return `${contents.replaceAll("\r\n", "\n").trimEnd()}\n`;
}

async function collectSourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(absolutePath)));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolutePath);
  }
  return files;
}

function assertNoTypeScriptCompatibilityAliases(manifest, relativePath) {
  for (const section of dependencySections) {
    const dependencies = manifest[section] ?? {};
    assert.equal(
      Object.hasOwn(dependencies, "@typescript/native"),
      false,
      `${relativePath} ${section} must not declare @typescript/native`,
    );
    assert.equal(
      Object.hasOwn(dependencies, "@typescript/typescript6"),
      false,
      `${relativePath} ${section} must not declare @typescript/typescript6`,
    );
    for (const [name, version] of Object.entries(dependencies)) {
      assert.equal(
        typeof version === "string" && /^npm:@typescript\/(?:native|typescript6)@/.test(version),
        false,
        `${relativePath} ${section}.${name} must not alias a TypeScript compatibility package`,
      );
    }
  }
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
  assert.ok(
    manifest.scripts["contract:web-app:generate"].startsWith(
      "pnpm --filter @freeism/legacy-typescript-tools run openapi:web-app:generate",
    ),
    "contract:web-app:generate must delegate OpenAPI generation to the legacy tool workspace",
  );
  assert.doesNotMatch(
    manifest.scripts["contract:web-app:generate"],
    /(?:^|&&\s*)openapi-typescript(?:\s|$)/,
    "contract:web-app:generate must not invoke a root openapi-typescript binary",
  );
  assert.equal(
    Object.hasOwn(manifest, "pnpm"),
    false,
    "root package.json must not contain a pnpm block",
  );
});

test("the legacy compiler API tools are isolated in one private workspace", async () => {
  const relativePath = "tools/legacy-typescript-tools/package.json";
  const manifest = JSON.parse(await readRepoFile(relativePath));
  const toolWorkspaceManifests = (await readdir(repoPath("tools"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => `tools/${entry.name}/package.json`)
    .filter((manifestPath) => existsSync(repoPath(manifestPath)))
    .sort();

  assert.deepEqual(toolWorkspaceManifests, [relativePath]);
  assert.equal(manifest.name, "@freeism/legacy-typescript-tools");
  assert.equal(manifest.version, "0.0.0");
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, "module");
  assert.equal(manifest.devDependencies.typescript, "5.9.3");
  assert.equal(manifest.devDependencies["openapi-typescript"], "7.13.0");
  assert.equal(manifest.devDependencies["@shikijs/twoslash"], "4.3.1");
  assert.equal(Object.hasOwn(manifest, "publishConfig"), false);
  assertNoTypeScriptCompatibilityAliases(manifest, relativePath);

  for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
    assert.doesNotMatch(`${scriptName} ${command}`, /publish/i);
  }
});

test("docs commands delegate through the legacy tool dependency bridge", async () => {
  const toolManifest = JSON.parse(
    await readRepoFile("tools/legacy-typescript-tools/package.json"),
  );
  const docsManifest = JSON.parse(await readRepoFile("projects/docs-web-app/package.json"));

  for (const command of ["dev", "check", "build"]) {
    assert.equal(
      toolManifest.scripts[`docs:${command}`],
      `node ./link-docs-tool-dependencies.mjs && cd ../../projects/docs-web-app && blume ${command}`,
      `docs:${command} must link the docs tool dependencies before running blume ${command}`,
    );
    assert.equal(
      docsManifest.scripts[command],
      `pnpm --filter @freeism/legacy-typescript-tools run docs:${command}`,
      `docs-web-app ${command} must delegate to the legacy tool workspace`,
    );
  }

  assert.equal(
    existsSync(repoPath("tools/legacy-typescript-tools/link-docs-tool-dependencies.mjs")),
    true,
    "the docs tool dependency bridge helper must exist",
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

test("the root and all applications use TypeScript 7 without compatibility aliases", async () => {
  assertNoTypeScriptCompatibilityAliases(
    JSON.parse(await readRepoFile("package.json")),
    "package.json",
  );

  for (const relativePath of applicationManifestPaths) {
    const manifest = JSON.parse(await readRepoFile(relativePath));
    assert.equal(manifest.private, true, `${relativePath} must be private`);
    assert.equal(
      manifest.devDependencies.typescript,
      "7.0.2",
      `${relativePath} must expose TypeScript 7`,
    );
    assertNoTypeScriptCompatibilityAliases(manifest, relativePath);
  }
});

test("root and Vite Plus applications use the approved Vite toolchain", async () => {
  for (const relativePath of vitePlusManifestPaths) {
    const manifest = JSON.parse(await readRepoFile(relativePath));
    assert.equal(
      manifest.devDependencies.vite,
      vitePlusCoreAlias,
      `${relativePath} must alias vite to the approved Vite Plus core`,
    );
    assert.equal(
      manifest.devDependencies["vite-plus"],
      "0.2.5",
      `${relativePath} must use the approved Vite Plus version`,
    );
  }
});

test("Vitest is owned only by the Points and Markets Vite Plus applications", async () => {
  for (const relativePath of [
    "projects/points-web-app/package.json",
    "projects/markets-web-app/package.json",
  ]) {
    const manifest = JSON.parse(await readRepoFile(relativePath));
    assert.equal(
      manifest.devDependencies.vitest,
      "4.1.10",
      `${relativePath} must own the approved Vitest version`,
    );

    for (const section of dependencySections) {
      if (section === "devDependencies") continue;
      const dependencies = manifest[section] ?? {};
      assert.equal(
        Object.hasOwn(dependencies, "vitest"),
        false,
        `${relativePath} ${section} must not declare Vitest`,
      );
    }
  }
});

test("Points and Markets source no longer imports Vitest directly", async () => {
  for (const relativePath of ["projects/points-web-app", "projects/markets-web-app"]) {
    for (const absolutePath of await collectSourceFiles(repoPath(relativePath))) {
      assert.doesNotMatch(
        await readFile(absolutePath, "utf8"),
        vitestImport,
        `${path.relative(repoRoot, absolutePath)} must not import Vitest`,
      );
    }
  }
});

test("Vite Plus configs retain their imports while fixed-pages plugins use Vite types", async () => {
  for (const relativePath of [
    "projects/points-web-app/build/fixed-pages-plugin.ts",
    "projects/markets-web-app/build/fixed-pages-plugin.ts",
  ]) {
    const contents = await readRepoFile(relativePath);
    assert.match(
      contents,
      /import\s+(?:type\s+)?\{\s*Plugin\s*\}\s+from\s+["']vite["'];/,
      `${relativePath} must import Plugin from vite`,
    );
    assert.doesNotMatch(
      contents,
      /from\s+["']vite-plus["'];/,
      `${relativePath} must not import Plugin from vite-plus`,
    );
  }

  for (const relativePath of [
    "projects/points-web-app/vite.config.ts",
    "projects/points-web-app/vitest.config.ts",
    "projects/points-web-app/vitest.worker.config.ts",
    "projects/markets-web-app/vite.config.ts",
    "projects/markets-web-app/vitest.config.ts",
    "projects/markets-web-app/vitest.worker.config.ts",
  ]) {
    assert.match(
      await readRepoFile(relativePath),
      /import\s+\{\s*defineConfig\s*\}\s+from\s+["']vite-plus["'];/,
      `${relativePath} must import defineConfig from vite-plus`,
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
