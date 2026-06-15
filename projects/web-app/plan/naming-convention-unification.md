# naming-convention-unification

## 概要

`docs/v0.2/details-ja/naming-convention.md` で定義した命名規則に、現行実装・設定・ドキュメントを段階的に寄せる。

仕様書には使用する命名規則だけを残し、実態との乖離、例外の扱い、統一作業はこの計画で管理する。

## 目的

1. 命名規則の仕様を読みやすく保つ
2. 既存実装の例外を把握したうえで、統一できるものだけを安全に修正する
3. フレームワーク・外部ライブラリ由来の命名を無理に変更しない
4. 命名変更による import、route、DB、環境変数の破壊を防ぐ

## 統一方針

1. フレームワーク予約名、外部ライブラリ由来、生成コード由来の命名は変更しない
2. 新規実装は `naming-convention.md` の規則に従う
3. 既存実装の変更は、参照更新と検証コマンドまでセットで行う
4. DB カラム名や環境変数名の変更は影響範囲が大きいため、単独 PR または単独作業として扱う

## 統一対象

### 1. TypeScript 通常コードの `snake_case`

対象:

- TypeScript の通常変数、関数、props、オブジェクトキー
- 外部 API、DB、OAuth 互換ではない `snake_case`

方針:

- 通常コードでは `camelCase` に統一する
- 外部仕様に由来する `snake_case` は例外として残す

確認コマンド:

```bash
rg -n "\\b[a-z][a-z0-9]*_[a-z0-9_]+\\b" projects/web-app/src --glob '!**/*.test.*'
```

### 2. PascalCase ファイル名

対象:

- `projects/web-app/src/components/ui/Pagination.tsx`

方針:

- UI primitive の移植元や既存 import への影響を確認する
- 変更する場合は `pagination.tsx` へ rename し、すべての import を更新する
- 変更しない場合は、UI primitive 由来の例外として扱う

確認コマンド:

```bash
find projects/web-app/src -type f | rg "/[A-Z][^/]*\\.(ts|tsx)$"
```

検証コマンド:

```bash
pnpm --filter web-app typecheck
pnpm --filter web-app test
```

### 3. Prisma `Account` model の `snake_case` field

対象:

- `refresh_token`
- `access_token`
- `token_type`
- `id_token`
- `session_state`
- `expires_at`

方針:

- Auth.js / OAuth 互換のため、原則として変更しない
- Prisma schema 上の例外として扱う
- 変更する場合は Auth.js adapter への影響を先に確認する

確認コマンド:

```bash
rg -n "refresh_token|access_token|token_type|id_token|session_state|expires_at" projects/web-app
```

### 4. `.env.example` と `src/library-setting/env.ts` の差分

対象:

- `env.ts` にあるが `.env.example` にない環境変数
- `.env.example` にあるが `env.ts` にない環境変数
- `NEXT_PUBLIC_` を付けるべきではない secret/token/private key

方針:

- `env.ts` を正として `.env.example` を更新する
- secret、token、private key は `NEXT_PUBLIC_` を付けない
- クライアントで必要な値だけ `NEXT_PUBLIC_` を付ける

確認コマンド:

```bash
rg -n "^[A-Z0-9_]+:" projects/web-app/src/library-setting/env.ts
rg -n "^[A-Z0-9_]+=" projects/web-app/.env.example
```

検証コマンド:

```bash
pnpm --filter web-app typecheck
```

### 5. `process.env` の直接参照

対象:

- `src/library-setting/env.ts` を経由していない `process.env.*`
- `.env.example` に未記載の直接参照
- Cloudflare / R2 / VAPID / Upstash など、同じ用途で名前が混在している環境変数

方針:

- 可能なものは `src/library-setting/env.ts` に寄せる
- 外部ライブラリや Next.js の都合で直接参照が必要なものは例外として残す
- `CLOUDFLARE_*` と `CLOUDFLARE_R2_*` のように同じ用途で名前が混在しているものは、用途別に採用名を決める
- secret、token、private key は `NEXT_PUBLIC_` にしない

確認コマンド:

```bash
rg -n "process\\.env\\.[A-Z0-9_]+" projects/web-app/src projects/web-app/scripts
rg -n "CLOUDFLARE(_R2)?_|NEXT_PUBLIC_CLOUDFLARE" projects/web-app
```

検証コマンド:

```bash
pnpm --filter web-app typecheck
pnpm --filter web-app test
```

### 6. docs の locale 命名

対象:

- `index.ja.md`
- `index-en.md`
- `README.ja.md`
- `details-ja`

方針:

- 新規 docs は既存構成に合わせる
- 日本語 index は `index.ja.md`
- 英語 index は、既存の `index-en.md` を維持するか `index.en.md` へ寄せるかを別途決める
- `details-ja` 配下の詳細ファイルは英語 `kebab-case` を維持する

確認コマンド:

```bash
find projects/web-app/docs -type f | sort
```

### 7. テストファイル名

対象:

- `.test.*`
- `.spec.*`
- 分割テストの番号付きファイル

方針:

- 新規テストは `.test.*` に統一する
- 既存の `.spec.*` がある場合は `.test.*` へ rename する
- 大きなテスト分割は、対象ファイル名を維持して末尾に観点名または番号を付ける

確認コマンド:

```bash
find projects/web-app/src projects/web-app/scripts -type f | rg "\\.(test|spec)\\."
```

検証コマンド:

```bash
pnpm --filter web-app test
```

### 8. 定数・cache key の namespace

対象:

- `SCREAMING_SNAKE_CASE` の共有定数
- `camelCase` の schema / query key / variant helper
- `queryCacheKeys` 配下の namespace key

方針:

- 複数ファイルから参照する設定値の集合は `SCREAMING_SNAKE_CASE`
- Zod schema、query key factory、variant helper は `camelCase`
- `queryCacheKeys` 配下の namespace key は、既存呼び出し箇所への影響を確認してから統一する

確認コマンド:

```bash
rg -n "export const [A-Za-z0-9_]+|queryCacheKeys" projects/web-app/src/lib projects/web-app/src/library-setting projects/web-app/src/types
```

検証コマンド:

```bash
pnpm --filter web-app typecheck
pnpm --filter web-app test
```

### 9. npm scripts

対象:

- `package.json` の scripts

方針:

- namespace は `:` で区切る
- script 名の単語部分は `kebab-case` にする
- 既存 script の rename は利用箇所を確認してから行う

確認コマンド:

```bash
rg -n "\"[^\"]+\": \"[^\"]+\"" package.json projects/web-app/package.json
```

## 実施順

1. `snake_case` の通常 TypeScript 識別子を洗い出す
2. PascalCase ファイル名を例外維持するか rename するか決める
3. `.env.example` と `env.ts` の差分を同期する
4. `process.env` の直接参照と Cloudflare R2 関連の env 名を棚卸しする
5. テストファイルの `.spec.*` 有無を確認し、必要なら `.test.*` へ統一する
6. 定数・cache key namespace の統一要否を決める
7. docs locale 命名を今後の方針として決める
8. npm scripts の命名を確認し、利用箇所込みで必要なものだけ rename する
9. 最後に `naming-convention.md` とこの計画を更新する

## 共通検証

命名変更を行った後は、変更内容に応じて次を実行する。

```bash
pnpm --filter web-app format
pnpm --filter web-app typecheck
pnpm --filter web-app test
pnpm --filter web-app exec prisma validate
git diff --check -- projects/web-app
```

docs だけを変更した場合は、少なくとも次を実行する。

```bash
pnpm --filter web-app exec prettier --check docs/v0.2/details-ja/naming-convention.md plan/naming-convention-unification.md
git diff --check -- projects/web-app/docs/v0.2/details-ja/naming-convention.md projects/web-app/plan/naming-convention-unification.md
```

## 完了条件

1. 新規実装で使う命名規則が `naming-convention.md` だけで判断できる
2. 実装と乖離している命名が、この計画内で「修正対象」または「例外維持」に分類されている
3. 命名変更を行った箇所の import、route、Prisma、環境変数参照が壊れていない
4. 対象範囲に応じた検証コマンドが通っている
