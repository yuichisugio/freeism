import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../../", import.meta.url);

const expectedPackages = [
  ["projects/main-web-app/package.json", "main-web-app", "0.1.0"],
  ["projects/docs-web-app/package.json", "docs-web-app", "2.1.0"],
  ["projects/points-web-app/package.json", "@freeism/points-web-app", "0.0.0"],
  ["projects/markets-web-app/package.json", "@freeism/markets-web-app", "0.0.0"],
  ["projects/web-app/package.json", "web-app", "1.0.0"],
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, repoRoot), "utf8"));
}

test("Changesets versions only the five private application packages", async () => {
  const rootManifest = await readJson("package.json");

  assert.equal(rootManifest.scripts.changeset, "changeset");
  assert.equal(rootManifest.scripts["changeset:status"], "changeset status");
  assert.equal(rootManifest.scripts["version-packages"], "changeset version");
  assert.equal(rootManifest.devDependencies["@changesets/cli"], "2.31.1");

  for (const [relativePath, name, version] of expectedPackages) {
    const manifest = await readJson(relativePath);
    assert.equal(manifest.name, name);
    assert.equal(manifest.version, version);
    assert.equal(manifest.private, true);
    assert.equal(Object.hasOwn(manifest, "publishConfig"), false);
    for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
      assert.doesNotMatch(`${scriptName} ${command}`, /publish/i);
    }
  }
});

test("Changesets config versions private applications without tags", async () => {
  const config = await readJson(".changeset/config.json");

  assert.equal(config.$schema, "https://unpkg.com/@changesets/config@3.1.4/schema.json");
  assert.equal(config.changelog, "@changesets/cli/changelog");
  assert.equal(config.commit, false);
  assert.deepEqual(config.fixed, []);
  assert.deepEqual(config.linked, []);
  assert.equal(config.access, "restricted");
  assert.equal(config.baseBranch, "main");
  assert.equal(config.updateInternalDependencies, "patch");
  assert.deepEqual(config.ignore, []);
  assert.deepEqual(config.privatePackages, { version: true, tag: false });
});
