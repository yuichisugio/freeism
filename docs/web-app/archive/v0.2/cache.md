# v0.2：キャッシュ設計

## 目的

v0.2 では、サーバー負荷とデータ取得回数を減らすため、更新頻度の低いデータはキャッシュし、リアルタイム性が必要なデータはキャッシュしない方針にする。

キャッシュは、フロントエンドとバックエンドで役割を分ける。

1. フロントエンド
   - TanStack Query で画面表示用データをキャッシュする。
   - IndexedDB に TanStack Query のキャッシュを永続化する。
   - mutation 後は、関連する query key を invalidate する。
2. バックエンド
   - Next.js の `"use cache"` を使い、Server Action や Server Component の取得結果をキャッシュする。
   - 更新処理では `revalidateTag()` または `revalidatePath()` で必要な範囲だけ再検証する。
   - SSE やオークションの現在値のように即時性が必要な API は `no-cache` にする。

## フロントエンドのキャッシュ

### 使用する仕組み

- TanStack Query
- `@tanstack/react-query-persist-client`
- `idb-keyval`
- IndexedDB

`src/components/provider/providers.tsx` で `PersistQueryClientProvider` を使い、アプリ全体に `queryClient` と
`persistOptions` を渡す。

### query key

query key は `src/library-setting/tanstack-query.ts` の `queryCacheKeys` に集約する。

同じ条件のデータを同じ key で扱うため、検索条件やテーブル条件のようなオブジェクトは `JSON.stringify(...)` して query
key に含める。

主な分類は次の通り。

- `Notification`
- `userSettings`
- `watchlist`
- `auction`
- `table`
- `tasks`
- `users`
- `permission`
- `review`

### デフォルト設定

`queryClient` のデフォルトは、次の方針にする。

- `staleTime: Infinity`
- `gcTime: Infinity`
- `networkMode: "online"`
- `refetchOnMount: true`
- `refetchOnWindowFocus: true`
- `refetchOnReconnect: true`
- `retry: false`
- `throwOnError: true`

ただし、画面や hook ごとにより短い期限が必要な場合は、個別に `staleTime` と `gcTime` を上書きする。

例：

- オークション一覧の参加グループ ID は 24 時間キャッシュする。
- オークション一覧は 1 時間キャッシュする。
- サジェストや通知一覧は 30 分から 1 時間程度の短いキャッシュにする。
- プッシュ通知権限の確認など、毎回実行したい処理は `staleTime: 0` と `gcTime: 0` にする。

### 永続化

TanStack Query のキャッシュは IndexedDB に保存する。

- 保存 key は `react-query-persister`
- `maxAge` は `Infinity`
- `buster` は `"0"`

キャッシュの保存、復元、削除は `idb-keyval` の `set`、`get`、`del` を使う。

### mutation 後の invalidate

mutation 後のフロントエンドキャッシュ更新は、mutation の `meta.invalidateCacheKeys` に invalidate 対象を渡す。

`MutationCache.onSettled` が `invalidateCacheKeys` を読み取り、`queryClient.invalidateQueries(...)` を実行する。

これにより、各 mutation の成功・失敗ハンドリングと、キャッシュ無効化の入口を共通化する。

## バックエンドのキャッシュ

### 使用する仕組み

- Next.js の `"use cache"`
- `unstable_cacheLife`
- `unstable_cacheTag`
- `revalidateTag`
- `revalidatePath`
- React の `cache`

Next.js の cache 機能を使うため、`next.config.ts` では `experimental.useCache: true` を有効にする。

Prisma は `src/library-setting/prisma.ts` の singleton を通して使う。ただし、Prisma
singleton は DB 接続の再利用のための仕組みであり、取得結果の cache ではない。

### cache key

Next.js の cache tag は `src/library-setting/nextjs-use-cache.ts` の `useCacheKeys` に集約する。

tag key は文字列で作成する。オブジェクトは順序差で key が変わる可能性があるため、必要な場合は `JSON.stringify(...)`
した文字列を key に含める。

主な分類は次の通り。

- `groupDetailTable`
- `auctionCreatedDetail`
- `auctionHistory`
- `auctionRating`
- `auctionQa`
- `notification`
- `reviewSearch`

### `"use cache"` を使う対象

`"use cache"` は、更新頻度が比較的低く、同じ引数に対して同じ結果を返しやすい取得処理に使う。

例：

- オークション一覧取得
- オークション履歴取得
- オークション Q&A 取得
- 通知一覧・未読数取得
- グループ詳細取得
- ユーザー一覧取得
- レビュー検索結果取得
- 静的に近い page、layout、loading、not-found、共通 layout 部品

`"use cache"` ではシリアライズ可能な値だけをキャッシュ対象にする。たとえば `Prisma.sql``...``` のような SQL
builder を返す関数は直接キャッシュせず、キャッシュ対象の関数内でクエリ構築から取得までまとめる。

### cacheLife

更新頻度の低い page や共通部品では `cacheLife("max")` を使う。

一部の取得処理では、用途に合わせて短い cache life を使う。

例：

- オークション Q&A のメッセージ取得は `cacheLife("hours")`
- オークション評価表示用ユーザー情報は `cacheLife("max")`

### cacheTag と revalidateTag

DB 更新後に特定の取得結果だけを更新したい場合は、取得側で `cacheTag(...)` を付け、更新側で `revalidateTag(...)` を呼ぶ。

例：

- レビュー更新後は、該当するレビュー検索結果の tag を再検証する。
- オークション評価作成後は、該当 auctionId と reviewPosition の評価 tag を再検証する。
- オークション Q&A 投稿後は、該当 auctionId の Q&A tag を再検証する。
- オークション出品者側の詳細更新後は、該当 auctionId の出品詳細 tag を再検証する。

### revalidatePath

tag ではなく画面単位で更新したい場合は `revalidatePath(...)` を使う。

例：

- グループ作成・更新後に `/dashboard/group-list` や `/dashboard/my-groups` を再検証する。
- タスク作成・更新後に `/dashboard/group/<groupId>` を再検証する。
- 権限更新後に `/dashboard/group/<groupId>` を再検証する。

tag で対象を特定できる場合は `revalidateTag(...)` を優先し、画面全体の再検証が必要な場合だけ `revalidatePath(...)`
を使う。

## キャッシュしないデータ

リアルタイム性が必要なデータはキャッシュしない。

### SSE

オークション入札の更新は SSE で配信する。

`src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts` は次の設定にする。

- `dynamic = "force-dynamic"`
- `runtime = "edge"`
- Upstash Redis REST の subscribe を使う。
- 初期データ取得時の `fetch` は `cache: "no-cache"` にする。
- response header は `Cache-Control: no-cache, no-transform` にする。

### オークション現在値 API

`src/app/api/auctions/[auctionId]/auction-data/route.ts` は、SSE の初期データ取得に使うためキャッシュしない。

- `dynamic = "force-dynamic"`
- response header は `Cache-Control: no-cache`
- 内部 API secret が一致する場合だけ返す。

### Redis Pub/Sub

オークションイベント送信は Upstash Redis REST の publish を使う。

`src/actions/auction/server-sent-events-broadcast.ts` では、Redis への `fetch` に `cache: "no-cache"` を指定する。

Redis は永続的なアプリ内 cache store ではなく、SSE の Pub/Sub 用に使う。

## Service Worker

PWA の Service Worker は `next-pwa` で生成する。

`next.config.ts` では、開発環境では Service Worker を無効化し、本番では `public/next-pwa-service-worker.js` を配信する。

Service Worker 自体は更新検知が重要なため、`/next-pwa-service-worker.js` には
`Cache-Control: no-cache,no-cache, must-revalidate` を設定する。

## 注意点

- フロントエンドの TanStack Query cache と、バックエンドの Next.js cache は別物として扱う。
- フロントエンドの invalidate は `queryCacheKeys`、バックエンドの revalidate は `useCacheKeys` を使う。
- `router.refresh()` は画面の再取得であり、Next.js の server cache を直接 invalidation する仕組みとして扱わない。
- リアルタイム更新が必要な値を `cacheLife("max")` の対象にしない。
- `"use cache"` 対象の関数では、引数と戻り値がシリアライズ可能か確認する。
- `cacheTag(...)` がない `"use cache"` 関数は、手動での tag
  invalidation 経路が確認できない。必要に応じて、自動 key のみでよいか、明示 tag を追加するかを実装時に確認する。
- Redis は Pub/Sub 用であり、通常の取得結果キャッシュの保存先としては使わない。
- `localStorage` や `sessionStorage` は、現行実装では cache 永続化の保存先として使わない。TanStack
  Query の永続化は IndexedDB を使う。
