# バックエンドレスポンス形式

## 既存仕様書との乖離

このファイルの旧記載では、すべての API レスポンスを `{ code, message, details }` に統一する前提になっていた。

現行実装では、バックエンドから返る形式は統一されていない。主に次の形式が併存している。

- Server Action の標準形式: `{ success, message, data }`
- Route Handler のエラー形式: `{ error }`
- 一部 Route Handler のエラー形式: `{ success: false, error }`
- Route Handler の成功レスポンス: リソース本体、または Server Action の結果をそのまま返す
- SSE: JSON ではなく `text/event-stream` の `Response`
- Cloudflare 画像アップロード補助処理: `{ success, url?, error? }`
- 画像バリデーション: `{ valid, error? }`

そのため、この仕様書では「現行実装から読み取れるレスポンス形式」を正として記載する。

## 適用範囲

この仕様は、`projects/web-app/src/actions` と `projects/web-app/src/app/api`
から呼び出されるバックエンド処理の戻り値を対象にする。

対象外:

- Prisma の内部戻り値
- 外部サービスの生レスポンス
- UI コンポーネント内部だけで扱う一時的な表示状態

## Server Action の標準形式

多くの Server Action は `PromiseResult<T>` または `Result<T>` を返す。

```ts
type PromiseResult<T> = Promise<{
  success: boolean;
  message: string;
  data: T;
}>;

type Result<T> = {
  success: boolean;
  message: string;
  data: T;
};
```

成功時:

```json
{
  "success": true,
  "message": "グループを作成しました",
  "data": null
}
```

失敗時:

```json
{
  "success": false,
  "message": "入力内容に誤りがあります",
  "data": null
}
```

### フィールド

| field     | type      | required | desc                                                                                                                                         |
| --------- | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `success` | `boolean` | yes      | 処理結果。成功時は `true`、業務上の失敗時は `false`                                                                                          |
| `message` | `string`  | yes      | UI 表示、ログ、呼び出し元の分岐に使う説明文                                                                                                  |
| `data`    | `T`       | yes      | 成功時の戻り値。返すデータがない場合は `null` を返すことが多いが、失敗時も `false`、空配列、部分的なデータ、集計オブジェクトを返す処理がある |

### エラーと `throw`

現行実装では、すべての失敗が `success: false` で返るわけではない。

- 入力値の不足、権限不足、業務ルール違反を `success: false` で返す処理がある
- 必須パラメータ不足や想定外エラーを `throw new Error(...)` する処理がある
- `catch` 内で一部の既知エラーだけ `success: false` に変換し、それ以外は再 throw する処理がある
- 認証情報がない場合に、戻り値ではなく `redirect("/auth/login")` する処理がある

呼び出し側は、`success` の確認だけでなく、Server Action が例外を投げる可能性も考慮する。

## Route Handler の JSON レスポンス

`src/app/api` 配下の Route Handler は、HTTP ステータスと JSON ボディを組み合わせて返す。

### 成功レスポンス

成功時の形式はエンドポイントごとに異なる。

| endpoint                                               | status | body                                                                                             |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------ |
| `POST /api/upload`                                     | `200`  | `{ signedUrl, publicUrl, key }` または署名付き URL 生成結果そのもの                              |
| `POST /api/upload/get-signed-url`                      | `200`  | `{ signedUrl, publicUrl, key }`                                                                  |
| `POST /api/notifications`                              | `200`  | `sendGeneralNotification` の `PromiseResult<null>`                                               |
| `POST /api/push-notification/subscription-update`      | `200`  | `{ success: true, message, subscription }`                                                       |
| `GET /api/auctions/[auctionId]/auction-data`           | `200`  | 現行 Route 実装上は `getUpdatedAuctionByAuctionId` の戻り値。つまり `{ success, message, data }` |
| `GET /api/auctions/[auctionId]/sse-server-sent-events` | `200`  | `text/event-stream`                                                                              |

注意:

`GET /api/auctions/[auctionId]/auction-data`
は、テスト上はオークションデータ本体を返す期待になっているが、現行 Route 実装は `getUpdatedAuctionByAuctionId()`
の戻り値をそのまま `NextResponse.json(...)` に渡している。つまり、実装から読む限りは `{ success, message, data }`
が返る。SSE クライアント側は `payload.data ?? payload` で受けており、`{ data: auction }`
と auction 本体の両方に耐える実装になっている。

例:

```json
{
  "success": true,
  "message": "購読情報が更新されました",
  "subscription": {
    "id": "..."
  }
}
```

### エラーレスポンス

Route Handler のエラーは、主に `{ error: string }` を返す。

```json
{
  "error": "Unauthorized"
}
```

一部の API は `{ success: false, error: string }` を返す。

```json
{
  "success": false,
  "error": "認証が必要です"
}
```

### HTTP ステータス

| status | usage                                             |
| ------ | ------------------------------------------------- |
| `200`  | 処理成功                                          |
| `204`  | SSE の `OPTIONS` プリフライト成功                 |
| `400`  | 必須パラメータ不足、対象データなし、入力不正      |
| `401`  | 未認証、内部 API 用シークレット不一致             |
| `405`  | SSE エンドポイントで `GET` 以外を拒否             |
| `500`  | 署名付き URL 生成失敗、通知作成失敗、想定外エラー |

## SSE レスポンス

オークションの SSE エンドポイントは JSON API ではなく、`Response` でストリームを返す。

成功時:

- `Content-Type`: `text/event-stream; charset=utf-8`
- `Cache-Control`: `no-cache, no-transform`
- `Connection`: `keep-alive`
- body: `data: {...}\n\n` の SSE 形式

初期データは内部 API の `/api/auctions/[auctionId]/auction-data` を呼び出し、その JSON 文字列を `data: ${data}\n\n`
として流す。

失敗時:

```json
{
  "error": "オークションIDが必要です"
}
```

ただし、SSE の `GET` 以外のメソッドは body なしで `405` を返す。`OPTIONS` は body なしで `204` を返す。

## 一括処理のレスポンス

CSV インポートや一括更新では、全体結果は `PromiseResult<T>` を使い、行単位の失敗情報を `data` 内に保持する。

例: タスクステータス一括更新

```json
{
  "success": false,
  "message": "タスクステータスの一括更新が完了しました",
  "data": {
    "updatedCount": 3,
    "failedCount": 2,
    "failedData": [
      {
        "taskId": "task-id",
        "status": "TASK_COMPLETED",
        "error": "このタスクのステータスを変更する権限がありません"
      }
    ]
  }
}
```

一括処理では、処理全体が完了していても、一部行が失敗した場合は `success: false` になることがある。呼び出し側は `success`
だけでなく、`data.failedCount` と `data.failedData` も確認する。

例外として、固定評価の一括更新では行単位の失敗が `failedData` に入っていても、関数全体は `success: true`
を返す。これは「処理自体は完了し、成功行と失敗行をまとめて返した」という扱いになっているためである。

```json
{
  "success": true,
  "message": "3件のタスクが正常に更新されました。2件の更新に失敗しました。",
  "data": {
    "successData": [
      {
        "id": "task-id",
        "fixedContributionPoint": 10,
        "fixedEvaluatorId": "user-id",
        "fixedEvaluationLogic": "評価ロジック",
        "status": "POINTS_AWARDED"
      }
    ],
    "failedData": [
      {
        "id": "task-id",
        "fixedContributionPoint": "abc",
        "fixedEvaluatorId": "user-id",
        "fixedEvaluationLogic": "評価ロジック",
        "error": "固定貢献ポイントが数値ではありません"
      }
    ]
  }
}
```

## Cloudflare・アップロード関連の例外形式

画像アップロード関連には、標準の `PromiseResult<T>` ではない戻り値がある。

### ファイルアップロード

```ts
type UploadFileResult = {
  success: boolean;
  url?: string;
  error?: string;
};
```

成功時:

```json
{
  "success": true,
  "url": "https://..."
}
```

失敗時:

```json
{
  "success": false,
  "error": "ストレージ設定が不完全です"
}
```

### 画像バリデーション

```ts
type ImageValidationResult = {
  valid: boolean;
  error?: string;
};
```

成功時:

```json
{
  "valid": true
}
```

失敗時:

```json
{
  "valid": false,
  "error": "ファイルが選択されていません"
}
```

## 通知関連のレスポンス

通知関連は、Server Action の `PromiseResult<T>` と Route Handler の JSON レスポンスが混在している。

- `sendGeneralNotification` は `PromiseResult<null>` を返す
- `/api/notifications` は成功時に `sendGeneralNotification` の結果をそのまま返す
- `/api/notifications` の未認証・例外時は `{ success: false, error }` を返す
- `/api/push-notification/subscription-update` は成功時に `{ success, message, subscription }` を返し、失敗時は
  `{ error }` を返す
- Push 通知送信では、`data` に `{ sent, failed, totalTargets }` を返す
- `/api/notifications` のクライアント側は `{ success, error? }` として扱っており、成功時の `message` / `data`
  は UI 分岐には使っていない

## 認証 API

`/api/[...nextauth]` は `handlers` の `GET` / `POST`
を再 export しているだけなので、レスポンス形式は NextAuth 側に従う。このアプリ固有の `{ success, message, data }` や
`{ error }` の仕様には含めない。

## 新規実装時の指針

現行実装と互換性を保つため、新規の Server Action は原則として `PromiseResult<T>` を返す。

推奨:

```ts
return {
  success: true,
  message: "処理に成功しました",
  data,
};
```

```ts
return {
  success: false,
  message: "処理に失敗しました",
  data: null,
};
```

Route Handler を追加する場合は、既存 API との互換性を優先する。

- HTTP ステータスを必ず設定する
- クライアントが既に `{ error }` を期待している API では、既存形式を変えない
- Server Action の結果をそのまま返す API では、`{ success, message, data }` を維持する
- SSE は JSON API として扱わず、`text/event-stream` のストリームとして扱う
- エラーメッセージに内部例外、環境変数、シークレット値を含めない

## 未統一事項

現行実装には次の未統一がある。

- Route Handler のエラー形式が `{ error }` と `{ success: false, error }` に分かれている
- Route Handler の成功形式が、リソース本体、`PromiseResult<T>`、独自オブジェクトに分かれている
- Server Action の失敗が、`success: false` と `throw new Error(...)` に分かれている
- `data` は失敗時に `null` のことが多いが、空配列、`false`、部分的なデータを返す処理もある
- `message` は Server Action では必須だが、Route Handler の `{ error }` 形式では存在しない
- `GET /api/auctions/[auctionId]/auction-data` は、実装上の戻り値とテスト期待値の間に `{ success, message, data }`
  かオークション本体かのズレがある
- SSE の Upstash 接続失敗は即時に `500` を返すのではなく、再接続を継続する
- SSE の初期データ取得に失敗しても、その場でエラーレスポンスには変換していない

この未統一は現行実装上の事実であり、仕様書上で無理に単一形式へ置き換えない。

## 主な根拠実装

| concern                       | path                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| 標準 Result 型                | `projects/web-app/src/types/general-types.ts`                                       |
| グループ Server Action        | `projects/web-app/src/actions/group/group.ts`                                       |
| タスク一括更新                | `projects/web-app/src/actions/task/bulk-update-task-status.ts`                      |
| 固定評価一括更新              | `projects/web-app/src/actions/task/bulk-update-fix-evaluation.ts`                   |
| Cloudflare アップロード       | `projects/web-app/src/actions/cloudflare/upload.ts`                                 |
| 画像バリデーション            | `projects/web-app/src/actions/cloudflare/image-validator.ts`                        |
| 通知 Server Action            | `projects/web-app/src/actions/notification/general-notification.ts`                 |
| Push 通知 Server Action       | `projects/web-app/src/actions/notification/push-notification.ts`                    |
| アップロード API              | `projects/web-app/src/app/api/upload/route.ts`                                      |
| 署名付き URL API              | `projects/web-app/src/app/api/upload/get-signed-url/route.ts`                       |
| 通知 API                      | `projects/web-app/src/app/api/notifications/route.ts`                               |
| Push 通知購読更新 API         | `projects/web-app/src/app/api/push-notification/subscription-update/route.ts`       |
| オークションデータ API        | `projects/web-app/src/app/api/auctions/[auctionId]/auction-data/route.ts`           |
| オークション SSE API          | `projects/web-app/src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts` |
| 通知作成クライアント          | `projects/web-app/src/hooks/notification/use-create-notification.ts`                |
| オークション SSE クライアント | `projects/web-app/src/hooks/auction/bid/use-auction-bid-sse.ts`                     |
