# Freeism Cloudflare cf-only 環境再現 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 権限を持つ別の担当者が、リポジトリ管理の設定と `cf` コマンドで staging／production の同等な Cloudflare 構成を作成・検証できるようにする。

**Architecture:** Worker はアプリごとの `cloudflare.config.ts` で表し、edge 設定は単一の desired-state モジュールと `cf` CLI を呼ぶ薄い再現スクリプトで管理する。スクリプトは現状を取得して対象リソースだけを採用・作成・更新し、D1 migration は Worker 公開より先に実行する。staging の同等性と冪等性を確認した後に production を切り替える。

**Tech Stack:** `cf@1.0.0-beta.5`、Node.js 24、pnpm 10.33.3、Cloudflare Workers／D1／Rulesets／Access、Node 組み込み test runner、既存の Vitest／Vite／Astro／Blume。

**Spec:** [`../specification/cf-only-environment.ja.md`](../specification/cf-only-environment.ja.md)

## Global Constraints

- Cloudflare API の実操作は固定バージョンの `cf` CLI に集約し、秘密値を引数・ログ・Git に残さない。
- 初期移行対象は既存 account／`freeism.app` zone。別 account は同じ manifest を使い、zone 委任などの外部前提を満たしたうえで検証する。
- 既存 D1 の UUID とデータ、Worker の公開 domain、zone の対象外 rules、apex の所有状態を保つ。
- staging は Points／Markets の Access と環境別通知を所有し、production は zone 共通 DNS／Rulesets／Email Routing と環境別通知を所有する。
- 対象が一意に特定できない、権限が不足する、Markets の Workflow／Durable Object や Main／Docs のビルド同等性を証明できない場合は切り替えを止める。
- 本計画の作成時点では Cloudflare への書き込み、Terraform の削除、production の変更は実施しない。

## Review Focus

以下の 5 条件は、担当タスクのテストで明示的に固定する。

1. account／zone が入力と異なる場合、最初の書き込みより前に失敗する（Task 3）。
2. 同じ名前・scope に既存リソースが複数ある場合、選択を推測せず失敗する（Task 3、Task 4）。
3. 既存 phase ruleset に対象外 rule がある場合、その rule を保持する（Task 3）。
4. D1 が新規でも既存でも、migration 完了前に Worker を公開しない（Task 4、Task 7〜9）。
5. Secret ファイルまたは検証済み通知先が欠ける場合、構成の一部だけを公開せず preflight で失敗する（通知先は Task 3、Secret は Task 7〜9）。

## ファイルと責務

| ファイル | 責務 |
| --- | --- |
| `package.json`、`pnpm-lock.yaml` | `cf` のバージョン固定と共通操作コマンド |
| `infra/cloudflare/config/edge.mjs` | 環境別の edge 期待値を返す唯一のモジュール |
| `infra/cloudflare/config/edge.test.mjs` | 現行 HCL の環境別契約を固定する単体テスト |
| `infra/cloudflare/scripts/cf-client.mjs` | `cf` 実行と JSON 応答の解析。テスト時に実行関数を注入可能にする |
| `infra/cloudflare/scripts/reconcile-edge.mjs`、同名 `.test.mjs` | 対象限定の `plan`／`apply`／`verify` と read-back テスト |
| `infra/cloudflare/scripts/d1.mjs`、同名 `.test.mjs` | 名前から D1 UUID を一意に解決し、必要時に作成する |
| `infra/cloudflare/scripts/workflow-contract.test.mjs` | 6 workflow の配信順序・起動条件・CLI 経路を固定する |
| `projects/{main,docs,points,markets,accounts}-web-app/cloudflare.config.ts` | 各 Worker の mode、binding、domain、trigger |
| 各アプリの `package.json`、既存 `scripts/`、`vite.config.ts` | build、型生成、migration、deploy の実行経路と既存の安全検査 |
| `.github/workflows/*cloudflare*.yml` | 既存 6 workflow の CI 配信経路 |
| `infra/cloudflare/docs/` と各アプリの `docs/`／`README.md` | 実行前提、手順、検証証跡 |

## Task 1: ツール固定と移行可否の記録

**Files:** Modify: `package.json`, `pnpm-lock.yaml`; Create: `infra/cloudflare/docs/plan/cf-migration-evidence.ja.md`。

**Interfaces:** Produces: `pnpm exec cf` が固定版で動く開発環境と、5 アプリの `cf migrate` dry-run の結果。

- [ ] **Step 1: ベースラインを記録する。** `git status --short --branch`、5 個の `wrangler.jsonc`、6 workflow、`infra/cloudflare/modules/web-app-edge/main.tf` を列挙し、既存 account／zone と Terraform state の参照可否を秘密値を表示せず記録する。
- [ ] **Step 2: `cf` を固定する。** root `devDependencies` に `"cf": "1.0.0-beta.5"` を追加し、lockfile を更新する。pnpm の `minimumReleaseAge: 4320` により当該版の取得が拒否される期間だけ、`pnpm-workspace.yaml` の `minimumReleaseAgeExclude` に `cf@1.0.0-beta.5` を限定追加する。
- [ ] **Step 3: CLI と変換結果を検証する。** 次のコマンドを各アプリの directory で実行し、生成候補と警告を evidence に記録する。dry-run 後の `git status --short` が不変であることを確認する。

```bash
pnpm exec cf --version
pnpm exec cf migrate wrangler.jsonc --dry-run --no-install
```

- [ ] **Step 4: 技術ゲートを判定する。** Main／Docs の Wrangler bundler 委譲、Markets の Workflow binding と Durable Object export、3 個の Vite app の `production` mode／D1 migration directory、Accounts Preview を「現行値」「変換結果」「検証方法」で記録する。同等性が証明できない項目は後続の実デプロイを開始しない。
- [ ] **Step 5: 確認とコミット。** `pnpm install --frozen-lockfile` と `pnpm exec cf --version` が成功し、evidence に 5 アプリ分の結果があることを確認してツール固定と記録をコミットする。

## Task 2: edge の期待値を単一の設定にする

**Files:** Create: `infra/cloudflare/config/edge.mjs`, `infra/cloudflare/config/edge.test.mjs`。

**Interfaces:** Produces: `desiredEdge(environment, { accountId, zoneId, accessAllowedEmails, opsAlertEmail })` → `{ dns, rulesets, accessPolicies, accessApplications, alertPolicies, emailRouting }`。Task 3 がこの結果のみを適用する。

- [ ] **Step 1: 先に失敗する契約テストを書く。** `node:test` で staging は Access policy／application が各 2、通知が 3、production だけ DNS 1・zone ruleset 3、Access 0 と確認する。301 の target と path/query 破棄、WAF ID、30/60 秒の 429、通知先 email も固定する。

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { desiredEdge } from "./edge.mjs";

const inputs = {
  accountId: "00000000000000000000000000000000",
  zoneId: "11111111111111111111111111111111",
  accessAllowedEmails: ["operator@example.com"],
  opsAlertEmail: "ops@example.com",
};

test("staging owns Access but no shared zone settings", () => {
  const result = desiredEdge("staging", inputs);
  assert.equal(result.accessPolicies.length, 2);
  assert.equal(result.accessApplications.length, 2);
  assert.equal(result.alertPolicies.length, 3);
  assert.equal(result.dns.length, 0);
  assert.equal(result.rulesets.length, 0);
});
```

- [ ] **Step 2: `node --test infra/cloudflare/config/edge.test.mjs` を実行し、`desiredEdge` 未定義で失敗することを確認する。**
- [ ] **Step 3: 期待値を実装する。** `main.tf:1-190` の名前・scope・body を `edge.mjs` に移す。production の DNS 名は `www.freeism.app`、Managed Ruleset ID は `efb7b8c949ac4650a09736fc376e9aee`、rate-limit の path 条件は `/api/auctions/` で始まり `/events` で終わるものとする。apex は `dns` に含めない。

```js
const dns = environment === "production"
  ? [{ name: "www.freeism.app", type: "A", content: "192.0.2.1", ttl: 1, proxied: true }]
  : [];
```

- [ ] **Step 4: テストを通す。** `node --test infra/cloudflare/config/edge.test.mjs` で staging／production と不正 environment のケースが成功することを確認し、現行 `edge.tftest.hcl` と値を突き合わせる。
- [ ] **Step 5: コミットする。** 設定と契約テストだけをコミットする。

## Task 3: 既存リソースを採用する `cf` 再現コマンド

**Files:** Create: `infra/cloudflare/scripts/cf-client.mjs`, `infra/cloudflare/scripts/reconcile-edge.mjs`, `infra/cloudflare/scripts/reconcile-edge.test.mjs`; Modify: `package.json`。

**Interfaces:** Consumes: `desiredEdge(environment, { accountId, zoneId, accessAllowedEmails, opsAlertEmail })`。Produces: `pnpm cloudflare:plan --environment staging|production`、`pnpm cloudflare:apply --environment staging|production`、`pnpm cloudflare:verify --environment staging|production`。内部の `createCfClient(execFile)` は `run(args) → JSON` を返し、`findUniqueBy(items, predicate)` は match が 0 件なら `null`、1 件ならその item、複数なら例外を返す。

- [ ] **Step 1: 先に失敗する単体テストを書く。** 注入した偽 `cf` 実行関数で、wrong account／zone と重複 match では書き込み呼び出し 0、既存 ID は `update`、欠落時のみ `create`、二度目の `apply` は書き込み 0、ruleset の対象外 rule は残ることを確認する。

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { findUniqueBy } from "./cf-client.mjs";

test("duplicate scoped names are rejected", () => {
  const records = [
    { id: "one", name: "www.freeism.app", type: "A" },
    { id: "two", name: "www.freeism.app", type: "A" },
  ];
  assert.throws(
    () => findUniqueBy(records, (record) => record.name === "www.freeism.app" && record.type === "A"),
    /multiple/,
  );
});
```

- [ ] **Step 2: `node --test infra/cloudflare/scripts/reconcile-edge.test.mjs` を実行し、未実装による失敗を確認する。**
- [ ] **Step 3: CLI アダプターと読み取り専用 `plan` を実装する。** `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_ZONE_ID`、JSON 配列の `FREEISM_ACCESS_ALLOWED_EMAILS`、`FREEISM_OPS_ALERT_EMAIL` を入力として検証する。`cf` の JSON 出力を解析し、DNS、zone ruleset、Access policy→application、alert policy、Email Routing の list/get を実行する。既存 match は名前・account／zone・phase／host で特定し、ID を保持する。ID・作成日時など API が付加する値は比較から除き、管理対象 field だけを正規化して比較する。`cf --dry-run` を差分判定の代わりにしない。

```js
import { execFileSync } from "node:child_process";

export function createCfClient(execFile = execFileSync) {
  return async (args) => {
    const output = execFile("cf", args, { encoding: "utf8" });
    return output.trim() === "" ? null : JSON.parse(output);
  };
}

export function findUniqueBy(items, predicate) {
  const matches = items.filter(predicate);
  if (matches.length > 1) {
    throw new Error(`multiple matching resources: ${matches.length}`);
  }
  return matches[0] ?? null;
}
```

- [ ] **Step 4: `apply` と `verify` を実装する。** 作成・更新には `cf` の対象別 `create/update` と `--body @file.json` を使い、JSON ファイルは `edge.mjs` の期待値から一時 directory に生成する。zone ruleset は `--zone` を指定する。Access application へ先に確定した policy ID を渡す。Email Routing は移行前の read-back で現行状態を確定し、合意した期待値が有効の場合だけ `cf email-routing enable` を使う。通知先の verified 状態を先に確認する。書き込み後に同じ list/get を読み直し、対象外 rule は更新 body に残す。削除処理は設けない。
- [ ] **Step 5: テストと CLI dry-run を通す。** `node --test infra/cloudflare/scripts/reconcile-edge.test.mjs` を実行し、代表的な DNS／ruleset／Access／alert body を対応する `cf` コマンドの `--dry-run` で検証する。実 account の `plan` は読み取り専用で実行し、既存 HCL と差分を照合する。
- [ ] **Step 6: コミットする。** `plan`／`apply`／`verify` とテストをコミットする。実 account への `apply` は Task 11 のゲートまで行わない。

## Task 4: D1 を migration 前に解決する

**Files:** Create: `infra/cloudflare/scripts/d1.mjs`, `infra/cloudflare/scripts/d1.test.mjs`; Modify: `projects/points-web-app/scripts/migrate-d1.ts`, `projects/markets-web-app/scripts/migrate-d1.mjs`; Create: `projects/accounts-web-app/scripts/migrate-d1.mjs`。

**Interfaces:** Produces: `resolveD1(name, { createIfMissing, cf }) → Promise<string>`。`cf d1 list --name NAME` の結果を完全一致で絞り、必要な場合だけ `cf d1 create` する。アプリ script は UUID と `--dir drizzle` または `--dir migrations` を `cf d1 migrations apply` に渡す。

- [ ] **Step 1: 先に失敗するテストを書く。** `points-staging` が 1 件なら UUID を返し作成しない、0 件かつ `createIfMissing` なら作成して再取得、2 件なら失敗する。migration が完了するまで deploy 呼び出しがないことも偽 `cf` で確認する。

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveD1 } from "./d1.mjs";

test("existing database keeps its UUID", async () => {
  const calls = [];
  const cf = async (args) => {
    calls.push(args);
    if (args.join(" ") === "d1 list --name points-staging") {
      return [{ uuid: "c3859cf6-2786-4191-bffe-cd04331c228e", name: "points-staging" }];
    }
    throw new Error(`unexpected cf call: ${args.join(" ")}`);
  };
  const uuid = await resolveD1("points-staging", {
    createIfMissing: true,
    cf,
  });
  assert.equal(uuid, "c3859cf6-2786-4191-bffe-cd04331c228e");
  assert.equal(calls.some((args) => args.join(" ").includes("d1 create")), false);
});
```

- [ ] **Step 2: `node --test infra/cloudflare/scripts/d1.test.mjs` を実行し、未実装の失敗を確認する。**
- [ ] **Step 3: 名前解決と migration を実装する。** Points／Markets は `drizzle`、Accounts は `migrations` を指定する。production の Points／Markets は `cf d1 time-travel get-bookmark <UUID>`、未適用一覧、SQL SHA-256 の既存証跡を移植する。既存 migration table の状態を実 DB で読み取ってから適用する。

```js
export async function resolveD1(name, { createIfMissing, cf }) {
  let matches = (await cf(["d1", "list", "--name", name])).filter((item) => item.name === name);
  if (matches.length === 0 && createIfMissing) {
    await cf(["d1", "create", "--name", name]);
    matches = (await cf(["d1", "list", "--name", name])).filter((item) => item.name === name);
  }
  if (matches.length !== 1) {
    throw new Error(`Expected one D1 database named ${name}, found ${matches.length}`);
  }
  return matches[0].uuid;
}
```

- [ ] **Step 4: テストを通す。** 単体テストに加え、Points／Markets では `cf d1 migrations list <UUID> --dir drizzle`、Accounts では `cf d1 migrations list <UUID> --dir migrations` の読み取り結果を確認する。空の検証用 DB に対する migration を実行する。既存 production DB では読み取り専用の一覧確認までに留める。
- [ ] **Step 5: コミットする。** 共通 UUID 解決とアプリ別 migration script をコミットする。

## Task 5: Main Worker の cf 設定

**Files:** Create: `projects/main-web-app/cloudflare.config.ts`; Modify: `projects/main-web-app/package.json`, `projects/main-web-app/astro.config.mjs`, `projects/main-web-app/src/build-contract.test.ts`, `projects/main-web-app/docs/v0.1.md`; Remove after parity: `projects/main-web-app/wrangler.jsonc`。

**Interfaces:** Produces: `cf build/deploy --mode staging|production` による `main-web-app-staging`／`main-web-app-production`、それぞれ `staging.freeism.app`／`freeism.app` の custom domain。

- [ ] **Step 1: 既存契約を固定する。** Worker 名、静的 assets、domain、`astro build` の出力を比較する設定テストを追加し、旧設定で通ることを確認する。
- [ ] **Step 2: `cf migrate wrangler.jsonc --dry-run --no-install` の出力から `cloudflare.config.ts` を作る。** `cf` が生成する `wrangler.config.ts` 委譲経路と native Vite／Build Output 経路を比較し、直接の Wrangler 実行が残らず assets と domain が一致する方法を採用する。同等な経路がない場合は Task 5 を中断して仕様を再確認する。
- [ ] **Step 3: `pnpm --filter main-web-app check`、`test`、`build`、`pnpm exec cf deploy --mode staging --dry-run` を実行する。** 出力の Worker 名、assets、domain を確認する。

```bash
pnpm --filter main-web-app check
pnpm --filter main-web-app test
pnpm --filter main-web-app build
pnpm --dir projects/main-web-app exec cf deploy --mode staging --dry-run
```

- [ ] **Step 4: staging へ適用し HTTP と asset を確認する。** 既存 staging Worker を上書きする前に版情報を保存し、公開 URL の HTTP 200 と主要 asset の取得を確認する。
- [ ] **Step 5: parity 後に旧設定と直接 Wrangler script を整理し、コミットする。**

## Task 6: Docs Worker の cf 設定

**Files:** Create: `projects/docs-web-app/cloudflare.config.ts`; Modify: `projects/docs-web-app/package.json`, `projects/docs-web-app/blume.config.ts`, `projects/docs-web-app/src/content-contract.test.ts`, `projects/docs-web-app/README.md`; Remove after parity: `projects/docs-web-app/wrangler.jsonc`。

**Interfaces:** Produces: `docs-web-app-staging`／`docs-web-app-production` と `staging.docs.freeism.app`／`docs.freeism.app`。

- [ ] **Step 1: 既存の Blume build、asset、domain、staging／production smoke の契約テストを記録する。**
- [ ] **Step 2: `cf migrate wrangler.jsonc --dry-run --no-install` の結果から `cloudflare.config.ts` を作る。** `docs-web-app-staging`／`docs-web-app-production` の名前、静的 assets、`staging.docs.freeism.app`／`docs.freeism.app` の custom domain を build output と照合する。`wrangler.config.ts` 委譲だけでは目標のネイティブ化に到達しない場合は、cf が扱う Vite／Build Output の形に整理してから先へ進む。
- [ ] **Step 3: `check`、`test`、`build`、`cf deploy --mode staging --dry-run` を実行し、旧出力と比較する。**

```bash
pnpm --filter docs-web-app check
pnpm --filter docs-web-app test
pnpm --filter docs-web-app build
pnpm --dir projects/docs-web-app exec cf deploy --mode staging --dry-run
```

- [ ] **Step 4: staging に適用して既存 `smoke:staging` を実行する。** 公開 domain と主要 docs asset の取得を確認する。
- [ ] **Step 5: parity 後に旧設定と直接 Wrangler script を整理し、コミットする。**

## Task 7: Points Worker と D1 の cf 設定

**Files:** Create: `projects/points-web-app/cloudflare.config.ts`; Modify: `projects/points-web-app/vite.config.ts`, `projects/points-web-app/package.json`, `projects/points-web-app/scripts/deploy-generated.ts`, `projects/points-web-app/test/worker/static-routing.worker.test.ts`, `projects/points-web-app/docs/specification/v0.2/details-ja/security-and-delivery.md`; Remove after parity: `projects/points-web-app/wrangler.jsonc`。

**Interfaces:** Consumes: Task 4 の `resolveD1` と migration。Produces: `points-worker-staging`／`points-worker-production`、名前指定の `points-staging`／`points-production` binding、対応 custom domain。

- [ ] **Step 1: `scripts/deploy-generated.ts` の生成設定検証の入出力テストを書く。** mode、Worker 名、asset、D1 名、custom domain、生成物の鮮度が不一致なら失敗するケースを固定する。
- [ ] **Step 2: テストが新 cf 出力を受け付けないことを確認する。**
- [ ] **Step 3: `cloudflare.config.ts` と Vite mode を移行する。** D1 binding は旧 account の UUID を固定せず `points-staging`／`points-production` の名前で表し、Drizzle の `--dir drizzle` は Task 4 の script に残す。既存の email、Cron、Analytics、静的 headers を照合する。`FREEISM_SECRETS_FILE` の存在と必要な Secret 名を値を表示せず検証して `cf deploy --secrets-file` に渡す。
- [ ] **Step 4: `test`、`test:worker`、`check`、`build:staging`、`cf deploy --dry-run` を通す。** staging D1 の migration を先に確認してから staging に公開し、`scripts/smoke.ts` を実行する。

```bash
pnpm --filter @freeism/points-web-app test
pnpm --filter @freeism/points-web-app test:worker
pnpm --filter @freeism/points-web-app check
pnpm --filter @freeism/points-web-app build:staging
pnpm --dir projects/points-web-app exec cf deploy --mode staging --dry-run
```

- [ ] **Step 5: production の D1 証跡を比較し、旧設定整理後にコミットする。** production デプロイは Task 11 で行う。

## Task 8: Accounts Worker・Preview と D1 の cf 設定

**Files:** Create: `projects/accounts-web-app/cloudflare.config.ts`, `projects/accounts-web-app/scripts/deploy-cf.mjs`, `projects/accounts-web-app/scripts/config-contract.test.mjs`; Modify: `projects/accounts-web-app/vite.config.ts`, `projects/accounts-web-app/package.json`, `projects/accounts-web-app/README.md`, `projects/accounts-web-app/docs/specification/main.ja.md`; Remove after parity: `projects/accounts-web-app/wrangler.jsonc`。

**Interfaces:** Consumes: Task 4 の D1 migration。Produces: `accounts-worker-staging`／`accounts-worker-production`、Accounts Preview、`accounts-staging`／`accounts-production` の D1 名前 binding。

- [ ] **Step 1: 既存 `wrangler.jsonc` の Preview、rate limiter namespace、Secrets 名、custom domain、D1、sourcemap を設定契約テストに記録する。**
- [ ] **Step 2: 変換テストを失敗させ、`cloudflare.config.ts` の `mode` と `ctx.isPreview` を実装する。** Preview は staging DB を参照し、production に公開されないことを出力で確認する。
- [ ] **Step 3: `typecheck`、`test`、`test:worker`、`build`、`cf deploy --dry-run` を通す。** `FREEISM_SECRETS_FILE` の存在・必要な Secret 名を preflight し、値を表示せず `cf deploy --secrets-file` に渡す。

```bash
pnpm --filter accounts-web-app typecheck
pnpm --filter accounts-web-app test
pnpm --filter accounts-web-app test:worker
pnpm --filter accounts-web-app build
pnpm --dir projects/accounts-web-app exec cf deploy --mode staging --dry-run
```

- [ ] **Step 4: staging D1 migration 後に既存 README の手順に従って staging／Preview を検証する。** `/healthz`、Basic 認証、OAuth callback、公開プロフィールの経路を確認する。初期 appAdmin 任命は構成再現ではなく別の運用手順として残す。
- [ ] **Step 5: parity 後に README と旧設定を整理し、コミットする。** production デプロイは Task 11 で行う。

## Task 9: Markets の Workflow／Durable Object ゲートと cf 設定

**Files:** Create: `projects/markets-web-app/cloudflare.config.ts`, `projects/markets-web-app/scripts/config-contract.test.mjs`; Modify: `projects/markets-web-app/vite.config.ts`, `projects/markets-web-app/package.json`, `projects/markets-web-app/scripts/assert-worker-build.mjs`, `projects/markets-web-app/scripts/deploy-generated.mjs`, `projects/markets-web-app/docs/specification/v0.2/details-ja/security-and-delivery.md`; Remove after parity: `projects/markets-web-app/wrangler.jsonc`。

**Interfaces:** Consumes: Task 4 の D1 migration。Produces: `auction-worker-staging`／`auction-worker-production`、`AUCTION_ROOMS` Durable Object、`auction-settlement-staging`／`auction-settlement-production` Workflow と binding。

- [ ] **Step 1: 先に現在の設定出力検査をテストで固定する。** Workflow 名・class・binding、`AuctionRoom`、Cron、Email、Analytics、D1、custom domain と生成物の鮮度を確認する。
- [ ] **Step 2: `cf migrate --dry-run` が Workflow binding を移さない事実を再確認する。** 手書き `cloudflare.config.ts`、cf Build Output、または `cf` の個別 API コマンドによる binding の作成・再デプロイ後の保持を検証用 Worker で比較する。再デプロイで binding が消える経路は採用しない。
- [ ] **Step 3: 同等性を確認できた経路だけを実装する。** mode 衝突、D1 名指定、DO export/migration、Workflow と static headers を新しい build 検査で確認する。`FREEISM_SECRETS_FILE` の存在・必要な Secret 名を値を表示せず検証して `cf deploy --secrets-file` に渡す。実証できない場合は Markets の切り替えを停止し、ユーザーに対象機能と不足している `cf` 経路を報告する。
- [ ] **Step 4: `test`、`test:worker`、`check`、`build:staging`、`build:assert`、`cf deploy --dry-run`、staging migration を通す。** staging では `/api/health` に加え WebSocket／DO／Workflow の実経路を検証する。

```bash
pnpm --filter @freeism/markets-web-app test
pnpm --filter @freeism/markets-web-app test:worker
pnpm --filter @freeism/markets-web-app check
pnpm --filter @freeism/markets-web-app build:staging
pnpm --filter @freeism/markets-web-app build:assert
pnpm --dir projects/markets-web-app exec cf deploy --mode staging --dry-run
```

- [ ] **Step 5: parity 後に旧設定と直接 Wrangler script を整理し、コミットする。** production デプロイは Task 11 で行う。

## Task 10: CI・運用文書の更新

**Files:** Create: `infra/cloudflare/scripts/workflow-contract.test.mjs`; Modify: `.github/workflows/cloudflare-test.yml`, `.github/workflows/cloudflare-production.yml`, `.github/workflows/main-web-app-cloudflare-test.yml`, `.github/workflows/main-web-app-cloudflare-production.yml`, `.github/workflows/main-docs-cloudflare-test.yml`, `.github/workflows/main-docs-cloudflare-production.yml`, 5 アプリの `package.json` と関連 `docs/`／`README.md`, `infra/cloudflare/docs/`。

**Interfaces:** Consumes: Task 3〜9 の検証済みコマンド。Produces: 現行の test → build → migration → deploy → smoke 順序を保つ 6 workflow と、別担当者用の実行手順。

- [ ] **Step 1: workflow の差分検査を先に書く。** 6 workflow が `cf` の固定版を使い、migration は deploy より前、Points／Markets の production D1 証跡と既存 smoke が残り、`infra/cloudflare/config/**` と `infra/cloudflare/scripts/**` の変更が対象 workflow の実行条件に入ることを確認する。
- [ ] **Step 2: テストを失敗させ、6 workflow と package scripts を新しいコマンドへ更新する。** 同一環境の apply／deploy は `concurrency` で直列化し、production の edge apply は承認付き手動経路に分ける。Accounts は現行の手動配信手順を `cf` へ更新し、自動配信 workflow はこの計画では追加しない。
- [ ] **Step 3: 各アプリの docs／README に prerequisites、Secret ファイルの受け渡し、`plan` → `apply` → `verify`、D1、staging／production の順序、read-back と復旧手順を書く。** 既存仕様に残る Terraform/Wrangler 所有表現を現在の担当経路に合わせて更新する。
- [ ] **Step 4: CI の静的検査と既存アプリ検証を実行する。** `rg -n 'wrangler (deploy|d1|types)' projects/*/package.json projects/*/scripts .github/workflows` の直接 CLI 呼び出しが 0 件であることを確認する。必要な Vitest runtime dependency や `cf` 内部の委譲は実際のビルドで評価する。

```bash
node --test infra/cloudflare/scripts/workflow-contract.test.mjs
rg -n 'wrangler (deploy|d1|types)' projects/*/package.json projects/*/scripts .github/workflows
```

- [ ] **Step 5: コミットする。** CI と文書だけをコミットする。

## Task 11: staging・production の検証と Terraform 管理の終了

**Files:** Remove after verified cutover: `infra/cloudflare/backend.tf`, `infra/cloudflare/main.tf`, `infra/cloudflare/outputs.tf`, `infra/cloudflare/variables.tf`, `infra/cloudflare/versions.tf`, `infra/cloudflare/environments/*.tfvars.example`, `infra/cloudflare/modules/web-app-edge/*.tf`, `infra/cloudflare/modules/web-app-edge/edge.tftest.hcl`, `infra/cloudflare/scripts/bootstrap-terraform-state.mjs`; Modify: `infra/cloudflare/docs/plan/cf-migration-evidence.ja.md`。Cloudflare の実リソースと state 用 R2 bucket は削除対象にしない。

**Interfaces:** Consumes: Task 1〜10 の成果。Produces: 環境ごとの実測証跡、二度目に変更ゼロの `plan/apply`、最終的な cf-only 運用。

- [ ] **Step 1: staging 適用前の snapshot を保全する。** `cf` の list/get 出力、Worker 版、D1 UUID／bookmark、Terraform state を権限制御された保管先に置き、リポジトリには秘密値や state 本体を追加しない。
- [ ] **Step 2: 別担当者のクリーン checkout から staging を再現する。** `pnpm install --frozen-lockfile`、`pnpm cloudflare:plan --environment staging`、承認後の `apply`、D1 migration、5 アプリの deploy、`verify`、Access 許可／拒否と smoke を実行する。二度目の `plan/apply` が変更ゼロであることを証跡に残す。

```bash
pnpm install --frozen-lockfile
pnpm cloudflare:plan --environment staging
pnpm cloudflare:apply --environment staging
pnpm cloudflare:verify --environment staging
pnpm cloudflare:plan --environment staging
```

- [ ] **Step 3: production は read-only plan と snapshot をレビューしてから承認付きで適用する。** Worker domain、`www` 301 の path/query 破棄、Managed WAF、30/60 秒制限、通知先の verified 状態、D1 migration と 5 アプリの health/smoke を API と実経路の双方で確認する。
- [ ] **Step 4: 再実行で変更ゼロを確認し、Terraform の自動適用を停止する。** HCL、state bootstrap、古い契約テストを整理し、Cloudflare state／R2 bucket の復旧用 snapshot は保全する。`terraform destroy` は実行しない。
- [ ] **Step 5: 最終差分と証跡をレビューする。** `git diff --check`、関係テスト、6 workflow、staging／production の read-back、必要に応じた `production` branch との差分を確認して完了を判断する。

## 計画の確認ポイント

実装に入る前に、初期対象が既存 account／zone でよいか、Main／Docs で `cf` が内部的に Wrangler bundler へ委譲する経路を許容するかを確認する。
Markets の Workflow binding を `cf` 経由で再デプロイ後も維持できるかは技術ゲートであり、検証前に完了見込みを断定しない。
