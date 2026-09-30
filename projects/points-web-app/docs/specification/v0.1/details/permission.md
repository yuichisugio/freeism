# 権限モデル仕様

## 既存仕様書との乖離・注意点

既存仕様書は機能単位の権限を文章で説明していますが、現行実装は `checkIsPermission` を中心に App owner、Group owner、task
creator/reporter/executor を組み合わせて判定します。一部の判定には意図確認が必要な実装上の注意点があります。この文書ではバグ断定せず、コード上の観測として記載します。

server action の共通認可と、画面上のボタン表示制御は同じではありません。特に App owner は `checkIsPermission`
上は許可されますが、グループ詳細画面の管理ボタンは参加状態や `isOwner` の計算にも依存します。

## 実装場所

- `src/actions/permission/permission.ts`
- `prisma/schema.prisma`
- `src/actions/group/*`
- `src/actions/task/*`
- `src/components/group/group-detail.tsx`
- `src/hooks/group/group-detail/use-group-permission.ts`
- `src/actions/task/bulk-update-task-status.ts`
- `src/actions/task/bulk-update-fix-evaluation.ts`

## 権限フラグ

| 権限          | モデル/フィールド              | 意味                   |
| ------------- | ------------------------------ | ---------------------- |
| App owner     | `User.isAppOwner`              | アプリ全体の管理者     |
| Group owner   | `GroupMembership.isGroupOwner` | 所属グループ内の管理者 |
| Task creator  | `Task.creatorId`               | タスク作成者           |
| Task reporter | `TaskReporter.userId`          | タスク報告者           |
| Task executor | `TaskExecutor.userId`          | タスク実行者           |

## `checkIsPermission`

入力:

- `propsUserId?`
- `propsGroupId?`
- `propsTaskId?`
- `isRoleCheck?`

判定の流れ:

1. `propsUserId` がなければ session からユーザーIDを取得します。
2. `isRoleCheck` が true の場合は、`propsTaskId` を必須として task creator/reporter/executor を確認します。
3. `User.isAppOwner` が true の場合は許可します。
4. `propsGroupId` がなく `propsTaskId` がある場合は、task から groupId を引きます。
5. 対象 group の `GroupMembership.isGroupOwner` を確認します。

戻り値は `PromiseResult<boolean>` の形式です。

`isRoleCheck=false` の操作では、task creator/reporter/executor は許可条件に含まれません。

詳細:

- `isRoleCheck=true` で `propsTaskId` がない場合は
  `{ success: false, data: false, message: "タスクIDが指定されていません" }` を返します。
- task が存在しない場合は `{ success: false, data: false, message: "タスクが見つかりません" }` を返します。
- task role 判定で許可された場合は、App owner / Group owner 判定へ進まず true を返します。
- `propsGroupId` と `propsTaskId` がどちらもない場合は
  `{ success: false, data: false, message: "グループIDとタスクIDが指定されていません" }` を返します。
- `propsGroupId` がなく `propsTaskId` がある場合は、task から `groupId` を逆引きして Group owner 判定に進みます。

## Server Action別の主な認可

| 機能         | Action                       | 認可                                                  |
| ------------ | ---------------------------- | ----------------------------------------------------- |
| グループ作成 | `createGroup`                | 認証必須                                              |
| グループ参加 | `joinGroup`                  | 認証必須                                              |
| グループ編集 | `updateGroup`                | `checkIsPermission(userId, groupId)`                  |
| グループ削除 | `deleteGroup`                | `checkIsPermission(userId, groupId)`                  |
| メンバー除名 | `removeMember`               | group owner 判定                                      |
| owner付与    | `grantOwnerPermission`       | `checkIsPermission` を利用                            |
| タスク作成   | `createTask`                 | 認証必須、group存在確認                               |
| タスク編集   | `updateTaskAction`           | `checkIsPermission(undefined, groupId, taskId, true)` |
| タスク削除   | `deleteTask`                 | `checkIsPermission(userId, undefined, taskId, true)`  |
| CSV固定評価  | `bulkUpdateFixedEvaluations` | group owner相当の権限確認                             |
| 入札         | `executeBid`                 | 認証、自己出品禁止、active auction                    |
| レビュー編集 | `updateReview`               | `reviewerId` が自分のレビューのみ                     |
| 通知作成API  | `/api/notifications`         | 認証必須                                              |

## グループ操作の認可

- グループ作成時、作成者は `GroupMembership.isGroupOwner=true` で自動参加します。
- グループ編集、削除、メンバー除名は App owner または Group owner が実行できます。
- `Group.createdBy` は保持されますが、編集/削除の認可条件として直接使われている箇所は確認できません。
- メンバー除名では、操作者自身と Group owner は除名できません。
- 除名時に blacklist 追加を選ぶと、`Group.isBlackList` JSON に対象 userId が保存されます。
- グループ参加は、認証済み、未参加、参加上限未満であることを確認します。現行 `joinGroup`
  では blacklist による参加拒否は確認できません。

## タスク操作の認可

タスク編集、削除、ステータス変更、一括ステータス変更は `checkIsPermission(..., isRoleCheck=true)`
を使うため、次のいずれかで許可されます。

- App owner
- Group owner
- task creator
- task reporter
- task executor

一方、タスク作成は action 内では認証と group 存在確認が中心です。作成者が対象 group の member かどうかの明示チェックは確認できません。フォーム準備処理では、ユーザーが参加しているグループを候補として返しています。

## CSV操作の認可

CSVアップロードは画面上 owner のみに表示されます。action 側では、固定評価更新 `bulkUpdateFixedEvaluations` が
`checkIsPermission(userId, groupId, undefined, false)` により App owner / Group owner を要求します。

一方、タスク一括作成、貢献評価一括登録、CSVエクスポート系 action では、この調査範囲では明示的な `checkIsPermission`
は確認できません。UI表示制御や呼び出し元の制約と、server action 内の拒否条件を分けて扱います。

## 画面上の表示制御

`/dashboard/group/[id]` では、画面側で以下を切り替えます。

- owner: グループ編集、削除、CSVアップロード、owner付与、除名を表示
- member: タスク一覧、CSVエクスポート、脱退を表示
- non-member: 参加操作を表示

グループ詳細画面では、取得した `group.members` に現在ユーザーが含まれるかで `isMember`
を判定し、`checkIsPermission(userId, groupId, undefined, false)` の結果で `isOwner` を判定します。管理ボタンは
`isMember && isOwner` の条件下にあるため、App
owner が action 上は許可される場合でも、グループ未参加であれば画面上の管理ボタンが表示されない可能性があります。

owner付与UIは、非 owner メンバーだけを候補に出します。

## 注意点

- `grantOwnerPermission(groupId, selectedUserId)` は、付与対象の `selectedUserId` を使って `checkIsPermission`
  してから同じユーザーを owner に更新します。非 owner に owner 権限を付与する意図と合うかは確認が必要です。
- `checkIsPermission` の reporter/executor 判定は、`where userId` で絞った relation の `id` と `userId`
  を比較している箇所があります。schema 上 `TaskReporter.id` と `TaskReporter.userId` は別です。
- `getGroupMembers` は groupId を受けてメンバーを返し、action 内では権限チェックをしていません。
- `updateUserSettingToggle` や `updateUserSetup` は `userId` を引数で受け、action 内で session
  user と照合する処理は確認できません。
- `Group.createdBy` は保持されますが、現行の編集/削除認可は `checkIsPermission` に寄っています。
- blacklist は除名時に書き込まれますが、参加時の拒否条件として使われている箇所は確認できません。
- CSV系は「画面で出せない」ことと「action が拒否する」ことを分けて確認する必要があります。
