# freeism（無料主義）

- [freeism（無料主義）](#freeism無料主義)
  - [言語](#言語)
  - [概要](#概要)
  - [フォルダ構造](#フォルダ構造)
  - [初期設定](#初期設定)
  - [リリース運用](#リリース運用)
  - [コミット前のチェック](#コミット前のチェック)
  - [CI の Cloudflare 認証](#ci-の-cloudflare-認証)

## 言語

日本語（本ページ）| [English](../README.md)

## 概要

- 「無料主義」に関連する Webアプリ、分析ツール、仕様ドキュメントをまとめたモノレポです。

## フォルダ構造

```
freeism/
├── README.md                 # README（英語）
├── CODE_OF_CONDUCT.md        # 行動規範（英語）
├── LICENSE                   # ライセンス
├── docs/                     # リポジトリ用ドキュメント
└── projects/                 # モノレポ管理対象のプロジェクト
    ├── docs-web-app/         # 無料主義の仕様
    ├── main-web-app/         # freeism.app ポータル
    ├── points-web-app/       # points.freeism.app
    ├── markets-web-app/      # markets.freeism.app
    ├── web-app/              # v0.2切替まで保持する旧実装
    ├── calc-contrib/         # 貢献度の算出
    └── find-contrib/         # 依存関係の取得
```

| パス(README.md)                                                      | 説明                              |
| -------------------------------------------------------------------- | --------------------------------- |
| [`projects/main-web-app/`](../projects/main-web-app/)                | freeism.app ポータル              |
| [`projects/docs-web-app/`](../projects/docs-web-app/README.md)       | docs.freeism.app と無料主義の仕様 |
| [`projects/points-web-app/`](../projects/points-web-app/README.md)   | Points Web アプリ                 |
| [`projects/markets-web-app/`](../projects/markets-web-app/README.md) | Markets Web アプリ                |
| [`docs/web-app/`](./web-app/README.md)                               | Web アプリ横断仕様                |
| [`projects/web-app/`](../projects/web-app/README.md)                 | v0.2切替まで保持する旧Next.js実装 |
| [`projects/calc-contrib/`](../projects/calc-contrib/README.md)       | 貢献度を算出するソフトウェア      |
| [`projects/find-contrib/`](../projects/find-contrib/README.md)       | 依存関係を取得するソフトウェア    |

## 初期設定

```shell
mise trust
```

```shell
mise run init
```

## リリース運用

リリース対象の変更では、`pnpm changeset` を実行し、対象アプリ、semver の更新種別、利用者向けの要約を入力します。生成された `.changeset/*.md` を通常のプルリクエストに含めてください。`main` へのマージ後、Changesets が Version PR を作成または更新します。Version PR をマージすると、パッケージのバージョンと `CHANGELOG.md` が確定します。文書のみ、CI のみ、Changesets 設定のみの変更では Changeset は不要です。

このワークフローは npm 公開、Git タグ、GitHub Release を作成しません。

## コミット前のチェック

コミット前のチェックは、Vite+ の `vp staged` で行います。
チェックの対象とコマンドは、ルートの `vite.config.ts` の `staged` に書きます。
現在は `staged` を設定していないため、コミット前のチェックは動きません。

チェックを追加するときは、次の 3 つを行います。

1. ルートの `vite.config.ts` の `staged` に、対象のファイルとコマンドを書きます。
2. `.vite-hooks/pre-commit` に `vp staged` を書き、リポジトリに含めます。
3. `pnpm exec vp hooks enable` で、各クローンのフックを有効にします。

```ts
export default defineConfig({
  staged: {
    "projects/points-web-app/**/*.{ts,tsx}": "vp check --fix",
  },
});
```

## CI の Cloudflare 認証

GitHub Actions のデプロイは、GitHub Environment ごとのシークレット `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` で Cloudflare にアクセスします。

| Environment          | 使うワークフロー                                                                                             | 起動条件           |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------ |
| `web-app-staging`    | `cloudflare-test.yml`、`main-docs-cloudflare-test.yml`、`main-web-app-cloudflare-test.yml`                   | `test/*` への push |
| `web-app-staging`    | `points-pr-preview.yml`                                                                                      | プルリクエスト     |
| `web-app-production` | `cloudflare-production.yml`、`main-docs-cloudflare-production.yml`、`main-web-app-cloudflare-production.yml` | `main` への push   |

### トークンの作成

Cloudflare ダッシュボードの Manage account → Account API tokens で、Account API Token を作成します。
権限は、リソースの範囲ごとに次の 2 組を設定します。
Workers と D1 をゾーンの範囲に付けると効かないため、必ずアカウントの範囲に付けます。

| リソースの範囲                   | 権限                      |
| -------------------------------- | ------------------------- |
| Freeism の Cloudflare アカウント | Workers: Admin、D1: Write |
| ゾーン `freeism.app`             | Workers Routes: Edit      |

- Workers の Admin は、まだ存在しない Worker を初回デプロイで作成するために必要です。
- Durable Objects、Workflows、cron、静的アセットは Workers の権限で扱えます。
- D1 の Write は、D1 マイグレーションの適用と確認に使います。
- Workers Routes の Edit は、`*.freeism.app` のカスタムドメインの追加と付け替えに使います。

### GitHub への登録

シークレットの登録には、リポジトリの管理者権限が必要です。
`gh secret set` を値の指定なしで実行すると、入力が画面とシェル履歴に残りません。

```shell
gh secret set CLOUDFLARE_API_TOKEN --env web-app-staging --repo yuichisugio/freeism
gh secret set CLOUDFLARE_ACCOUNT_ID --env web-app-staging --repo yuichisugio/freeism
gh secret set CLOUDFLARE_API_TOKEN --env web-app-production --repo yuichisugio/freeism
gh secret set CLOUDFLARE_ACCOUNT_ID --env web-app-production --repo yuichisugio/freeism
```

### 権限の確認

トークンを環境変数に入れ、Cloudflare API と wrangler で権限を確認します。
`read -s` で入力すると、トークンが画面とシェル履歴に残りません。

```shell
read -s "CLOUDFLARE_API_TOKEN?Token: " && export CLOUDFLARE_API_TOKEN && echo
export CLOUDFLARE_ACCOUNT_ID=<アカウント ID>
curl -s "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/tokens/verify" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
pnpm --filter @freeism/points-web-app exec wrangler d1 list
pnpm --filter @freeism/points-web-app exec wrangler deployments list --name points-worker-staging
```
