import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { linkDocsToolDependency } from "../../tools/legacy-typescript-tools/link-docs-tool-dependencies.mjs";

async function createFixture(t) {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "freeism-docs-tool-bridge-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));

  const physicalPackage = path.join(
    fixtureRoot,
    "store",
    "@shikijs+twoslash@4.3.1",
    "node_modules",
    "@shikijs",
    "twoslash",
  );
  const physicalTypeScript = path.join(physicalPackage, "node_modules", "typescript");
  await mkdir(physicalTypeScript, { recursive: true });
  await writeFile(
    path.join(physicalPackage, "package.json"),
    `${JSON.stringify({ name: "@shikijs/twoslash", version: "4.3.1" })}\n`,
  );
  await writeFile(
    path.join(physicalTypeScript, "package.json"),
    `${JSON.stringify({ name: "typescript", version: "5.9.3" })}\n`,
  );

  const source = path.join(
    fixtureRoot,
    "tool",
    "node_modules",
    "@shikijs",
    "twoslash",
  );
  await mkdir(path.dirname(source), { recursive: true });
  await symlink(path.relative(path.dirname(source), physicalPackage), source, "dir");

  const managedRoot = path.join(fixtureRoot, "docs", ".blume");
  const destination = path.join(managedRoot, "node_modules", "@shikijs", "twoslash");

  return { destination, fixtureRoot, managedRoot, physicalPackage, source };
}

async function linkFixture(fixture) {
  await linkDocsToolDependency({
    source: fixture.source,
    destination: fixture.destination,
    managedRoot: fixture.managedRoot,
  });
}

test("links the pnpm consumer relatively and restores it after managed cleanup", async (t) => {
  const fixture = await createFixture(t);

  await linkFixture(fixture);
  assert.equal(
    await readlink(fixture.destination),
    path.relative(path.dirname(fixture.destination), fixture.source),
  );
  assert.equal(await realpath(fixture.destination), await realpath(fixture.source));

  const firstLink = await lstat(fixture.destination);
  await linkFixture(fixture);
  const secondLink = await lstat(fixture.destination);
  assert.equal(secondLink.ino, firstLink.ino, "a matching link must be left unchanged");

  await rm(fixture.managedRoot, { recursive: true });
  await linkFixture(fixture);
  assert.equal(await realpath(fixture.destination), fixture.physicalPackage);

  const requireFromDestination = createRequire(path.join(fixture.destination, "package.json"));
  const typeScriptManifest = JSON.parse(
    await readFile(requireFromDestination.resolve("typescript/package.json"), "utf8"),
  );
  assert.equal(typeScriptManifest.version, "5.9.3");
});

test("rejects an existing destination file without changing it", async (t) => {
  const fixture = await createFixture(t);
  await mkdir(path.dirname(fixture.destination), { recursive: true });
  await writeFile(fixture.destination, "keep this file\n");

  await assert.rejects(() => linkFixture(fixture));
  assert.equal(await readFile(fixture.destination, "utf8"), "keep this file\n");
});

test("rejects an existing destination directory without changing it", async (t) => {
  const fixture = await createFixture(t);
  await mkdir(fixture.destination, { recursive: true });
  const marker = path.join(fixture.destination, "keep.txt");
  await writeFile(marker, "keep this directory\n");

  await assert.rejects(() => linkFixture(fixture));
  assert.equal(await readFile(marker, "utf8"), "keep this directory\n");
});

test("rejects a broken destination symlink without changing it", async (t) => {
  const fixture = await createFixture(t);
  await mkdir(path.dirname(fixture.destination), { recursive: true });
  const brokenTarget = "../../missing-twoslash";
  await symlink(brokenTarget, fixture.destination, "dir");

  await assert.rejects(() => linkFixture(fixture));
  assert.equal(await readlink(fixture.destination), brokenTarget);
});

test("rejects a destination symlink to another target without changing it", async (t) => {
  const fixture = await createFixture(t);
  const otherTarget = path.join(fixture.fixtureRoot, "other-twoslash");
  await mkdir(otherTarget, { recursive: true });
  await mkdir(path.dirname(fixture.destination), { recursive: true });
  const relativeTarget = path.relative(path.dirname(fixture.destination), otherTarget);
  await symlink(relativeTarget, fixture.destination, "dir");

  await assert.rejects(() => linkFixture(fixture));
  assert.equal(await readlink(fixture.destination), relativeTarget);
  assert.equal(await realpath(fixture.destination), otherTarget);
});

for (const ancestor of ["managedRoot", "node_modules", "@shikijs"]) {
  test(`rejects an external symlink at the ${ancestor} managed ancestor`, async (t) => {
    const fixture = await createFixture(t);
    const externalDirectory = path.join(fixture.fixtureRoot, `external-${ancestor}`);
    await mkdir(externalDirectory, { recursive: true });

    const ancestorPath =
      ancestor === "managedRoot"
        ? fixture.managedRoot
        : path.join(
            fixture.managedRoot,
            "node_modules",
            ...(ancestor === "@shikijs" ? ["@shikijs"] : []),
          );
    await mkdir(path.dirname(ancestorPath), { recursive: true });
    await symlink(
      path.relative(path.dirname(ancestorPath), externalDirectory),
      ancestorPath,
      "dir",
    );

    await assert.rejects(() => linkFixture(fixture));
    assert.deepEqual(
      await readdir(externalDirectory),
      [],
      "the helper must not create paths through an external ancestor symlink",
    );
  });
}
