# グループ管理仕様

## 既存仕様書との乖離・注意点

既存の `other.md`
には、グループ作成時の確認 dialog や評価方法の選択UIの想定があります。現行実装では確認 dialog はなく、評価方法は textarea 入力です。また
`maxParticipants` と `depositPeriod` を持ちます。除名時は blacklist
JSON を更新しますが、参加処理で blacklist を参照する処理は確認できません。

画面上の操作表示と server action の実効条件は分けて扱います。例えば owner には画面上の脱退ボタンを表示しませんが、
`leaveGroup` action 自体には owner 脱退禁止チェックは確認できません。

## 実装場所

- `src/actions/group/group.ts`
- `src/actions/group/all-user-group.ts`
- `src/actions/group/my-group.ts`
- `src/actions/group/group-detail.ts`
- `src/components/group/*`
- `src/hooks/group/*`
- `src/actions/permission/permission.ts`
- `src/library-setting/zod-schema.ts`
- `prisma/schema.prisma`

## モデル

- `Group`
  - `name`
  - `goal`
  - `evaluationMethod`
  - `maxParticipants`
  - `depositPeriod`
  - `createdBy`
  - `isBlackList`
- `GroupMembership`
  - `userId`
  - `groupId`
  - `isGroupOwner`
- `GroupPoint`
  - `balance`
  - `fixedTotalPoints`

`Group.createdBy` は作成者IDとして保持されます。ただし編集/削除の認可は `createdBy` の直接比較ではなく、
`checkIsPermission` による App owner / Group owner 判定です。

## 作成

`createGroup(data)` は認証必須です。

入力検証:

- `name`: 1-50文字
- `goal`: 1-500文字
- `evaluationMethod`: 1-1000文字
- `maxParticipants`: 1-1000
- `depositPeriod`: 1-9999

処理:

1. session user を取得します。
2. Zod schema で検証します。
3. `Group` を作成します。
4. 作成者を `GroupMembership.isGroupOwner = true` で同時作成します。
5. `/dashboard/group-list` を revalidate します。

エラー:

- Zod error: `入力内容に誤りがあります`
- `P2002`: `このグループ名は既に使用されています`
- その他は throw

作成時に確認 dialog はありません。評価方法は選択式ではなく textarea 入力です。

## 全グループ一覧

`getAllUserGroups` はページング、検索、ソート、参加状態フィルタを処理します。

主な条件:

- `search`: group name に対する contains
- `isJoined`: `isJoined`, `notJoined`, `all`
- sort: group fields または参加人数
- page/itemPerPage

返却には `joinMembersCount` と現在ユーザーの `isJoined` が含まれます。

詳細:

- `isJoined` は `isJoined` / `notJoined` / `all` のいずれかです。
- `isJoined` の場合は、現在ユーザーの membership がある group に絞ります。
- `notJoined` の場合は、現在ユーザーの membership がない group に絞ります。
- `all` の場合は参加状態で絞りません。
- `search` は group name に対する `contains` です。
- `currentParticipants` sort は `members._count` を使います。
- それ以外の sort は group field を使います。
- 作成者表示名は `UserSettings.username` を優先し、未設定時は `未設定_${userId}` です。

## 参加

`joinGroup(groupId)` は認証必須です。

処理:

1. groupId と group存在を確認します。
2. 既に参加済みなら失敗レスポンスを返します。
3. `maxParticipants` を超える場合は失敗レスポンスを返します。
4. `GroupMembership` を作成します。

検証順:

1. `groupId` が空なら `グループIDがありません` で throw します。
2. 認証ユーザーIDを取得します。
3. group が存在しなければ `グループが見つかりません` で throw します。
4. 既に `GroupMembership` が存在する場合は `既に参加済みです` を返します。
5. 現在の membership 数が `maxParticipants` 以上の場合は `参加人数が上限に達しています` を返します。
6. `GroupMembership` を作成します。

注意:

- 除名時に更新される `Group.isBlackList` を参照する処理は確認できません。
- revalidate path に `/dashboard/my-groups` が含まれますが、現行ルートは `/dashboard/my-group` です。
- `joinGroup` は `GroupMembership` のみ作成します。`GroupPoint` 作成はこの action 内では確認できません。

## 参加中グループ一覧

`getUserJoinGroup` は `GroupPoint` 起点で、現在ユーザーが membership を持つ group を返します。

返却:

- group id/name/goal/evaluationMethod/maxParticipants/depositPeriod
- `balance`
- `fixedTotalPoints`
- `isGroupOwner`

`leaveGroup(groupId, userId)` は membership を削除します。owner の脱退禁止までは action 内では確認できません。

`getUserJoinGroup` の検索・ソート:

- where は `GroupPoint` 起点で、対象 group に現在ユーザーの membership があることを条件にします。
- `searchQuery` がある場合は group name に対する `contains` で絞ります。
- `groupPointBalance` は `GroupPoint.balance` で sort します。
- `groupPointFixedTotalPoints` は `GroupPoint.fixedTotalPoints` で sort します。
- `groupDepositPeriod` は `group.depositPeriod` で sort します。
- その他は group field で sort します。

注意: 新規参加直後にマイグループ一覧へ表示されるかは、別経路で `GroupPoint`
が作成されるかに依存する可能性があります。この調査範囲では `joinGroup` 内での `GroupPoint` 作成は確認できません。

## 詳細

`/dashboard/group/[id]` は `getGroupById(id)` を使って group と members を取得します。画面側で `isMember` と `isOwner`
を計算し、操作ボタンを切り替えます。

主な表示:

- group 基本情報
- メンバー一覧
- タスク一覧
- CSVアップロード/エクスポート
- 参加/脱退
- 編集/削除
- owner付与/除名

画面・権限ごとの操作分岐:

- 非メンバー: 参加ボタンを表示します。
- メンバー共通: CSVエクスポート、タスク一覧を表示します。
- group owner / app owner: グループ編集、CSVアップロード、owner権限付与、メンバー除名、グループ削除を表示します。
- 非 owner メンバー: 脱退ボタンを表示します。
- owner には画面上の脱退ボタンを表示しません。

`isMember` は `group.members` に現在ユーザーが含まれるかで判定します。`isOwner` は
`checkIsPermission(userId, groupId, undefined, false)` の結果です。

## 編集

`updateGroup(groupId, data)` は session
user の権限チェック後に group を更新します。名前重複は自分以外の group を対象に確認します。

処理:

1. `groupId` が空なら throw します。
2. 作成時と同じ `createGroupSchema` で入力値を検証します。
3. 認証ユーザーIDを取得します。
4. `checkIsPermission(userId, groupId, undefined, false)` で App owner / Group owner を確認します。
5. group が存在しなければ throw します。
6. 名前が変更される場合、自分自身を除いた同名 group を検索します。
7. 同名 group があれば throw します。
8. group を更新します。
9. `/dashboard/group-list` と `/dashboard/my-groups` を revalidate します。

## 削除

`deleteGroup(groupId)` は session user の権限チェック後に group を削除します。

処理:

1. `groupId` が空なら throw します。
2. 認証ユーザーIDを取得します。
3. group の存在を確認します。
4. `checkIsPermission(userId, groupId, undefined, false)` で App owner / Group owner を確認します。
5. group を削除します。
6. `/dashboard/group-list` と `/dashboard/my-groups` を revalidate します。

## メンバー除名

`removeMember(groupId, removeUserId, addToBlackList)` は owner のみ可能です。

制約:

- 自分自身は除名できません。
- group owner は除名できません。
- 対象が membership を持っていることを確認します。

処理:

- membership を削除します。
- `addToBlackList` が true の場合だけ、`Group.isBlackList` に `{ [removeUserId]: true }` を追加します。

詳細:

1. `groupId`、`removeUserId`、`addToBlackList` を検証します。
2. 認証ユーザーIDを取得します。
3. `checkIsPermission(currentUserId, groupId, undefined, false)` で App owner / Group owner を確認します。
4. 対象ユーザーの membership を確認します。
5. 対象ユーザーが操作者自身なら失敗します。
6. 対象ユーザーが group owner なら失敗します。
7. transaction 内で membership を削除します。
8. `addToBlackList` が true の場合だけ、既存の `Group.isBlackList` JSON に対象 userId を追加します。
9. `/dashboard/group/{groupId}` を revalidate します。

除名ダイアログには blacklist 追加後の再参加禁止を示す文言がありますが、現行の `joinGroup`
で blacklist を参照する処理は確認できません。

## owner付与

`grantOwnerPermission(groupId, userId)` は指定 membership の `isGroupOwner`
を true に更新します。ただし権限チェックに付与対象 userId を使っているため、画面意図と一致するか確認が必要です。

画面上の owner 権限付与ダイアログでは、現在 owner ではないメンバーだけを選択肢に表示します。

処理:

1. `groupId` と `userId` を検証します。
2. `checkIsPermission(userId, groupId, undefined, false)` を実行します。
3. 対象ユーザーの membership を確認します。
4. 対象が未参加なら失敗します。
5. 対象が既に owner なら失敗します。
6. 対象 membership の `isGroupOwner` を true に更新します。
7. `/dashboard/group/{groupId}` を revalidate します。

注意: 現行実装では `grantOwnerPermission` 内の権限チェックに付与対象の `userId`
が使われています。画面上は owner のみ操作できますが、action の権限判定が画面意図と一致しているかは要確認です。

## 表示名

ユーザー候補やメンバー表示では `UserSettings.username` を優先します。未設定時は `未設定_<userId>`
のような fallback が使われます。

## 注意点

- 除名時の blacklist 書き込みは確認できますが、参加処理で blacklist を参照する処理は確認できません。
- `joinGroup` / `leaveGroup` / `updateGroup` / `deleteGroup` の revalidate に `/dashboard/my-groups`
  が含まれます。現行ルートが `/dashboard/my-group`
  系の場合は不一致の可能性があります。ルーティング全体の確認は別途必要です。
- `leaveGroup` action 自体には owner 脱退禁止チェックは確認できません。画面上は owner に脱退ボタンを表示しない制御です。
- 編集フォームの `depositPeriod`
  説明には 7-90 日の文言がありますが、schema と作成フォームの実効バリデーションは 1-9999 日です。
