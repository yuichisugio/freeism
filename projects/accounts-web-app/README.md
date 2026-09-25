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

任命後に再ログインし、ログイン中のブラウザーからBetter AuthのAdmin API（`/api/auth/admin/list-users`・`get-user`・`ban-user`・`unban-user`）を呼ぶ。`appAdmin`はこの4つだけを実行でき、ban・unbanの後は対象ユーザーの公開プロフィールのキャッシュをpurgeする。
