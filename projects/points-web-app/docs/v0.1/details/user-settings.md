# ユーザー設定仕様

## 既存仕様書との乖離・注意点

既存仕様には認証直後の追加情報入力の想定がありますが、現行実装では `/dashboard/settings` で `UserSettings`
を後から upsert します。通知トグルは settings 画面から更新され、PushトグルはService
Worker購読の作成/削除とも連動します。

現行実装では、初回ログイン直後に必ず `UserSettings` を作成する処理は確認できません。プロフィール保存を実行すると
`UserSettings` が作成されます。Push通知はDB上の `isPushEnabled` だけでなく、ブラウザ権限、Service Worker、Push
Subscription、購読DBレコードの状態にも依存します。

## 実装場所

- `src/actions/user/user-settings.ts`
- `src/actions/user/user.ts`
- `src/actions/user/cache-user.ts`
- `src/components/setting/setup-form.tsx`
- `src/components/notification/email-notification-toggle.tsx`
- `src/hooks/notification/use-push-notification.ts`
- `src/actions/notification/push-notification.ts`
- `src/library-setting/zod-schema.ts`
- `src/library-setting/tanstack-query.ts`
- `prisma/schema.prisma`

## モデル

`UserSettings`:

- `userId`
- `username`
- `lifeGoal`
- `isEmailEnabled`
- `isPushEnabled`

`UserSettings` は `User` に対して 1:1 の設定レコードです。`userId` は unique です。DB default は以下です。

- `username`: `未設定`
- `lifeGoal`: `未設定`
- `isEmailEnabled`: `false`
- `isPushEnabled`: `false`

## 設定画面

`/dashboard/settings` は現在ユーザーの設定を取得し、以下を表示・更新します。

- ユーザー名
- 人生の目標
- メール通知ON/OFF
- Push通知ON/OFF

設定取得は `getUserSettings(userId)` で `UserSettings` を `findUnique` します。設定画面の TanStack Query は `userId`
が取得できた場合だけ実行され、`staleTime` と `gcTime` は `Infinity` です。プロフィール更新や通知トグル更新後は
`queryCacheKeys.userSettings.userAll(userId)` を invalidate します。

設定未取得、または取得結果が `null` の場合、画面表示では `username` / `lifeGoal` に `未設定` を使います。最終更新日は
`updatedAt` と `createdAt` がある場合だけ `yyyy/MM/dd` 形式で表示します。

## プロフィール更新

`updateUserSetup(data, userId)` は `username` と `lifeGoal` を upsert します。

検証:

- `username`: 2-40文字
- `lifeGoal`: 2-200文字

処理:

1. `data` と `userId` が存在しなければ `無効なパラメータが指定されました` で throw します。
2. `userId` をキーに `UserSettings` を upsert します。
3. 既存レコードがあれば `username` と `lifeGoal` だけ更新します。
4. レコードがなければ `userId`、`username`、`lifeGoal` で作成します。
5. 成功時は `{ success: true, data: null, message: "ユーザー設定を更新しました" }` を返します。

文字数制約は設定フォームの `setupSchema` で検証されます。server action 側では `data` と `userId`
の存在確認のみで、文字数の再検証は確認できません。

## 通知トグル更新

`updateUserSettingToggle({ userId, isEnabled, column })` は `UserSettings` の boolean column を更新します。

許可される column:

- `isEmailEnabled`
- `isPushEnabled`

Push通知のON/OFFは hook 側でブラウザ権限、Service Worker登録、Push購読保存/削除を実行したうえでこの設定値を更新します。

`updateUserSettingToggle` は `UserSettings` の既存行を `update` します。プロフィール保存とは異なり `upsert`
ではありません。設定行がないユーザーで通知トグルだけ操作した場合の結果は Prisma の `update` に依存します。

入力検証:

- `params` がなければ throw
- `userId` は非空文字列
- `isEnabled` は boolean
- `column` は `isEmailEnabled` または `isPushEnabled`

戻り値の `data` には `id`、`userId`、更新した boolean column が含まれます。

## メール通知トグル

メール通知トグルは `isEmailEnabled` のDB値だけを更新します。`NEXT_PUBLIC_IS_RESEND_ENABLED === "false"`
の場合は、画面に「後ほど開発予定」という注意文を表示しますが、Switch 自体を無効化する処理は確認できません。

メール通知が実際に送信されるかどうかは notification domain の実装と環境変数に依存します。この文書の調査範囲では、
`isEmailEnabled=true` が本番メール送信を必ず意味するとは断定しません。

## Push通知トグル

`usePushNotification(initialIsPushEnabled, userId)` は、ブラウザ状態とDB設定の同期を管理します。

初期 state:

- `isSupported`: `window`、`navigator.serviceWorker`、`PushManager`、`Notification` が利用可能な場合 true
- `permissionState`: `Notification.permission`
- `registration`: 初期値 `null`
- `subscription`: 初期値 `null`
- `recordId`: 初期値 `null`
- `deviceId`: 初期値 `null`
- `isEnabled`: `initialIsPushEnabled`

### ONにする処理

Push通知をONにする場合は、以下の順で処理します。

1. Push API / Service Worker / Notification API の対応状況を確認します。
2. 通知 permission が `granted` でなければ `Notification.requestPermission()` を実行します。
3. permission が `granted` にならなければ、state を disabled に戻して throw します。
4. `navigator.serviceWorker.controller` がない場合は `/service-worker.js` を登録します。
5. `navigator.serviceWorker.ready` で active な Service Worker registration を取得します。
6. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` を取得し、URL Base64 から `Uint8Array` に変換します。
7. 既存の `pushManager.getSubscription()` を取得し、なければ `pushManager.subscribe()` します。
8. `getDeviceId(userId)` で deviceId を生成します。
9. subscription endpoint から既存 recordId を取得し、`saveSubscription` で購読情報を保存します。
10. hook state を有効状態へ更新します。
11. `updateUserSettingToggle({ userId, isEnabled: true, column: "isPushEnabled" })` を実行します。

購読保存時の `userId` は `saveSubscription` action 内の認証 session から取得されます。一方、`isPushEnabled`
更新には hook 引数の `userId` が使われます。

### OFFにする処理

Push通知をOFFにする場合は、以下の順で処理します。

1. `navigator.serviceWorker.controller` がある場合だけ `navigator.serviceWorker.ready` を取得します。
2. `registration.pushManager.getSubscription()` で実際の subscription を取得します。
3. subscription があれば、endpoint 単位でDBの購読情報を削除します。
4. ブラウザ側 subscription を `unsubscribe()` します。
5. hook state の registration / subscription / recordId / deviceId を `null` にし、`isEnabled=false` にします。
6. `updateUserSettingToggle({ userId, isEnabled: false, column: "isPushEnabled" })` を実行します。

### permission失効時の同期

DB上 `isPushEnabled=true` でも、画面表示時に `Notification.permission !== "granted"` であれば cleanup
query が実行されます。この処理は毎回実行したいため、専用 query key を使い、`staleTime` と `gcTime` は `0` です。

処理内容:

1. `getDeviceId(userId)` で deviceId を生成します。
2. `deleteSubscriptionByDeviceId(deviceId)` でDBの購読情報を削除します。
3. `updateUserSettingToggle({ userId, isEnabled: false, column: "isPushEnabled" })` を実行します。
4. hook state を disabled に戻します。
5. `queryCacheKeys.userSettings.userAll(userId)` を invalidate します。

## ユーザー候補

`getAllUsers` は `UserSettings.username`
を表示名として返します。未設定時は fallback 名を使います。タスク報告者/実行者や通知対象ユーザーの候補で利用されます。

`getCachedAllUsers` は `User.name` 昇順で全ユーザーを取得し、`cacheLife("max")` を指定します。表示名は
`settings.username` を優先し、未設定時は `未設定_${user.id}` です。

## 注意点

- `updateUserSetup` と `updateUserSettingToggle` は `userId` を引数で受けます。action 内で session
  user と引数 userId の一致を検証する処理は確認できません。
- Push通知設定のON/OFFは、DB設定だけでなくブラウザ側 permission と購読状態に依存します。
- `updateUserSettingToggle` は `upsert` ではないため、`UserSettings`
  が存在しない状態でトグル更新だけを行うケースは注意が必要です。
- `isEmailEnabled`
  はDB上の希望設定であり、メール送信処理の有効性は別途 notification 実装と環境変数を確認する必要があります。
