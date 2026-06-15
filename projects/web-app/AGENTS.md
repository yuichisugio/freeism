# Repository Guidelines

## 基本方針

- 常に日本語で会話する。
- 実装・調査・レビューでは、コード上の観測と推測を分ける。根拠が弱い不具合は断定しない。
- まだリリースしていないアプリなので、後方互換性よりも現行仕様への整合を優先する。
- 自分の理解が足りていないと感じたら、利用するライブラリやツールの公式ドキュメントを先に確認する。
- 非自明な作業は、要件確認、コード探索、実装方針、テスト観点、回帰確認など、観点ごとにサブエージェントを分けて進める。
- 変更は最小限にし、無関係なリファクタリングや整理を混ぜない。
- バックエンドは、フロントエンドを信用せず、必要な権限や情報のチェック・バリデーションを行う

## 仕様・ドキュメントの参照先

- v0.2 の設計方針は `docs/v0.2/index.ja.md` を入口にする。
- 現行実装から読み取った詳細仕様は `docs/v0.1/index.ja.md` と `docs/v0.1/details/` を確認する。
- v0.2 の詳細ルールは `docs/v0.2/details-ja/` を確認する。
  - 命名規則: `docs/v0.2/details-ja/naming-convention.md`
  - バックエンドレスポンス形式: `docs/v0.2/details-ja/response-format.md`
  - 認証、キャッシュなどの詳細: 同ディレクトリ内の各ファイル
- 移行・統一・将来対応の計画は `plan/` に集約する。
- 実装と仕様が乖離している場合は、実装で観測できた内容と乖離内容を該当ドキュメントの冒頭に明記する。
- 実装変更で仕様が変わる場合は、冗長化や重複を避けながら関連する `docs/` または `plan/` を更新する。

## Project Structure

- `src/app`: Next.js App Router のページ、レイアウト、API Route、error/loading/not-found。
- `src/actions`: Server Action とドメイン別のサーバー処理。`auction`、`group`、`task`、`notification`、`permission`
  などに分かれる。
- `src/components`: UI コンポーネント。ドメイン別コンポーネントと `ui`、`share`、`layout` を配置する。
- `src/hooks`: 画面・機能別のカスタムフック。
- `src/library-setting`: ライブラリ設定と共通クライアント。`auth`、`env`、`prisma`、`redis`、`resend`、`tanstack-query`、`zod-schema`
  などを配置する。
- `src/lib`: 汎用ユーティリティと定数。
- `src/types`: ドメイン別の型定義。
- `src/emails`: React Email のメールテンプレート。
- `src/test`: テスト共通 setup、mock、MSW、test utility。
- `prisma`: Prisma schema、seed、seeder。
- `scripts`: オークション状態更新、デポジット返却、予約通知送信などの定期実行処理。
- `public`: PWA、アイコン、デフォルト画像などの静的ファイル。
- `docs`: 仕様書、実装詳細、レスポンス形式、命名規則などのドキュメント。
- `plan`: 現行実装と理想状態の乖離を埋める移行・統一計画。

## Build, Test, and Development Commands

- Node.js は `>=20.11.1`、pnpm は `>=8.0.0` を使う。
- 以下のコマンドは `projects/web-app` 配下で実行する前提。
- リポジトリ root から実行する場合は、原則 `pnpm --filter web-app <script>` を使う。
- 依存関係のインストール: `pnpm install`
- 開発サーバー: `pnpm dev`（port 3000）
- メールプレビュー: `pnpm email:dev`（port 3001）
- 本番ビルド: `pnpm build`
- 本番起動: `pnpm start`
- 全テスト: `pnpm test`
- watch テスト: `pnpm test:watch`
- coverage: `pnpm test:coverage`
- Vitest UI: `pnpm test:ui`
- 単一テストファイル: `pnpm exec vitest run path/to/file.test.ts`
- 型チェック: `pnpm typecheck`
- 型チェックのキャッシュ削除込み: `pnpm typecheck:rm`
- lint: `pnpm lint`
- lint 修正と Prisma validate: `pnpm lint:fix`
- format 確認: `pnpm format`
- format 修正と Prisma format: `pnpm format:fix`
- 未使用コード確認: `pnpm unused:check`
- DB seed: `pnpm db:seed`
- seed と定期処理一括実行: `pnpm db:seed:with-actions`
- 開発 DB migration: `pnpm prisma:dev:migrate`
- 本番 DB migration deploy: `pnpm prisma:prod:deploy`
- Vercel build: `pnpm vercel-build`

## Background Scripts

- `pnpm actions:update-auction-status-to-active`: 予約中のオークションを開催中へ更新する。
- `pnpm actions:update-auction-status-to-completed`: 終了時刻を過ぎたオークションを完了へ更新する。
- `pnpm actions:return-auction-deposit-points`: デポジットポイントを返却する。
- `pnpm actions:send-scheduled-notifications`: 予約通知を送信する。

## Coding Style & Naming Conventions

- 命名規則は `docs/v0.2/details-ja/naming-convention.md` を正とする。
- ファイル名とディレクトリ名は原則 `kebab-case` にする。
- 変数、関数、引数、props、通常の object key は `camelCase` にする。
- React コンポーネント、型、interface、Prisma model は `PascalCase` にする。
- React Hooks は `use` + `PascalCase` の関数名にし、ファイル名は `use-*.ts` または `use-*.tsx` にする。
- 環境変数と Prisma enum value は `SCREAMING_SNAKE_CASE` にする。
- DB カラム名は Prisma の `@map` で `snake_case` にする。
- Prettier と ESLint の設定に従い、手動整形ではなく `pnpm format:fix` と `pnpm lint:fix` を使う。
- Tailwind CSS の utility を優先し、既存の shadcn/ui・Radix UI のパターンに合わせる。

## Comments and Documentation

- それぞれの関数には、必要に応じて簡潔で分かりやすい JSDoc を入れる。
- まとまった処理の区切りには `// --------------------------------------------------` を使う。区切り線の `-`
  は 50 個にする。
- コメントは多用せず、コードだけでは意図や制約が読み取りにくい箇所に絞る。
- 実装ファイルから仕様書やテストへ辿れるよう、必要に応じて `@see` で関連ドキュメントやテストを参照する。

## Testing Guidelines

- TDD を基本にする。
  - 期待される入出力に基づき、まずテストを作成する。
  - テストを実行し、失敗を確認する。
  - テストが正しいことを確認できた段階で実装を進める。
  - 実装中はテストの意図を安易に変えず、コード側を修正する。
- テストランナーは Vitest。DOM テストには Happy DOM / jsdom と Testing Library を使う。
- テストファイルは対象ファイルの近くに `*.test.ts` または `*.test.tsx` として配置する。
- `src/test` は setup、mock、MSW、test utility などの共有用途に使う。
- 単体テストを主軸にし、結合テストや E2E 相当のテストは責務が分かる別ファイルに分ける。
- リファクタリングで壊れにくいブラックボックステストを優先する。
- メモリ使用量、DB 負荷、セキュリティ、エラー処理など実装詳細が重要な場合のみホワイトボックス寄りのテストを追加する。
- MSW は API mocking が必要な箇所で使用する。
- レビュー前は変更範囲に応じて `pnpm test`、`pnpm typecheck`、`pnpm lint`、`pnpm format` を実行する。

## Architecture Overview

### Application

- Next.js 15 の App Router 構成。
- React 19、TypeScript、Tailwind CSS、Radix UI、shadcn/ui を使う。
- ドメインは group、task、auction、notification、permission、review-search、user を中心に分かれる。
- UI とロジックは、コンポーネント、hooks、Server Actions、library-setting に責務を分ける。

### Authentication & Authorization

- 認証は Auth.js / NextAuth v5 を使う。
- 設定入口は `src/library-setting/auth.ts`。
- API route は `src/app/api/[...nextauth]/route.ts`。
- `src/middleware.ts` で `/dashboard/*` を保護し、未認証時は `/auth/signin` にリダイレクトする。
- 権限は app owner、group owner、group member などのドメインルールで判定する。

### Data and Validation

- DB は Prisma ORM と PostgreSQL / Supabase を使う。
- Prisma schema は `prisma/schema.prisma`。
- Prisma client は `src/library-setting/prisma.ts`。
- runtime validation は Zod を使い、共通 schema は `src/library-setting/zod-schema.ts` に置く。
- 環境変数は `@t3-oss/env-nextjs` を使い、`src/library-setting/env.ts` で型安全に扱う。

### Server Actions and Response Format

- データ更新・取得の多くは `src/actions/` の Server Action に置く。
- Server Action の標準的な戻り値は `{ success, message, data }`。
- Route Handler は endpoint ごとに形式が異なるため、詳細は `docs/v0.2/details-ja/response-format.md` を確認する。
- 失敗は `success: false` だけでなく、例外、redirect、HTTP status と `{ error }` の組み合わせもあり得る。
- 非同期処理では、想定内エラーと想定外エラーを分けて扱う。

### State, Cache, and Offline

- server state は TanStack Query を使う。
- query key、QueryClient、IndexedDB persistence などは `src/library-setting/tanstack-query.ts` に集約する。
- cache strategy は `docs/v0.2/details-ja/cache.md` と実装側の query key / invalidation を合わせて確認する。
- PWA と service worker 関連の静的ファイルは `public/` に配置する。

### Real-time, Notifications, and Upload

- オークション更新は SSE を使う。
- SSE API は `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts`。
- オークションデータ取得 API は `src/app/api/auctions/[auctionId]/auction-data/route.ts`。
- Redis client は `src/library-setting/redis.ts` を入口にする。ただし、SSE 購読・publish 周辺では Upstash Redis
  REST を直接利用している箇所もある。
- Resend client は `src/library-setting/resend.ts`
  を入口にする。ただし、現行実装ではメール通知の実送信処理がコメントアウトされている箇所があるため、通知仕様と実装を両方確認する。
- Web Push、メール、アプリ内通知は notification domain の actions、components、hooks、API route を確認する。
- ファイルアップロードは Cloudflare R2 を使い、`src/actions/cloudflare/` と `src/app/api/upload/` に関連処理がある。

## Database & Environment Notes

- `.env.example` を参照して `.env.local` を用意する。秘密情報はコミットしない。
- schema 変更時は Prisma schema、migration、seed、関連ドキュメントの整合を確認する。
- `pnpm clean` は `git clean -xdf node_modules dist` を実行するため、意図して生成物を消す場合のみ使う。

## Commit & Pull Request Guidelines

- 可能なら Conventional Commits 形式の prefix（`feat:`、`fix:` など）を使う。
- 変更は意味のある単位にまとめる。
- Prisma schema を変更した場合は migration、seed、docs の要否を確認する。
- PR には影響範囲、関連 issue、実行した検証コマンド、UI 変更時のスクリーンショットや確認メモを記載する。

## 作業時のチェックリスト

1. 関連する `docs/`、`plan/`、実装、テストを読む。
2. 実装と仕様の差分がある場合は、差分を明示してから変更する。
3. 変更範囲を最小化する。
4. 関連テストを追加または更新する。
5. 変更範囲に応じた検証コマンドを実行する。
6. 仕様に影響がある場合は `docs/` または `plan/` を更新する。
