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
| `pnpm auth:generate` | Better AuthのCLIで認証のschemaを生成する |

ローカルの秘密値は`.env.example`を`.env.local`へ複製して設定する。
