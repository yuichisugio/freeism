# エラーハンドリング仕様

- [エラーハンドリング仕様](#エラーハンドリング仕様)
  - [既存仕様書との乖離・注意点](#既存仕様書との乖離注意点)
  - [基本方針](#基本方針)
    - [想定外の欠陥は `throw` する](#想定外の欠陥は-throw-する)
    - [想定内のユーザー操作ミスは Result で返す](#想定内のユーザー操作ミスは-result-で返す)
  - [Server Action の戻り値](#server-action-の戻り値)
  - [API Route のエラー応答](#api-route-のエラー応答)
  - [Client / Hook のエラー表示](#client--hook-のエラー表示)
    - [TanStack Query 共通処理](#tanstack-query-共通処理)
    - [Form のエラー表示](#form-のエラー表示)
    - [機能別 hook の例](#機能別-hook-の例)
  - [認証・認可エラー](#認証認可エラー)
  - [機能別の注意点](#機能別の注意点)
    - [オークション](#オークション)
    - [CSV](#csv)
    - [通知・Push通知](#通知push通知)
    - [画像アップロード](#画像アップロード)
    - [レビュー検索](#レビュー検索)
  - [ログとメッセージ](#ログとメッセージ)
  - [旧要求として残す事項](#旧要求として残す事項)
  - [回帰確認観点](#回帰確認観点)

## 既存仕様書との乖離・注意点

旧 `web-app/docs/v0.1/error-handling.md` には、想定外の欠陥は `throw new Error(...)`、想定内のユーザー操作ミスは
`{ success: boolean, message: string }`を返す、という基本方針が記載されていました。現行実装でもこの考え方は多くの server
action に残っていますが、戻り値の形や表示方法は機能ごとに完全には統一されていません。

現行コードで確認できる主な差分は次のとおりです。

- `PromiseResult<T>` / `Result<T>` は `{ success: boolean; message: string; data: T }` です。
- Cloudflare R2 upload 系など、一部 action は `{ success: false, error: string }` を返します。
- API Route は `NextResponse.json({ error: string }, { status })` を返す実装が中心です。
- client hook / TanStack Query は `sonner` の `toast.error()` / `toast.success()` でユーザーに結果を表示します。
- 旧仕様にある `PrismaClientKnownRequestError`
  の個別変換は、全体方針としては有効ですが、読んだ範囲では全 action に共通実装されているわけではありません。
- Zod は主に React Hook Form の `zodResolver` で画面入力に適用されます。一部 server action では `parse()` し、
  `ZodError` を user-facing message に変換します。

## 基本方針

### 想定外の欠陥は `throw` する

次のような「呼び出し側や実装側の前提が壊れている」ケースは `throw new Error(...)` として扱います。

- 必須引数が渡されていない。
- 型や値域が関数の前提を満たしていない。
- 取得できるはずの内部データが存在しない。
- DB更新や外部API呼び出しなど、処理継続できない失敗が発生した。
- OCC の version 不一致など、再実行やユーザー再操作が必要な競合が発生した。

現行実装例:

- `review-search` の cache action は `userId`、tab、page、query 定義が不正な場合に `throw new Error(...)` します。
- オークション一覧 cache は `page`、`category`、`status`、`sort` などの条件が不正な場合に `throw new Error(...)`
  します。
- オークション入札処理は対象 Auction が見つからない、更新後 Auction を取得できない、version が変わった、などの内部不整合で
  `throw new Error(...)` します。
- `watchlist` や QA action は `auctionId` / `userId` / message などの必須値不備で `throw new Error(...)` します。

### 想定内のユーザー操作ミスは Result で返す

次のような「仕様上発生しうるユーザー操作の失敗」は、原則として `{ success: false, message, data }` 形式で返します。

- 権限がない。
- 対象データが存在しない。
- 現在の業務状態では操作できない。
- 入力値がユーザー修正可能な範囲で不正。
- 入札額が現在最高額以下。
- 自己出品に対する入札。
- 終了済みまたは未開催のオークションへの操作。

現行実装例:

- `prepareCreateTaskForm` は参加 group がない場合に `success: false` と空配列を返します。
- `validateAuction` は自己出品、終了済み、非 active、現在最高額以下の入札を `success: false` と `message` で返します。
- `setAutoBid` は `maxBidAmount` / `bidIncrement` 不正、auction 検証失敗、現在最高額以下の上限額を `success: false`
  で返します。
- 出品側詳細 action は権限チェックに失敗した場合に `success: false` を返します。

## Server Action の戻り値

標準の戻り値型は `src/types/general-types.ts` の `PromiseResult<T>` / `Result<T>` です。

```ts
export type PromiseResult<T> = Promise<{
  success: boolean;
  message: string;
  data: T;
}>;

export type Result<T> = {
  success: boolean;
  message: string;
  data: T;
};
```

成功時:

```ts
return {
  success: true,
  message: "処理が完了しました",
  data,
};
```

想定内の失敗:

```ts
return {
  success: false,
  message: "この操作を行う権限がありません",
  data: null,
};
```

想定外の失敗:

```ts
throw new Error("タスクIDが指定されていません");
```

注意:

- 旧仕様には `return { succes: boolean, message: string }` という表記がありましたが、現行コード上の正しい key は
  `success` です。
- `data` が不要な action でも `data: null` を返す形が基本です。
- upload 系の一部 action は `error` key を返すため、呼び出し側は `message` だけに依存しない実装になっています。

## API Route のエラー応答

API Route では、HTTP status と `{ error: string }` の JSON を返す実装が中心です。

代表例:

| status | 用途                         | 例                                                 |
| ------ | ---------------------------- | -------------------------------------------------- |
| 200    | 正常                         | auction data、signed URL、subscription update 結果 |
| 400    | request body / params 不正   | `fileTypeは必須です`, `オークションIDが必要です`   |
| 401    | 内部 secret / 認証失敗       | `Unauthorized`                                     |
| 500    | 外部サービスや内部処理の失敗 | `内部サーバーエラー`                               |

実装例:

- `src/app/api/upload/route.ts`
  - `contentType` がない場合は 400。
  - signed URL を生成できない場合は 500。
  - catch では `console.error` し、500 を返します。
- `src/app/api/upload/get-signed-url/route.ts`
  - `fileType` がない場合は 400。
  - 署名付きURL生成失敗は 500。
- `src/app/api/auctions/[auctionId]/auction-data/route.ts`
  - `x-internal-secret` が `FREEISM_APP_API_SECRET_KEY` と一致しない場合は 401。
  - `auctionId` がない場合は 400。
  - catch ではログを出し、500 相当の error JSON を返します。
- `src/app/api/push-notification/subscription-update/route.ts`
  - request 不正は 400。
  - user 未認証は 401。
  - 予期しない失敗は 500。
- `src/app/api/auctions/[auctionId]/sse-server-sent-events/route.ts`
  - `OPTIONS` は 204。
  - `GET` 以外は 405。
  - Redis 接続失敗時は route 側で即 500 にせず、接続再試行する設計です。

注意:

- middleware で保護されるのは主に `/dashboard/:path*` です。API
  route は route ごとに認証、内部 secret、入力検証の有無を確認する必要があります。
- upload API は読んだ範囲では API 層の認証チェックを確認できません。
- `auction-data` API の「オークションが見つかりません」は 404 ではなく 400 です。

## Client / Hook のエラー表示

ユーザー向けのエラー表示は `sonner` の toast を使う実装が多いです。

### TanStack Query 共通処理

`src/library-setting/tanstack-query.ts` では、Query / Mutation の共通 error handling を定義しています。

- `QueryCache.onError`: `console.error(error)` と `toast.error(error.message)`。
- `QueryCache.onSuccess`: `meta.toast === true` かつ `Result` 形式の場合、`success` に応じて success/error toast。
- `MutationCache.onError`: 想定外 error を `console.error` し `toast.error(error.message)`。
- `MutationCache.onSuccess`: `Result` 形式の場合、`success` に応じて success/error toast。

### Form のエラー表示

フォーム系 UI では、React Hook Form と Zod を組み合わせて入力検証します。

- 画面入力は `zodResolver` により field 単位の validation error を表示します。
- action 結果や権限失敗は `form.setError("root", ...)` または field error に変換される実装があります。
- root error は `FormLayout` などのフォーム共通 UI で表示されます。
- `createGroup` は server action 側で `createGroupSchema.parse()` を行い、`ZodError`
  を「入力内容に誤りがあります」に変換します。

### 機能別 hook の例

- CSV upload hook は、ファイル未選択、権限不足、サイズ超過、形式不正、保存失敗、予期しない例外を toast で表示します。
- CSV export hook は、日付未設定、開始日/終了日の逆転、期間上限超過、zip作成失敗、export中の例外を toast で表示します。
- notification 作成 hook は、予約送信日未設定、権限不足、送信結果の失敗、catch された例外を toast で表示します。
- push notification hook は、購読情報取得・送信・解除・更新に失敗した場合に toast と `throw new Error` を併用します。
- create task form hook は保存成功/失敗を toast で表示します。

## 認証・認可エラー

認証や認可は機能ごとに扱いが分かれます。

- NextAuth callback 内では user/account 同期に失敗した場合、catch してログ出力する実装があります。
- NextAuth `signIn` callback は、必須情報不足やDB同期失敗時に `false` を返します。
- NextAuth `jwt` callback は、DB取得失敗時にログを出して処理を継続します。
- middleware は `/dashboard/:path*` の未認証アクセスを `/auth/signin?callbackUrl=<pathname>` に redirect します。
- middleware 例外時は `/error` に redirect します。
- `getAuthenticatedSessionUserId()` を使う action は、未認証時に例外または失敗結果として処理されます。
- 権限チェック action の結果は、多くの呼び出し元で `{ success: false, message }` としてユーザー操作失敗に変換されます。

認可失敗は、システム欠陥ではなく「そのユーザーには操作できない」状態なので、原則として user-facing message を返します。

## 機能別の注意点

### オークション

- 入札前検証は `validateAuction` に集約されています。
- 自己出品、終了済み、非 active、現在最高額以下は `success: false` と `message` を返します。
- 入札 transaction 中の不整合、Auction 未取得、version 不一致、Redis publish 失敗などは `throw new Error(...)` します。
- SSE 用 API は内部 secret、auctionId、取得失敗で status を分けます。
- SSE client は JSON parse 失敗や接続断を画面内 error にし、最大3回の再接続後にリロード促し文言を出します。

### CSV

- ファイルサイズや拡張子など、ユーザーが修正できる入力は toast で即時表示します。
- 保存処理の失敗は `result.error` または汎用メッセージで表示します。
- parse / validation / action 実行中の例外は catch して失敗結果に変換し、処理単位の継続可否を制御します。

### 通知・Push通知

- 通知作成は権限と送信条件を hook 側でも確認します。
- `/api/notifications` は未認証を 401、例外を 500 として返します。
- `sendGeneralNotification` は必須パラメータ不足、対象者なし、送信失敗を `throw`
  します。API 側で catch されると、クライアントからは汎用失敗に見える場合があります。
- Push購読更新 API は request body、認証、旧購読存在確認で 400/401/500 を分けます。
- Push hook はユーザー向け toast と例外を併用し、呼び出し元が失敗を検知できるようにします。
- push 送信は、有効購読者なしを `success: true` として扱う一方、VAPID 未設定は `success: false` として扱います。

### 画像アップロード

- API route は `contentType` / `fileType` 不備を 400 として返します。
- 署名付きURL生成失敗や Cloudflare 側の失敗は 500 または `{ success: false, error }` として扱います。
- ユーザーに出す message は「アップロード処理中にエラーが発生しました」など、内部情報を含めない文言にします。
- 画像アップロード UI は XHR の `load` / `error` / `abort`
  イベントで toast 表示を意図する実装があります。docs 上は、すべての throw が呼び出し元 catch に必ず到達するとは断定しません。

### レビュー検索

- cache action は不正な引数を `throw new Error(...)` します。
- 検索クエリが短い/空などの想定内失敗は `success: false` と message を返す実装があります。

## ログとメッセージ

ログ:

- catch した想定外 error は `console.error` で出力します。
- API route では、処理名や file path を含むログ message を出す実装があります。
- user-facing message に stack trace、secret、外部APIの詳細 response を出さないようにします。

ユーザー向けメッセージ:

- ユーザーが次に何を直せばよいか分かる文言にします。
- 権限不足、入力不足、状態不一致は明示します。
- 内部障害は「内部サーバーエラー」「処理中にエラーが発生しました」などに丸めます。

## 旧要求として残す事項

旧 `web-app/docs/v0.1/error-handling.md` にあった方針として、次は継続して有効です。

- サーバー側・クライアント側の両方でエラーハンドリングを行う。
- `try-catch` で想定外 error を握りつぶさない。
- Zod parse error や Prisma known error など、ユーザー操作の失敗として扱えるものは user-facing message に変換する。
- `error instanceof Error ? error.message : "不明なエラー"` のように unknown error を安全に文字列化する。

現行未確認または未統一の事項:

- `PrismaClientKnownRequestError` を共通 helper で分類する実装は確認できません。
- API error response の形式は `{ error: string }` が中心で、旧仕様の `{ error: { code, message, details } }`
  形式には統一されていません。
- `PromiseResult<T>` と upload 系の `{ success, error }` が混在しています。
- client hook ごとの toast 文言や catch 範囲は完全には統一されていません。
- Push 通知の旧仕様にある `useReducer`, `isInitialized`, `errorMessage`, `SUBSCRIPTION_CHANGED`
  を hook 側で受ける実装は、読んだ範囲では確認できません。
- Service Worker の旧 `pushsubscriptionchange` fallback は、現行 API の `/api/push-notification/subscription-update`
  と一致しない記述が残っている可能性があります。
- メール通知の Resend 実送信は、読んだ範囲ではコメントアウトされており、外部送信まで確認できません。

## 回帰確認観点

- 必須引数不備が `throw new Error(...)` されること。
- 権限不足や状態不一致が `success: false` と user-facing message で返ること。
- API route が request 不正を 400、認証/secret 不正を 401、内部失敗を 500 で返すこと。
- TanStack Query の `onError` が toast error を表示すること。
- `Result` 形式の mutation success/error が toast に反映されること。
- CSV upload/export のユーザー入力エラーが画面上で分かること。
- オークション入札検証が自己出品、終了済み、非 active、現在最高額以下を拒否すること。
- upload / push notification / auction SSE の API が内部情報を user-facing response に出さないこと。
