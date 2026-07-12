# タスク管理仕様

## 既存仕様書との乖離・注意点

現行 schema には `TaskReport` のような独立モデルはなく、タスクの報告者/実行者は `TaskReporter` と `TaskExecutor`
で表現します。`ContributionType.REWARD` のタスクは `Auction`
を持つため、タスク管理とオークション管理は分離しきれていません。

作成・編集フォームは報酬タスクと通常タスクで入力項目が変わります。server
action 側の認可、UI側の編集/削除可否、CSV処理によるステータス遷移はそれぞれ条件が異なるため、同じ「操作不可」でもどの層で制限されているかを分けて扱います。

## 実装場所

- `src/actions/task/create-task-form.ts`
- `src/actions/task/task.ts`
- `src/actions/task/edit-task-modal.ts`
- `src/actions/task/my-task-table.ts`
- `src/actions/task/group-detail-table.ts`
- `src/actions/task/bulk-update-task-status.ts`
- `src/actions/task/bulk-update-fix-evaluation.ts`
- `src/components/task/*`
- `src/hooks/form/use-create-task-form.ts`
- `src/hooks/task/*`
- `src/hooks/modal/use-task-edit-modal.ts`
- `prisma/schema.prisma`

## タスクモデル

主なフィールド:

- `task`: タスク名
- `detail`: 詳細
- `reference`: 参照
- `info`: 証拠情報
- `imageUrl`: 報酬型タスク用画像URL
- `contributionType`: `REWARD` / `NON_REWARD`
- `category`: default `その他`
- `deliveryMethod`: 提供方法
- `status`: `TaskStatus`
- `creatorId`, `groupId`
- fixed評価フィールド

関連モデル:

- `TaskReporter`: 報告者。`userId` と `name` は nullable です。
- `TaskExecutor`: 実行者。`userId` と `name` は nullable です。
- `Auction`: `ContributionType.REWARD` のタスクに紐づくオークションです。

`Task` 削除や `Group` / `User` 削除に関連して、`TaskReporter`、`TaskExecutor`、`Auction`
は cascade 削除される関係があります。

## 作成フォーム

`prepareCreateTaskForm`
は、認証ユーザーが参加している group と、その group の user 候補を返します。参加グループがない場合は成功=falseで空配列を返します。

候補データ:

- `groups`: 認証ユーザーが参加しているグループの `id` / `name`
- `users`: 認証ユーザーが参加している全グループのメンバー
- ユーザー候補は `userId` で重複排除されます。
- 表示名は `UserSettings.username` を優先し、未設定時は `未設定_${userId}` です。

フォーム初期値:

- `contributionType`: `REWARD`
- `category`: `その他`
- `auctionStartTime`: 当日 00:00
- `auctionEndTime`: 7日後 00:00
- `isExtension`: `"false"`
- `deliveryMethod`: 空文字
- `imageUrl`: 空文字

フォーム上は登録済みユーザーの選択と未登録ユーザー名の入力に対応します。登録済みユーザーは重複追加を抑制します。未登録ユーザーは
`userId` なし、`name` のみの participant として扱われます。

`contributionType === REWARD` の場合だけ、以下の入力を表示します。

- 報酬画像
- オークション開始日
- オークション終了日
- スナイピング対策の延長有無
- 提供方法

送信時は開始日/終了日を 00:00:00 に丸めます。`NON_REWARD` の場合、`deliveryMethod` は送信しません。

## 作成処理

`createTask(data)`:

1. 入力 group の存在を確認します。
2. 認証ユーザーを取得します。
3. `Task` を作成します。
4. reporters/executors が未指定なら作成者を reporter/executor にします。
5. `contributionType === REWARD` の場合は `Auction` を作成します。
6. `/dashboard/group/{groupId}` を revalidate します。

reporters/executors:

- 指定あり: `userId` と `name` を relation に作成します。
- 指定なし: 作成者の `userId` を reporter/executor として自動登録します。

`REWARD` の Auction 初期値:

- startTime: フォーム値。未指定なら現在時刻
- endTime: フォーム値。未指定なら7日後
- groupId: task の group
- isExtension: string/boolean を boolean に変換
- その他は schema default

作成時に明示設定する Auction フィールドは `taskId`, `startTime`, `endTime`, `groupId`, `isExtension`
です。最高入札額、延長回数、延長時間などは schema default に従います。`isExtension` は文字列の場合、`"true"`
だけ true 扱いです。

## 一覧

### グループ詳細タスク一覧

グループ内のタスクを検索、報酬タイプ、ステータス、ソート、ページングで取得します。グループ詳細画面に表示されます。

### My Task

`getMyTaskData` は次のいずれかに該当するタスクを返します。

- 自分が creator
- 自分が reporter
- 自分が executor

検索対象は `task` の contains です。`TaskStatus` と `ContributionType` の filter に対応します。

詳細:

- 検索は task 名の部分一致で、大文字小文字を区別しません。
- status / contributionType は `"ALL"` 以外が指定された場合だけ絞り込みます。
- 作成日時などのソート、ページングに対応します。
- 表示項目には group 名、task 名、報告者、実行者、固定評価ポイント、算出者、算出ロジック、ステータス、Auction 導線、編集、削除、詳細が含まれます。
- Auction が紐づく場合は Auction 詳細へのボタンを表示し、ない場合は `-` を表示します。

## 編集

`updateTaskAction(taskId, data)` は権限チェック後に task を更新します。

挙動:

- reporters/executors が渡された場合、既存 relation を削除して再作成します。
- `NON_REWARD -> REWARD` で auction がない場合、Auction を作成します。
- `REWARD -> NON_REWARD` で既存 auction があり、入札がない場合は Auction を削除します。
- 入札あり auction は削除せず、ログ警告を出して task 更新を続行します。

更新処理は transaction 内で実行されます。`data.reporters` / `data.executors`
が渡された側だけ、既存 relation を全削除して再作成します。渡されなかった側の relation は維持されます。

注意:

- 編集時に作る Auction は `extensionLimitCount = 3`, `extensionTime = 10` を設定します。
- revalidate path に `/dashboard/my-tasks` が含まれますが、現行ルートは `/dashboard/my-task` です。
- 編集で `NON_REWARD -> REWARD` にする場合、開始時刻は現在時刻、終了時刻は7日後です。
- 編集UIには、作成時のような Auction 開始日/終了日/延長設定/提供方法の入力欄は確認できません。
- 編集フォーム側の未登録ユーザー名の保存挙動は未確認です。現行コードには、未登録名を state に保持せず `null`
  にしている箇所があります。

## 削除

`deleteTask(taskId, userId)` は task 存在確認後、`checkIsPermission(userId, undefined, taskId, true)`
が成功した場合に削除します。

検証:

- `taskId` と `userId` が非空文字列でなければ throw
- 権限がなければ `{ success: false, message: "このタスクを削除する権限がありません" }`
- task が存在しなければ throw

削除成功後は `/groups/{groupId}` と `/dashboard/group/{groupId}` を revalidate します。

## ステータス更新

`updateTaskStatus(taskId, newStatus)` は `TaskStatus` として有効な値のみ受け付けます。

制約:

- `FIXED_EVALUATED`
- `POINTS_AWARDED`

上記への直接更新は拒否されます。固定評価・ポイント付与は専用CSV処理で行われます。

ステータス更新では、task の `groupId` を取得したうえで `checkIsPermission(userId, groupId, taskId, true)`
を実行します。このため App owner、Group owner、task creator/reporter/executor が許可候補です。

UI側の制限:

- My Task UI では `FIXED_EVALUATED`, `POINTS_AWARDED`, `ARCHIVED`, `TASK_COMPLETED` を編集不可にします。
- My Task UI の削除は `PENDING` のタスクのみ許可します。
- Group owner の場合も、UI上の削除は `PENDING` に限定されます。

server action 側の `updateTaskStatus` が直接拒否するのは `FIXED_EVALUATED` と `POINTS_AWARDED`
への更新です。UI側の編集不可status とは範囲が異なります。

## タスクとオークションの関係

- `REWARD` タスクは Auction を持ちます。
- オークション状態は `Task.status` に保存されます。
- 入札・落札・納品・評価により `Task.status` が進みます。
- `NON_REWARD` への変更時、入札なし auction は削除されます。

詳細は [auction.md](../../../../markets-web-app/docs/v0.1/details/auction.md) を参照してください。

## 注意点

- `TaskReporter` / `TaskExecutor` は `userId` nullable かつ `name`
  nullable です。未登録ユーザー名を保持できる設計ですが、編集フォームで未登録名が確実に保存されるかは未確認です。
- 権限判定の reporter/executor 分岐には、`where userId` で絞った relation の `id` と `userId`
  を比較している箇所があります。意図は userId 判定に見えますが、仕様上は要確認として扱います。
- `/dashboard/my-tasks` と `/dashboard/my-task` の revalidate path 差分は、ルーティング確認が必要です。
