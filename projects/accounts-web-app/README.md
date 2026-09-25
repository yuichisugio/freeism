# accounts-web-app

外部アカウントの所有権証明、Accountsユーザーとの紐付け、公開先ごとの情報提供を管理するサービスです。

- [v0.1仕様](./docs/specification/v0.1/main.ja.md)
- [v0.2仕様](./docs/specification/v0.2/main.ja.md)
- [URL登録・検証仕様](./docs/specification/v0.1/verify-url.ja.md)
- [v0.1実装計画](./docs/implementation-plan/v0.1.md)

## 開発

リポジトリのルートで`pnpm install`を実行してから、このディレクトリで次のscriptを使う。

| script | 内容 |
| --- | --- |
| `pnpm dev` | Vite Plusで画面とWorkerを起動する |
| `pnpm build` | 画面のSPA shellを事前生成し、Workerとassetsをビルドする。デプロイ先の設定でビルドする場合は`CLOUDFLARE_ENV=staging`などを指定する |
| `pnpm preview` | ビルド結果をローカルのWorkers環境で確認する |
| `pnpm typecheck` | Bindings型を生成し、型検査を実行する |
| `pnpm lint` | Vite Plusのlintを実行する |
| `pnpm test` | 単体テスト（Node.js）とWorkers結合テストを実行する。`test:unit`・`test:worker`で個別に実行できる |
| `pnpm db:generate` | Drizzleのschemaからmigrationを生成する |
| `pnpm auth:generate` | Better AuthのCLIで認証の標準schemaを`src/backend/db/schema/auth.ts`へ生成する。認証の設定・プラグインを変更したら実行し、続けて`pnpm db:generate`でmigrationを作る |

ローカルの秘密値は`.env.example`を`.env.local`へ複製して設定する。
ローカルのD1は`pnpm exec wrangler d1 migrations apply DB --local`でmigrationを適用する。

## 環境変数

変数は`wrangler.jsonc`の環境ごとの`vars`、秘密値はローカルでは`.env.local`、デプロイ先では`pnpm exec wrangler secret put <NAME> --env <ENVIRONMENT>`で設定する。

| 名前 | 種類 | 内容 |
| --- | --- | --- |
| `APP_ENV` | 変数 | `local`・`staging`・`production` |
| `ACCOUNTS_ORIGIN` | 変数 | 公開origin。公開プロフィールURL・JWTの`iss`・OAuthのcallbackに使う |
| `PREVIEW_HOST_PATTERN` | 変数 | staging・PreviewでPreviewのhostに一致させるパターン。`ACCOUNT_SUBDOMAIN`は実際のworkers.dev subdomainへ置き換える |
| `BETTER_AUTH_SECRETS` | 秘密値 | cookie・OAuth token暗号化のversioned secrets。形式は[認証の秘密値の切り替え](#認証の秘密値の切り替え)を参照 |
| `GOOGLE_CLIENT_ID`・`GOOGLE_CLIENT_SECRET` | 秘密値 | Google OAuthのクライアント |
| `GITHUB_CLIENT_ID`・`GITHUB_CLIENT_SECRET` | 秘密値 | GitHub OAuthのクライアント |
| `ORCID_CLIENT_ID`・`ORCID_CLIENT_SECRET` | 秘密値 | ORCID（Generic OAuth）のクライアント |
| `BASIC_AUTH_USERNAME`・`BASIC_AUTH_PASSWORD` | 秘密値 | staging・Previewの画面のBasic認証。デプロイ先だけに登録し、ローカルとCIのビルドでは空にする |

各ProviderのOAuthアプリには、callback URLとして`{ACCOUNTS_ORIGIN}/api/auth/callback/google`・`/github`・`/orcid`を登録する。Previewからのログインは、OAuth Proxyがstagingのcallbackを経由して戻す。

## stagingでの確認

1. `pnpm exec wrangler d1 create accounts-staging`でDBを作成し、`wrangler.jsonc`の`env.staging`の`database_id`と`PREVIEW_HOST_PATTERN`を実際の値にする。
2. [環境変数](#環境変数)の秘密値を`--env staging`で登録する。
3. `pnpm exec wrangler d1 migrations apply DB --env staging --remote`でmigrationを適用する。
4. `CLOUDFLARE_ENV=staging pnpm build`でstagingの設定でビルドし、`pnpm exec wrangler deploy`でデプロイする。Cloudflare Vite Pluginはビルド時に環境を確定するため、`wrangler deploy`には`--env`を付けない。
5. `https://staging.accounts.freeism.app`でBasic認証を通して画面を開き、Google・GitHub・ORCIDのログイン、URLの検証、公開プロフィール（Basic認証なし）、OAuthクライアントの登録と`/api/v1/*`の呼出しを確認する。
6. PRのPreviewは、同じビルドの後に`pnpm exec wrangler preview`で更新する。PreviewはstagingのD1を共有する。

## 認証の秘密値の切り替え

`BETTER_AUTH_SECRETS`は`<version>:<secret>`をカンマ区切りで並べ、先頭のcurrentで暗号化し、残りを復号に使う。

1. 新しいversionを先頭に加えた値（例: `2:新しい値,1:古い値`）を`pnpm exec wrangler secret put BETTER_AUTH_SECRETS --env <ENVIRONMENT>`で登録する。
2. 旧versionで暗号化したOAuth tokenは、次回のログイン・token更新でcurrent versionへ保存し直される。
3. 旧versionを値から外すと、そのversionのままのtokenは復号できなくなる。外した後にtokenが必要になった外部アカウントは再連携で保存し直す。

## 運営者（appAdmin）の任命

運営者画面は設けないため、最初の`appAdmin`はOAuthでログインして作成したユーザーの`user.role`をD1で設定して任命する。AccountsユーザーIDは「設定」画面の公開プロフィールURLの末尾で確認する。

```sh
pnpm exec wrangler d1 execute DB --env production --remote \
  --command "UPDATE \"user\" SET role = 'appAdmin' WHERE id = 'ausr_...';"
```

任命後に再ログインし、ログイン中のブラウザーからBetter AuthのAdmin API（`/api/auth/admin/list-users`・`get-user`・`ban-user`・`unban-user`）を呼ぶ。`appAdmin`はこの4つだけを実行できる。ban・unbanが成功すると、対象ユーザーの公開プロフィールのキャッシュは自動でpurgeされる。
