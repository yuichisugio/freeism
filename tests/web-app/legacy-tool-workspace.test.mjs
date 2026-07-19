import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, realpath } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const toolWorkspace = path.join(repoRoot, "tools/legacy-typescript-tools");

async function readResolvedTypeScriptVersion(requireFrom) {
  const manifestPath = requireFrom.resolve("typescript/package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return manifest.version;
}

async function requireFromRealConsumer(packageName) {
  const consumerDirectory = await realpath(
    path.join(toolWorkspace, "node_modules", ...packageName.split("/")),
  );
  return createRequire(path.join(consumerDirectory, "package.json"));
}

test("the legacy tool workspace resolves its own TypeScript 5 compiler", async () => {
  const requireFromTool = createRequire(path.join(toolWorkspace, "package.json"));

  assert.equal(await readResolvedTypeScriptVersion(requireFromTool), "5.9.3");
});

test("each compiler API consumer resolves its supported TypeScript compiler", async () => {
  const expectedVersions = {
    "openapi-typescript": "5.9.3",
    "@astrojs/check": "5.9.3",
    "@shikijs/twoslash": "5.9.3",
    "@typescript-eslint/parser": "5.9.3",
    knip: "5.9.3",
    blume: "6.0.3",
  };

  for (const [packageName, expectedVersion] of Object.entries(expectedVersions)) {
    const requireFromConsumer = await requireFromRealConsumer(packageName);
    assert.equal(
      await readResolvedTypeScriptVersion(requireFromConsumer),
      expectedVersion,
      `${packageName} must resolve TypeScript ${expectedVersion}`,
    );
  }
});
