# TypeScript 7 Full Migration and Vite Plus Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the repository-owned TypeScript 6 compatibility aliases, make root and all five applications use TypeScript 7.0.2 directly, and make root/Points/Markets resolve Vite through Vite Plus 0.2.5 without changing the existing Changesets Version PR behavior.

**Architecture:** The six repository-owned manifests expose only `typescript@7.0.2`. Tools that still use the legacy compiler API may resolve TypeScript 5/6 only inside their own pnpm peer/dependency boundary; the workspace never exposes a compatibility alias. Root, Points, and Markets declare the same Vite Plus package and `vite` alias, while Points/Markets import the bundled test API from `vite-plus/test`.

**Tech Stack:** pnpm 10.33.3 workspaces, TypeScript 7.0.2, Vite Plus 0.2.5, Node.js 26 `node:test`, Changesets 2.31.1

## Global Constraints

- Root and the five application manifests declare `typescript: "7.0.2"` directly.
- Remove `@typescript/native` and every `npm:@typescript/typescript6` compatibility alias from repository-owned manifests.
- Root, Points, and Markets declare `vite-plus: "0.2.5"` and `vite: "npm:@voidzero-dev/vite-plus-core@0.2.5"`.
- Points and Markets keep exact `vitest: "4.1.10"` because `@cloudflare/vitest-pool-workers@0.18.2` requires a non-optional Vitest 4.1 peer, but no source/config import uses a module specifier equal to `vitest` or starting with `vitest/`.
- Keep `resolvePeersFromWorkspaceRoot: false` and exempt only `vite-plus@0.2.5` and `@voidzero-dev/vite-plus-core@0.2.5` from the 4320-minute release-age policy.
- Add external TypeScript 5/6 package boundaries only after a failing tool command proves that pnpm's ordinary peer resolution is insufficient.
- Do not change application versions, Changesets configuration, Version PR publishing behavior, npm publication, Git tags, or GitHub Releases.
- Do not refactor business source; fix only diagnostics introduced by this migration.

---

### Task 1: Lock the new toolchain contract with a failing test

**Files:**
- Modify: `tests/web-app/toolchain.test.mjs`

**Interfaces:**
- Consumes: the six `package.json` files and `pnpm-workspace.yaml` as text/JSON.
- Produces: a contract test that subsequent tasks must make green.

- [ ] **Step 1: Replace the root and workspace expectations**

Set the expected workspace policy to:

```yaml
packages:
  - projects/*
minimumReleaseAge: 4320
minimumReleaseAgeExclude:
  - "vite-plus@0.2.5"
  - "@voidzero-dev/vite-plus-core@0.2.5"
blockExoticSubdeps: true
resolvePeersFromWorkspaceRoot: false
onlyBuiltDependencies:
  - esbuild
  - workerd
```

Set the exact root `devDependencies` expectation to:

```js
const expectedDevDependencies = {
  "@changesets/cli": "2.31.1",
  "openapi-typescript": "7.13.0",
  tsx: "4.23.0",
  typescript: "7.0.2",
  vite: "npm:@voidzero-dev/vite-plus-core@0.2.5",
  "vite-plus": "0.2.5",
};
```

Remove `minimumReleaseAgeExclude` from `removedSettings`.

- [ ] **Step 2: Replace the TypeScript compatibility test**

For all five application manifests, assert `private === true`, `devDependencies.typescript === "7.0.2"`, and that no dependency section contains `@typescript/native`, `@typescript/typescript6`, or an `npm:` alias whose target is either package. Apply the same forbidden-alias assertion to the root manifest.

- [ ] **Step 3: Add the Vite Plus contract**

Assert that root, Points, and Markets have the exact Vite Plus and Vite alias values from the global constraints. Assert that Points and Markets own exact `devDependencies.vitest === "4.1.10"` and no other dependency section declares Vitest. Recursively inspect `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, and `.cjs` files under the two application roots, excluding `node_modules`, `dist`, `.wrangler`, and generated coverage directories, and fail on static/dynamic imports whose specifier is `vitest` or starts with `vitest/`.

Also assert that `projects/points-web-app/build/fixed-pages-plugin.ts` and `projects/markets-web-app/build/fixed-pages-plugin.ts` import `Plugin` from `vite`, not `vite-plus`. Config entry files continue to import `defineConfig` from `vite-plus`.

Use this dependency-section and source scan shape:

```js
const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const excludedDirectories = new Set(["node_modules", "dist", ".wrangler", "coverage"]);

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

const vitestImport = /(?:from\s*|import\s*\(|import\s+|require\s*\()(["'])vitest(?:\/[^"']*)?\1/;
```

Add `readdir` to the existing `node:fs/promises` import.

- [ ] **Step 4: Run the contract test and verify RED**

Run:

```bash
node --test tests/web-app/toolchain.test.mjs
```

Expected: FAIL because the current manifests still expose the TS6 alias, Vite Plus 0.2.4, upstream Vite 8.1.4, and three remaining `vitest` imports.

- [ ] **Step 5: Commit the RED contract**

```bash
git add tests/web-app/toolchain.test.mjs
git commit -m "test: require full TypeScript 7 toolchain"
```

### Task 2: Make repository-owned manifests and imports satisfy the contract

**Files:**
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Modify: `projects/main-web-app/package.json`
- Modify: `projects/docs-web-app/package.json`
- Modify: `projects/points-web-app/package.json`
- Modify: `projects/markets-web-app/package.json`
- Modify: `projects/web-app/package.json`
- Modify: `projects/points-web-app/test/worker/observability.worker.test.ts`
- Modify: `projects/points-web-app/src/backend/domain/money/scaled-amount.test.ts`
- Modify: `projects/markets-web-app/test/worker/ops-monitor.worker.test.ts`
- Modify: `projects/points-web-app/build/fixed-pages-plugin.ts`
- Modify: `projects/markets-web-app/build/fixed-pages-plugin.ts`

**Interfaces:**
- Consumes: the failing contract from Task 1.
- Produces: repository-owned TypeScript 7 manifests and one Vite Plus dependency graph for root/Points/Markets; lockfile remains intentionally stale until Task 3.

- [ ] **Step 1: Replace the six TypeScript declarations**

Set each repository-owned manifest's `devDependencies.typescript` to exact `"7.0.2"`. Remove root `devDependencies["@typescript/native"]`.

- [ ] **Step 2: Unify root, Points, and Markets on Vite Plus**

In all three manifests set:

```json
"vite": "npm:@voidzero-dev/vite-plus-core@0.2.5",
"vite-plus": "0.2.5"
```

Keep Points and Markets `vitest` at exact `4.1.10` for `@cloudflare/vitest-pool-workers`. Do not change main, docs, or legacy web-app Vite/Vitest declarations.

- [ ] **Step 3: Move the three remaining test imports**

In the three listed test files, replace only the module specifier:

```ts
from "vitest"
```

with:

```ts
from "vite-plus/test"
```

In both listed `build/fixed-pages-plugin.ts` files, replace:

```ts
import type { Plugin } from "vite-plus";
```

with:

```ts
import type { Plugin } from "vite";
```

- [ ] **Step 4: Add the narrow release-age exemptions**

Insert after `minimumReleaseAge: 4320`:

```yaml
minimumReleaseAgeExclude:
  - "vite-plus@0.2.5"
  - "@voidzero-dev/vite-plus-core@0.2.5"
```

Retain `resolvePeersFromWorkspaceRoot: false`.

- [ ] **Step 5: Run the contract test and verify GREEN before lock regeneration**

Run:

```bash
node --test tests/web-app/toolchain.test.mjs
```

Expected: PASS for all toolchain contract cases.

- [ ] **Step 6: Commit the manifest-level migration**

```bash
git add package.json pnpm-workspace.yaml projects/main-web-app/package.json projects/docs-web-app/package.json projects/points-web-app/package.json projects/markets-web-app/package.json projects/web-app/package.json projects/points-web-app/test/worker/observability.worker.test.ts projects/points-web-app/src/backend/domain/money/scaled-amount.test.ts projects/markets-web-app/test/worker/ops-monitor.worker.test.ts projects/points-web-app/build/fixed-pages-plugin.ts projects/markets-web-app/build/fixed-pages-plugin.ts
git commit -m "build: migrate workspaces to TypeScript 7"
```

### Task 3: Regenerate pnpm resolution and isolate only proven legacy compiler consumers

**Files:**
- Modify: `pnpm-lock.yaml`
- Conditionally modify after a proven RED: `pnpm-workspace.yaml`
- Conditionally update the exact workspace expectation: `tests/web-app/toolchain.test.mjs`

**Interfaces:**
- Consumes: Task 2 manifests and release-age exemptions.
- Produces: a frozen-installable lockfile where the six importers expose TypeScript 7 and external legacy compiler APIs resolve their own supported compiler.

- [ ] **Step 1: Regenerate the lockfile**

Run:

```bash
pnpm install --lockfile-only
pnpm install --frozen-lockfile
```

Expected: both commands exit 0; importer snapshots use `typescript: 7.0.2`, root/Points/Markets resolve the Vite Plus core alias, and no importer references `@typescript/typescript6`.

- [ ] **Step 2: Verify the six compiler entry points**

Run `pnpm exec tsc --version` at root and through each of these filters: `main-web-app`, `docs-web-app`, `@freeism/points-web-app`, `@freeism/markets-web-app`, and `web-app`. At the same six execution locations also run:

```bash
node -e 'import("typescript").then((ts) => console.log(ts.version))'
```

Expected for all six CLI checks: `Version 7.0.2`. Expected for all six bare module imports: `7.0.2`.

- [ ] **Step 3: RED-check compiler-API consumers**

Run:

```bash
pnpm contract:web-app:generate
pnpm --filter main-web-app check
pnpm --filter docs-web-app check
pnpm --filter web-app exec eslint src/lib/utils.ts
pnpm --filter web-app unused:check
```

If a command fails specifically because its external package resolves TypeScript 7 and calls a missing legacy compiler API, add only that exact package selector under `packageExtensions` with a direct `dependencies.typescript` entry. Use `6.0.3` for TS6-capable consumers and `5.9.3` for `openapi-typescript@7.13.0`. Reinstall, rerun the failing command to GREEN, and add the exact resulting YAML to the workspace contract test. Do not add extensions for commands that already pass or for unrelated diagnostics.

The only permitted conditional blocks are the following; copy only the block whose owning command produced the compiler-API RED:

```yaml
packageExtensions:
  openapi-typescript@7.13.0:
    dependencies:
      typescript: 5.9.3
  '@astrojs/check@0.9.9':
    dependencies:
      typescript: 6.0.3
  '@astrojs/language-server@2.16.12':
    dependencies:
      typescript: 6.0.3
  twoslash@0.3.9:
    dependencies:
      typescript: 6.0.3
  '@typescript-eslint/typescript-estree@8.59.1':
    dependencies:
      typescript: 6.0.3
  knip@5.88.1:
    dependencies:
      typescript: 6.0.3
```

If ordinary pnpm peer resolution makes every command pass, omit `packageExtensions` entirely.

- [ ] **Step 4: Inspect the Vite resolution graph**

Run:

```bash
pnpm --filter @freeism/points-web-app why vite
pnpm --filter @freeism/markets-web-app why vite
pnpm --filter @freeism/points-web-app why vitest
pnpm --filter @freeism/markets-web-app why vitest
```

Expected: the direct `vite` edge resolves to `@voidzero-dev/vite-plus-core@0.2.5`; Points/Markets declare Vitest 4.1.10 directly to satisfy the Workers pool, matching Vite Plus 0.2.5's bundled Vitest version. Peer consumers must use that aligned Vite Plus/Vitest graph rather than creating the previous upstream Vite 8.1.4 split.

- [ ] **Step 5: Run the contract test and frozen install again**

```bash
node --test tests/web-app/toolchain.test.mjs
pnpm install --frozen-lockfile
```

Expected: both exit 0.

- [ ] **Step 6: Commit the resolved dependency graph**

```bash
git add pnpm-lock.yaml pnpm-workspace.yaml tests/web-app/toolchain.test.mjs
git commit -m "build: isolate legacy TypeScript tool boundaries"
```

### Task 4: Verify application behavior and migration boundaries

**Files:**
- Modify only if a command proves a migration regression: the smallest source/config file named by that diagnostic.
- Update if a migration-only fix is required: `tests/web-app/toolchain.test.mjs` or the nearest existing package test.

**Interfaces:**
- Consumes: the frozen lockfile from Task 3.
- Produces: fresh evidence for compiler versions, application checks/tests/builds, Vite type unification, and unchanged Changesets behavior.

- [ ] **Step 1: Run root contracts**

```bash
node --test tests/changesets/*.test.mjs tests/web-app/toolchain.test.mjs
pnpm contract:web-app:check
```

Expected: all Node tests pass and generated OpenAPI client files have no diff.

- [ ] **Step 2: Run main and docs verification**

```bash
pnpm --filter main-web-app test
pnpm --filter main-web-app check
pnpm --filter main-web-app build
pnpm --filter docs-web-app test
pnpm --filter docs-web-app check
pnpm --filter docs-web-app build
```

Expected: all six commands exit 0.

- [ ] **Step 3: Run Points verification**

```bash
pnpm --filter @freeism/points-web-app check
pnpm --filter @freeism/points-web-app test
pnpm --filter @freeism/points-web-app test:worker
pnpm --filter @freeism/points-web-app build
pnpm --filter @freeism/points-web-app exec tsc --noEmit
```

Expected: Vite `PluginOption`/`UserConfig` duplicate-type diagnostics are absent. If the pre-existing `Request` generic diagnostic remains, record it as baseline rather than changing unrelated business source.

- [ ] **Step 4: Run Markets verification**

```bash
pnpm --filter @freeism/markets-web-app check
pnpm --filter @freeism/markets-web-app test
pnpm --filter @freeism/markets-web-app test:worker
pnpm --filter @freeism/markets-web-app build
pnpm --filter @freeism/markets-web-app exec tsc --noEmit
```

Expected: all commands exit 0 and Vite duplicate-type diagnostics are absent.

- [ ] **Step 5: Run legacy web-app boundary checks**

```bash
pnpm --filter web-app typecheck
pnpm --filter web-app test
pnpm --filter web-app exec prisma validate
pnpm --filter web-app exec prisma generate
pnpm --filter web-app unused:check
```

Compare any diagnostics with the pre-migration baseline recorded in agent reports and prior verification. Fix only a new TypeScript 7 migration diagnostic; preserve existing unrelated failures as documented baseline.

- [ ] **Step 6: Audit requirements and commit any verified migration-only fix**

Confirm from `git diff`, the six manifests, workspace YAML, `pnpm why`, and compiler version output that every global constraint is satisfied. If Task 4 required a minimal tracked-file fix, rerun its covering command, then stage tracked modifications and commit:

```bash
git add -u
git commit -m "fix: address TypeScript 7 migration diagnostics"
```

If no Task 4 source/config fix was required, do not create an empty commit.
