# アーキテクチャ・ルート・共通基盤

## 技術スタック

- Next.js 15.3 App Router
- React 19.1
- NextAuth v5 beta
- Prisma 6.11
- TanStack Query v5
- React Hook Form + Zod
- Tailwind CSS
- Vitest
- pnpm
- Upstash Redis REST API
- Cloudflare R2互換S3 API
- web-push
- next-pwa

## App Router

主な画面ルートは以下です。

| ルート                                          | 概要                                                                   | 認証 |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ---- |
| `/`                                             | ホーム。`Header`, `HeroSection`, `DescriptionSection`, `Footer` を表示 | 不要 |
| `/auth/signin`                                  | Googleログインボタンを表示                                             | 不要 |
| `/dashboard/*`                                  | ダッシュボード配下。middlewareで保護                                   | 必要 |
| `/dashboard/group-list`                         | 全グループ一覧、検索、参加                                             | 必要 |
| `/dashboard/my-group`                           | 参加中グループ一覧、脱退                                               | 必要 |
| `/dashboard/group/[id]`                         | グループ詳細、タスク一覧、CSV、権限操作                                | 必要 |
| `/dashboard/create-group`                       | グループ作成                                                           | 必要 |
| `/dashboard/create-task`                        | タスク作成                                                             | 必要 |
| `/dashboard/my-task`                            | 自分が関係するタスク一覧                                               | 必要 |
| `/dashboard/settings`                           | ユーザー設定、通知トグル                                               | 必要 |
| `/dashboard/create-notification`                | 通知作成                                                               | 必要 |
| `/dashboard/auction`                            | オークション一覧                                                       | 必要 |
| `/dashboard/auction/[auctionId]`                | オークション詳細、入札、QA、ウォッチ                                   | 必要 |
| `/dashboard/auction/history`                    | 入札履歴                                                               | 必要 |
| `/dashboard/auction/created-detail/[auctionId]` | 出品側詳細                                                             | 必要 |
| `/dashboard/auction/won-detail/[auctionId]`     | 落札側詳細                                                             | 必要 |
| `/dashboard/review-search`                      | オークションレビュー検索/編集                                          | 必要 |
| `/dashboard/github-api-conversion`              | 画面は存在するが現状 `準備中`                                          | 必要 |

## API Route

| API                                                | 概要                                          | 認証/制約                |
| -------------------------------------------------- | --------------------------------------------- | ------------------------ |
| `/api/[...nextauth]`                               | NextAuth handlers                             | NextAuth設定に委譲       |
| `/api/notifications`                               | 汎用通知送信                                  | `getAuthSession()` 必須  |
| `/api/push-notification/subscription-update`       | Push購読変更保存                              | `getAuthSession()` 必須  |
| `/api/upload`                                      | R2署名URL生成。入力は `contentType`           | API層認証なし            |
| `/api/upload/get-signed-url`                       | R2署名URL生成。入力は `fileType`, `fileName?` | API層認証なし            |
| `/api/auctions/[auctionId]/auction-data`           | SSE初期データ取得                             | `x-internal-secret` 必須 |
| `/api/auctions/[auctionId]/sse-server-sent-events` | SSE stream                                    | GETのみ                  |

## Server Action

現行実装はデータ更新・取得の多くを Server Action に寄せています。

- `src/actions/group`: グループ作成、参加、編集、削除、一覧、参加中一覧
- `src/actions/user`: ユーザー設定、ユーザー候補取得
- `src/actions/permission`: App owner / Group owner / task関係者判定
- `src/actions/task`: タスク作成、編集、削除、CSV一括処理、エクスポート
- `src/actions/auction`: 一覧、詳細、入札、自動入札、SSE publish、QA、評価、ウォッチ
- `src/actions/notification`: 通知作成、一覧、既読、Push、Email、Auction通知
- `src/actions/cloudflare`: R2署名URL生成、画像ファイル検証
- `src/actions/review-search`: レビュー検索、候補、レビュー編集

## 共通設定

### 認証

`src/library-setting/auth.ts` が NextAuth 設定を持ちます。Google provider のみで、JWT session を使います。middleware は
`/dashboard/:path*` を保護します。

### 環境変数

`src/library-setting/env.ts` は `@t3-oss/env-nextjs` で server/client
env を定義します。DB、NextAuth、Cloudflare/R2、Resend、Upstash Redis、VAPID、Supabase、内部API secret などを扱います。

### TanStack Query

`src/library-setting/tanstack-query.ts` で query key factory、QueryClient、IndexedDB
persister、toast連携、mutation後の cache invalidation を定義します。

特徴:

- `staleTime` と `gcTime` は基本的に `Infinity`
- `retry` は false
- `refetchOnMount`, `refetchOnWindowFocus`, `refetchOnReconnect` は true
- mutation meta の `invalidateCacheKeys` を使って該当 query を invalidate
- `Result` 型の `success/message` を toast 表示に利用

### Zod schema

`src/library-setting/zod-schema.ts` にフォーム検証が集約されています。

- グループ: name/goal/evaluationMethod/maxParticipants/depositPeriod
- 初期設定: username/lifeGoal
- タスク: task/detail/reference/info/imageUrl/contributionType/reporters/executors/auction dates/deliveryMethod
- 通知: title/message/targetType/sendTiming/date/action/user/group/task/push/email

## レイアウト

`/dashboard` 配下は `DashboardLayout` が `Header` と `Sidebar`
を含む構成です。メイン領域はスクロール可能なコンテンツ領域になっています。各ページは `MainTemplate`
で見出しと中身を配置するパターンが多く使われています。

## UIとロジックの分離

現行実装では、画面コンポーネントと状態管理・副作用を分ける方針が多く見られます。

- UIコンポーネントは表示とイベント委譲を中心にします。
- URL query、TanStack Query、mutation、toast、ローカル状態のまとまりは `src/hooks/**` に寄せます。
- DB更新や複雑な検証は `src/actions/**` に置きます。
- 実装ファイルから仕様やテストに辿れるよう、docs/test を参照するコメントを置く方針があります。

## バックグラウンド処理

`package.json` の script から以下を実行できます。

- `actions:update-auction-status-to-active`: 開始時刻を過ぎたオークションを `AUCTION_ACTIVE` にする
- `actions:update-auction-status-to-completed`: 期限切れオークションを終了処理する
- `actions:return-auction-deposit-points`: deposit point を返還する
- `actions:send-scheduled-notifications`: 予約通知を送信する

## テスト・品質

Vitest が使われています
