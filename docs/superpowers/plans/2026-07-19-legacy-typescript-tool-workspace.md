# Legacy TypeScript Tool Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep root and all five applications directly on TypeScript 7.0.2 while restoring OpenAPI generation, Astro/Blume checks, legacy ESLint, and Knip through one private, non-versioned tool workspace.

**Architecture:** `tools/legacy-typescript-tools` owns the compiler-API consumers and exact TypeScript 5.9.3. Blume retains its supported internal TypeScript 6 dependency. Root and application scripts keep their public names and delegate only the affected CLI execution to the tool workspace. Changesets explicitly ignores the tool package so Version PRs still manage exactly five application versions and CHANGELOGs.

**Tech Stack:** pnpm 10.33.3 workspaces, TypeScript 7.0.2 applications, TypeScript 5.9.3 legacy tool boundary, Blume 1.0.3 internal TypeScript 6.0.3, Node.js 26 `node:test`, Changesets 2.31.1

## Global Constraints

- Add no TypeScript 5/6 dependency or compatibility alias to root or the five application manifests.
- `tools/legacy-typescript-tools` is private, has no publish script/config, and is the only workspace manifest that directly declares TypeScript 5.9.3.
- Do not override Blume's declared TypeScript 6 dependency to TypeScript 5.
- Preserve the existing root/application script names and their output paths.
- Preserve the existing five application versions and CHANGELOG contents.
- Changesets ignores only `@freeism/legacy-typescript-tools`; npm publish, Git tags, and GitHub Releases remain absent.
- Keep application runtime/build/test dependencies in their application manifests when source or framework runtime imports them.

---

### Task 1: Lock the dedicated tool boundary with failing contracts

**Files:**
- Modify: `tests/web-app/toolchain.test.mjs`
- Modify: `tests/changesets/changesets-config.test.mjs`
- Create: `tests/web-app/legacy-tool-workspace.test.mjs`

**Interfaces:**
- Consumes: workspace YAML, root/application/tool manifests, Changesets config, and installed package resolution.
- Produces: static ownership contracts plus runtime compiler-resolution contracts.

- [ ] **Step 1: Add the workspace and root ownership expectations**

Update the exact workspace text so `packages` contains both globs in this order:

```yaml
packages:
  - projects/*
  - tools/*
```

Remove `openapi-typescript` from the exact root `devDependencies` expectation. Assert that root `contract:web-app:generate` starts by running `pnpm --filter @freeism/legacy-typescript-tools run openapi:web-app:generate` and does not invoke a bare root `openapi-typescript` binary.

- [ ] **Step 2: Add the tool manifest contract**

Assert that `tools/legacy-typescript-tools/package.json` has:

```json
{
  "name": "@freeism/legacy-typescript-tools",
  "version": "0.0.0",
  "private": true,
  "type": "module"
}
```

Assert exact `devDependencies.typescript === "5.9.3"` and `devDependencies.openapi-typescript === "7.13.0"`. Assert it has no `publishConfig` and no script name or command containing `publish`.

Keep the existing root-plus-five application array unchanged and continue asserting exact direct TypeScript 7.0.2 with no compatibility alias in all six manifests.

- [ ] **Step 3: Keep Changesets limited to five applications**

Change the config expectation to:

```js
assert.deepEqual(config.ignore, ["@freeism/legacy-typescript-tools"]);
```

Also assert the tool manifest is private/nonpublishable, but do not append it to `expectedPackages`; that list remains exactly the five application packages and current versions.

- [ ] **Step 4: Add installed resolver assertions**

In `legacy-tool-workspace.test.mjs`, resolve each consumer's real package directory from `tools/legacy-typescript-tools/node_modules`, create a `require` rooted at that real package path, and read its resolved `typescript/package.json` version. Assert:

```js
{
  "openapi-typescript": "5.9.3",
  "@astrojs/check": "5.9.3",
  "@typescript-eslint/parser": "5.9.3",
  "knip": "5.9.3",
  "blume": "6.0.3"
}
```

Also assert the tool workspace's own bare `typescript` is 5.9.3. Do not inspect `pnpm why` text by exact string comparison.

- [ ] **Step 5: Run the contracts and verify RED**

Run:

```bash
node --test tests/changesets/changesets-config.test.mjs tests/web-app/toolchain.test.mjs tests/web-app/legacy-tool-workspace.test.mjs
```

Expected: FAIL because `tools/*`, the tool manifest, compiler resolver graph, wrapper scripts, and Changesets ignore entry do not exist yet.

- [ ] **Step 6: Commit the RED contracts**

```bash
git add tests/changesets/changesets-config.test.mjs tests/web-app/toolchain.test.mjs tests/web-app/legacy-tool-workspace.test.mjs
git commit -m "test: require dedicated legacy tool workspace"
```

---

### Task 2: Create the tool workspace and route affected commands

**Files:**
- Create: `tools/legacy-typescript-tools/package.json`
- Create: `tools/legacy-typescript-tools/eslint.web-app.config.mjs`
- Create: `tools/legacy-typescript-tools/link-docs-tool-dependencies.mjs`
- Modify: `pnpm-workspace.yaml`
- Modify: `.changeset/config.json`
- Modify: `package.json`
- Modify: `projects/main-web-app/package.json`
- Modify: `projects/docs-web-app/package.json`
- Modify: `projects/docs-web-app/src/build-contract.test.ts`
- Modify: `projects/web-app/package.json`
- Modify: `projects/web-app/eslint.config.mjs`
- Modify: `projects/web-app/.lintstagedrc`

**Interfaces:**
- Root/application scripts delegate to `@freeism/legacy-typescript-tools`.
- Application source continues to import application runtime dependencies normally.
- ESLint's executable, config imports, parser, and plugins all resolve from the tool workspace.

- [ ] **Step 1: Create the private tool package**

Use this exact manifest dependency set, all taken from the currently resolved graph and the successful isolated prototype:

```json
{
  "name": "@freeism/legacy-typescript-tools",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "openapi:web-app:generate": "openapi-typescript ../../docs/web-app/v0.2/points-markets.openapi.json -o ../../projects/points-web-app/src/generated/points-markets-api.ts && openapi-typescript ../../docs/web-app/v0.2/points-markets.openapi.json -o ../../projects/markets-web-app/src/generated/points-markets-api.ts",
    "main:check": "astro check --root ../../projects/main-web-app --tsconfig ../../projects/main-web-app/tsconfig.json",
    "docs:dev": "node ./link-docs-tool-dependencies.mjs && cd ../../projects/docs-web-app && blume dev",
    "docs:check": "node ./link-docs-tool-dependencies.mjs && cd ../../projects/docs-web-app && blume check",
    "docs:build": "node ./link-docs-tool-dependencies.mjs && cd ../../projects/docs-web-app && blume build",
    "web:lint": "cd ../../projects/web-app && eslint --config ../../tools/legacy-typescript-tools/eslint.web-app.config.mjs .",
    "web:lint:files": "cd ../../projects/web-app && eslint --config ../../tools/legacy-typescript-tools/eslint.web-app.config.mjs",
    "web:knip": "knip --directory ../../projects/web-app --config ../../projects/web-app/knip.json"
  },
  "devDependencies": {
    "@astrojs/check": "0.9.9",
    "@eslint/eslintrc": "3.3.5",
    "@shikijs/twoslash": "4.3.1",
    "@tanstack/eslint-plugin-query": "5.100.6",
    "@types/node": "20.19.39",
    "@typescript-eslint/eslint-plugin": "8.59.1",
    "@typescript-eslint/parser": "8.59.1",
    "@vitest/eslint-plugin": "1.6.16",
    "astro": "6.4.8",
    "blume": "1.0.3",
    "eslint": "9.39.4",
    "eslint-config-next": "15.4.0-canary.51",
    "eslint-plugin-import": "2.32.0",
    "eslint-plugin-jsx-a11y": "6.10.2",
    "eslint-plugin-react": "7.37.5",
    "eslint-plugin-react-hooks": "5.2.0",
    "eslint-plugin-unicorn": "56.0.1",
    "knip": "5.88.1",
    "next": "15.3.0",
    "openapi-typescript": "7.13.0",
    "react": "19.2.5",
    "react-dom": "19.2.5",
    "typescript": "5.9.3",
    "vitest": "3.2.4"
  }
}
```

- [ ] **Step 2: Register and exclude the tool package**

Add `tools/*` after `projects/*` in `pnpm-workspace.yaml`. Set `.changeset/config.json` `ignore` to the one exact package name. Do not change `privatePackages`, versions, CHANGELOGs, workflow, or publish settings.

- [ ] **Step 3: Route OpenAPI and Astro check**

Remove root `openapi-typescript`, then replace only the generation prefix with the tool script; retain the two Vite Plus formatting commands and `contract:web-app:check` diff check.

Remove `@astrojs/check` from `main-web-app`, and change only `check` to:

```json
"check": "pnpm --filter @freeism/legacy-typescript-tools run main:check"
```

- [ ] **Step 4: Route the docs compiler-API commands**

Remove the redundant direct `@astrojs/check` and `@shikijs/twoslash` entries from docs; Blume already owns supported TypeScript 6 instances of both. Keep `blume`, Astro, MDX, Tailwind, and other runtime/build dependencies in docs because application source and config import them.

Blumeが生成する`.blume/astro.config.mjs`は生成fileの位置から`@shikijs/twoslash`を解決するため、tool workspace全体を公開せず、専用workspaceのTwoslashだけを`.blume/node_modules/@shikijs/twoslash`へlinkする`link-docs-tool-dependencies.mjs`を追加する。既に同じtargetを指すlinkは再利用し、それ以外のfile/linkが存在する場合は削除せず明示的に失敗する。

Change docs `dev`, `check`, and `build` to the tool wrappers. Update `src/build-contract.test.ts` to execute `pnpm run build` instead of bypassing the public script with `pnpm exec blume build`.

- [ ] **Step 5: Move the ESLint execution graph and Knip**

Copy the existing web ESLint config body to `tools/legacy-typescript-tools/eslint.web-app.config.mjs`. Keep its rules and globs unchanged, but set `parserOptions.tsconfigRootDir` to the absolute `projects/web-app` directory derived from `import.meta.url`; keep `project: "./tsconfig.eslint.json"`.

Replace `projects/web-app/eslint.config.mjs` with a re-export of the tool config so editor discovery still works:

```js
export { default } from "../../tools/legacy-typescript-tools/eslint.web-app.config.mjs";
```

Remove from web-app only `knip` and the packages imported by that ESLint config or required by its executable/preset: `@eslint/eslintrc`, `@tanstack/eslint-plugin-query`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@vitest/eslint-plugin`, `eslint`, `eslint-config-next`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `eslint-plugin-unicorn`. Keep the unrelated existing `eslint-plugin-vitest` entry unchanged.

Set scripts to:

```json
{
  "lint": "pnpm --filter @freeism/legacy-typescript-tools run web:lint",
  "lint:fix": "pnpm --filter @freeism/legacy-typescript-tools run web:lint --fix && prisma validate",
  "unused:check": "pnpm --filter @freeism/legacy-typescript-tools run web:knip",
  "knip": "pnpm --filter @freeism/legacy-typescript-tools run web:knip"
}
```

Change the TypeScript lint-staged command to:

```json
"*.{ts,tsx}": ["pnpm --filter @freeism/legacy-typescript-tools run web:lint:files --fix"]
```

- [ ] **Step 6: Run static contracts before lock regeneration**

Run:

```bash
node --test tests/changesets/changesets-config.test.mjs tests/web-app/toolchain.test.mjs
```

Expected: static contracts PASS; installed resolver test remains pending until Task 3 regenerates dependencies.

- [ ] **Step 7: Commit the implementation without the lockfile**

```bash
git add .changeset/config.json pnpm-workspace.yaml package.json projects/main-web-app/package.json projects/docs-web-app/package.json projects/docs-web-app/src/build-contract.test.ts projects/web-app/package.json projects/web-app/eslint.config.mjs projects/web-app/.lintstagedrc tools/legacy-typescript-tools
git commit -m "build: isolate legacy TypeScript tools"
```

---

### Task 3: Regenerate resolution and verify command parity

**Files:**
- Modify: `pnpm-lock.yaml`
- Modify only if an observed command requires it: files owned by Task 2

**Interfaces:**
- Produces: a frozen-installable lockfile with six TS7 importers plus one explicit legacy tool importer.
- Verifies: generated output parity and executable command behavior.

- [ ] **Step 1: Regenerate the lockfile**

Run normal lock generation first:

```bash
pnpm install --lockfile-only
```

If only the already-observed Vite Plus 0.2.5 platform optional packages are blocked by release age, run the one-time resolution command without persisting a wider exemption:

```bash
pnpm --config.minimum-release-age=0 install --lockfile-only
```

Then run:

```bash
CI=true pnpm install --frozen-lockfile
```

- [ ] **Step 2: Verify the compiler boundary contracts**

Run:

```bash
node --test tests/changesets/*.test.mjs tests/web-app/toolchain.test.mjs tests/web-app/legacy-tool-workspace.test.mjs
```

Expected: all PASS. Also run root plus five application `tsc --version` and bare `typescript` import checks; all twelve results remain 7.0.2.

- [ ] **Step 3: Verify OpenAPI parity**

Run:

```bash
pnpm contract:web-app:check
```

Expected: generation succeeds and both generated files have no Git diff.

- [ ] **Step 4: Verify the affected external tools**

Run:

```bash
pnpm --filter main-web-app check
pnpm --filter docs-web-app check
pnpm --filter docs-web-app build
pnpm --filter @freeism/legacy-typescript-tools run web:lint:files -- src/actions/cloudflare/r2-client-config.ts
pnpm --filter web-app unused:check
```

Expected: Astro, Blume, and ESLint exit 0. Knip must reach and report the existing unused findings instead of crashing in TypeScript; retain its nonzero result as baseline unless the finding set changes because of this task.

- [ ] **Step 5: Run package regression checks**

Run the existing package checks from the parent migration plan: main test/build; docs test; Points/Markets check, test, worker test, and build; legacy web typecheck/test and Prisma validate/generate. Compare known baseline diagnostics rather than claiming unrelated existing failures as migration regressions.

- [ ] **Step 6: Inspect the resolved graph**

Confirm:

- root and five application importers directly resolve TypeScript 7.0.2;
- the tool importer directly resolves TypeScript 5.9.3;
- Blume resolves its own TypeScript 6.0.3;
- no `@typescript/typescript6` alias exists;
- Points/Markets still have one Vite Plus core graph and one Vitest 4.1.10 graph;
- Changesets status sees only the five versioned applications.

- [ ] **Step 7: Commit the lockfile and any evidence-driven corrections**

```bash
git add pnpm-lock.yaml
git commit -m "build: resolve legacy TypeScript tool workspace"
```

---

### Task 4: Review the combined migration

**Files:**
- Review: all changes from `0ddb4f78` through Task 3 HEAD
- Update: `.superpowers/sdd/progress.md`
- Create: `.superpowers/sdd/task-4-report.md`

- [ ] **Step 1: Review specification compliance**

Verify the combined branch still provides Changesets-managed Version PRs for exactly five private applications, no npm publish path, full direct TS7 for root/apps, and Vite Plus unification for Points/Markets.

- [ ] **Step 2: Review dependency and command boundaries**

Check that only observed legacy compiler consumers were isolated, application runtime dependencies were not accidentally removed, public scripts preserve their meaning, and no command silently lints/builds a different directory.

- [ ] **Step 3: Run final verification**

Run `git diff --check`, the full contract suite, frozen install, the affected tool commands, and the package regression matrix. Record exact passing commands and clearly separate any unchanged baseline failures.

- [ ] **Step 4: Commit only if the report is repository-tracked by the existing SDD convention**

Do not amend implementation commits merely to include a local report. The final branch must have no unintended generated artifact or application version/CHANGELOG change.
