# Freeism Main and Docs Sites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `freeism.app` の静的ポータルと、既存日英Markdownを掲載する `docs.freeism.app` 向けAstroドキュメントサイトをmonorepoへ追加する。

**Architecture:** `projects/main-web-app` は依存を抑えた素のAstroサイト、`projects/docs-web-app` はAstro製のBlumeサイトとする。両者は別成果物としてbuildし、Points／MarketsとはHTTPSリンクだけで接続する。

**Tech Stack:** pnpm 10.33.3 workspace、Astro 6、Blume、TypeScript、Vitest、Playwright（既存repo tooling）、textlint。

## Global Constraints

- 既存24ファイルの未コミット変更は元のmain worktreeへ残し、このブランチへ含めない。
- branchは `codex/freeism-main-docs-sites`、worktreeは `/private/tmp/freeism-main-docs-sites` を使う。
- `projects/documentation` の本文内容と日英の対応を保ち、初回移行で章分割しない。
- `origin/main:projects/documentation` のMarkdownと移動後ファイルをSHA-256で照合し、canonical本文へfrontmatterを含む一切の変更を加えない。
- `freeism.app`、`docs.freeism.app`、`points.freeism.app`、`markets.freeism.app` は独立した公開境界とする。
- 既存主色 `#4880FF` を使い、モバイル、キーボード、reduced motionに対応する。
- 既存Vercel previewのテストDB migrationを、今回のlockfile変更だけで発火させない。
- DNS、custom domain、外部ホスティング設定は変更しない。

---

### Task 1: Astro workspace skeleton and documentation rename

**Files:**
- Move: `projects/documentation/**` → `projects/docs-web-app/**`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.husky/pre-commit`
- Modify: `.gitignore`
- Modify: `.github/CODEOWNERS`
- Modify: repository README and documentation Issue/PR templates containing `projects/documentation`
- Create: `projects/main-web-app/package.json`
- Create: `projects/main-web-app/astro.config.mjs`
- Create: `projects/main-web-app/tsconfig.json`

**Interfaces:**
- Produces workspace packages named `main-web-app` and `docs-web-app`.
- Preserves `pnpm --filter docs-web-app lint` as the prose validation entry point.

- [ ] **Step 1: Record rename references before changing files**

Run: `rg -n "projects/documentation|--filter documentation|documentation@" -g '!node_modules' -g '!projects/**/archive/**'`

Expected: every operational reference to update is enumerated before the move.

- [ ] **Step 2: Move the directory and preserve symlinks/configuration**

Move the tracked tree to `projects/docs-web-app`, preserving `CLAUDE.md -> AGENTS.md`, `.husky`, textlint, lint-staged, and Markdown files.

- [ ] **Step 3: Add the two Astro package manifests**

Use exact package names `main-web-app` and `docs-web-app`, scripts `dev`, `check`, `test`, and `build`; retain `lint`, `lint:fix`, and `lint-staged` on docs.

- [ ] **Step 4: Update operational path references only**

Update hooks, CODEOWNERS, root scripts, active documentation, and templates. Do not rewrite archive datasets or prose that merely discusses documentation generically.

- [ ] **Step 5: Regenerate and verify the lockfile**

Run: `pnpm install --lockfile-only --ignore-scripts`

Expected: lockfile importer is `projects/docs-web-app`, `projects/main-web-app` is present, and `projects/documentation` importer is absent.

### Task 2: Build the Freeism portal with test-first behavior

**Files:**
- Create: `projects/main-web-app/src/data/sites.ts`
- Create: `projects/main-web-app/src/data/sites.test.ts`
- Create: `projects/main-web-app/src/pages/index.astro`
- Create: `projects/main-web-app/src/styles/global.css`
- Create: `projects/main-web-app/src/components/ProjectOrbit.astro`
- Create: `projects/main-web-app/public/favicon.svg`

**Interfaces:**
- `sites.ts` exports `FREEISM_SITES` with `docs`, `points`, and `markets` entries containing an HTTPS URL, label, and responsibility.
- `index.astro` renders those entries as normal anchor elements and contains no client-side framework runtime.

- [ ] **Step 1: Write the failing site-contract test**

```ts
import { describe, expect, it } from 'vitest';
import { FREEISM_SITES } from './sites';

describe('FREEISM_SITES', () => {
  it('exposes the three independent Freeism destinations over HTTPS', () => {
    expect(FREEISM_SITES.map(({ url }) => url)).toEqual([
      'https://docs.freeism.app/',
      'https://points.freeism.app/',
      'https://markets.freeism.app/',
    ]);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter main-web-app test`

Expected: FAIL because `src/data/sites.ts` does not exist.

- [ ] **Step 3: Add the minimal typed site data**

Create a readonly array with the exact three URLs, Japanese labels, and responsibilities from the design specification.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `pnpm --filter main-web-app test`

Expected: one passing test, zero failures.

- [ ] **Step 5: Implement the one-page portal**

Use semantic `header`, `main`, `section`, `nav`, and `footer`. Render the 3-role explanation and project orbit without JavaScript. Use CSS custom properties for all design tokens.

- [ ] **Step 6: Verify the static build**

Run: `pnpm --filter main-web-app check && pnpm --filter main-web-app build`

Expected: both commands exit 0 and `dist/index.html` contains the three destination URLs.

### Task 3: Build the Blume documentation site without changing canonical Markdown

**Files:**
- Create: `projects/docs-web-app/blume.config.ts`
- Modify: `projects/docs-web-app/tsconfig.json`
- Keep byte-identical: `projects/docs-web-app/src/freeism.ja.md`
- Keep byte-identical: `projects/docs-web-app/src/freeism.en.md`
- Keep byte-identical: `projects/docs-web-app/src/note/note.ja.md`
- Keep byte-identical: `projects/docs-web-app/src/note/note.en.md`
- Create: Blume metadata/custom page files outside the canonical Markdown paths as required by current Blume documentation.
- Create: `projects/docs-web-app/src/content-contract.test.ts`

**Interfaces:**
- Japanese docs resolve at `/`, English at `/en/`, Japanese notes at `/notes/`, English notes at `/en/notes/`.
- Blume navigation links back to all four public Freeism sites.

- [ ] **Step 1: Write the failing content-preservation test**

The test reads the canonical Markdown files, compares SHA-256 with the corresponding `origin/main:projects/documentation` blobs, and asserts that Japanese and English main documents retain `無料主義 v3` / `Freeism v3`, at least 140 headings each, and at least five Mermaid fences each.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter docs-web-app test`

Expected: FAIL until the immutable hash contract and Blume route metadata are implemented.

- [ ] **Step 3: Keep canonical Markdown byte-identical and configure Blume sources**

Do not move, rewrite, or add frontmatter to canonical Markdown. Configure Blume filesystem content sources or custom pages to read the existing files and provide title/navigation metadata separately.

- [ ] **Step 4: Configure Blume, i18n, and Mermaid rendering**

Set the production URL, Japanese default locale, `/en/` English locale, search/navigation, and Mermaid rendering using current Blume-supported configuration without modifying canonical Markdown.

- [ ] **Step 5: Run test, textlint, check, and build**

Run: `pnpm --filter docs-web-app test && pnpm --filter docs-web-app lint && pnpm --filter docs-web-app check && pnpm --filter docs-web-app build`

Expected: all exit 0; build output contains Japanese, English, notes, search assets, and rendered Mermaid diagrams.

### Task 4: Align canonical documentation and guard legacy deploys

> **2026-07-15 merge note:** 最新mainではlegacy Vercel deploy workflowが削除済みのため、競合解消では削除を優先する。workflow境界testは、旧deploy workflowの不在とlegacy CIの限定scopeを検証する形へ更新する。

**Files:**
- Modify: `docs/web-app/v0.2/architecture.md`
- Modify: `docs/web-app/v0.2/decision-register.md`
- Modify: `plan/web-app/v0.2-migration.md`
- Modify: affected `.github/workflows/web-app/*.yml`
- Modify: active READMEs that describe the project/domain map

**Interfaces:**
- Canonical documents state that apex Freeism is a portal, not a redirect to Points.
- Legacy Vercel preview and production deploy jobs run only for changes under `projects/web-app/**`.
- Legacy CI still runs for changes to its workflow or the shared setup action.

- [ ] **Step 1: Add a failing workflow contract test**

Create a small Node/Vitest test that parses the workflow YAML text and asserts deploy paths are limited to `projects/web-app/**`, while CI still observes workflow and shared setup changes.

- [ ] **Step 2: Verify RED**

Run the targeted test and confirm it fails against the current broad trigger.

- [ ] **Step 3: Narrow the deployment workflow triggers**

Keep legacy preview and production behavior unchanged for actual legacy app changes, while preventing docs/main-only branches from reaching DB migration and deploy jobs.

- [ ] **Step 4: Add a new decision that supersedes DEC-190**

Preserve DEC-190 as historical context, mark it superseded, and add a new adopted decision for the apex portal. Update architecture and migration steps consistently.

- [ ] **Step 5: Verify GREEN and documentation consistency**

Run the targeted test and `rg` for contradictory active statements that still redirect apex to Points.

### Task 5: Whole-branch verification and push

**Files:**
- Review all files changed from `origin/main`.

- [ ] **Step 1: Install from the final lockfile**

Run: `pnpm install --frozen-lockfile --ignore-scripts --config.confirmModulesPurge=false`

Expected: exit 0 with no lockfile mutation.

- [ ] **Step 2: Run all changed-package checks**

Run: `pnpm --filter main-web-app test && pnpm --filter main-web-app check && pnpm --filter main-web-app build`

Run: `pnpm --filter docs-web-app test && pnpm --filter docs-web-app lint && pnpm --filter docs-web-app check && pnpm --filter docs-web-app build`

Expected: all commands exit 0.

- [ ] **Step 3: Run repository consistency checks**

Run: `git diff --check && pnpm lint:documentation`

Expected: exit 0 and the renamed docs package is selected.

- [ ] **Step 4: Visually verify both sites**

Run local Astro servers, capture desktop and mobile screenshots, activate all three portal links, inspect console errors, and verify reduced-motion behavior.

- [ ] **Step 5: Dispatch a whole-branch regression review**

Review the complete `origin/main...HEAD` diff for content loss, broken anchors, unintended workflow behavior, accessibility, responsive layout, and unrelated changes. Fix validated findings and rerun their covering checks.

- [ ] **Step 6: Commit and push**

Commit the verified branch with descriptive commits, then run `git push -u origin codex/freeism-main-docs-sites` and confirm the upstream branch and remote Actions state.
