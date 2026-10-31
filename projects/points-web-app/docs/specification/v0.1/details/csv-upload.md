# CSVアップロードの仕様

- [CSVアップロードの仕様](#csvアップロードの仕様)
  - [既存仕様書との乖離・注意点](#既存仕様書との乖離注意点)
  - [旧仕様からの移行プラン](#旧仕様からの移行プラン)
  - [概要](#概要)
  - [用途](#用途)
  - [目的](#目的)
  - [実装場所](#実装場所)
  - [アクセス権限](#アクセス権限)
  - [権限チェックロジック](#権限チェックロジック)
  - [アップロードタイプ](#アップロードタイプ)
  - [`TASK_REPORT`](#task_report)
  - [`CONTRIBUTION_EVALUATION`](#contribution_evaluation)
  - [`FIXED_CONTRIBUTION`](#fixed_contribution)
  - [`TASK_STATUS`](#task_status)
  - [ユーザーインターフェース](#ユーザーインターフェース)
    - [モーダル構成](#モーダル構成)
  - [フォーマット情報表示](#フォーマット情報表示)
  - [ファイルアップロード](#ファイルアップロード)
  - [ドラッグ＆ドロップ](#ドラッグドロップ)
  - [CSVデータ処理](#csvデータ処理)
  - [進捗表示](#進捗表示)
  - [失敗CSV](#失敗csv)
  - [エラー処理](#エラー処理)
    - [バリデーションエラー](#バリデーションエラー)
    - [処理エラー](#処理エラー)
    - [エラー表示とリカバリー](#エラー表示とリカバリー)
  - [応答性とパフォーマンス](#応答性とパフォーマンス)
  - [セキュリティ](#セキュリティ)
  - [インタラクションフロー](#インタラクションフロー)
    - [モーダルオープン時](#モーダルオープン時)
    - [アップロードタイプ選択時](#アップロードタイプ選択時)
    - [ファイルアップロード時](#ファイルアップロード時)
    - [アップロード実行時](#アップロード実行時)
    - [エラー処理とリカバリー](#エラー処理とリカバリー)
    - [モーダルクローズ時](#モーダルクローズ時)
  - [技術仕様](#技術仕様)
    - [フロントエンド](#フロントエンド)
    - [バックエンド](#バックエンド)
  - [制限事項](#制限事項)
  - [回帰確認観点](#回帰確認観点)

## 既存仕様書との乖離・注意点

- 旧仕様では `TASK_REPORT` の必須列を `task,userName,date` としていました。
  - 現行実装では `task,contributionType`が必須列です。
- 旧仕様では `CONTRIBUTION_EVALUATION` の必須列に `evaluatorName` を含めていました。
  - 現行実装では評価者は CSV 列ではなくログインユーザーIDです。
- 旧仕様では `FIXED_CONTRIBUTION` の必須列を `taskId,contributionType` としていました。
  - 現行実装では `id,fixedContributionPoint,fixedEvaluatorId,fixedEvaluationLogic` です。
- 旧仕様では `TASK_STATUS` の許容値を `PENDING/IN_PROGRESS/COMPLETED/CANCELED` としていました。
  - 現行実装では Prisma `TaskStatus` の enum を使います。
- 旧仕様のモーダルタイトルは「CSVアップロード」、高さは最大80vhでした。
  - 現行仕様ではタイトルを「CSVファイルのアップロード」、高さを最大95vhとして扱います。
- 旧仕様のドラッグ中メッセージは「ここにファイルをドロップ」でした。
  - 現行実装では global overlay 上に「ファイルをドロップして追加」を表示します。
- 固定評価だけ hook 側で権限により無効化されます。
  - CSVアップロードボタン自体は現行の `GroupDetail` では owner のみ表示されます。
- BOM除去、ヘッダー正規化、1000行制限、複数ファイル合計10MB、WebWorker、キャンセル可能なバックグラウンド処理、リトライボタンは、読んだ現行実装では確認できません。
- 現行実装は複数ファイルを受け付けますが、同時ファイル数10件の制限や合計サイズ10MBの制限は確認できません。
- 旧仕様では toast の色、表示秒数、表示位置を定義していましたが、現行実装では toast library 側の挙動に依存します。

## 旧仕様からの移行プラン

旧 `csv-upload-modal.md` の内容は、次の方針で本ファイルへ移行します。

- 現行実装と一致する項目は、通常の仕様として本文に取り込みます。
- 現行実装と異なる項目は、削除せず、旧仕様由来の要件として残します。
- 現行実装で確認できない項目は、未確認または未実装の移行候補として残します。
- 旧仕様のコード上の関数名や enum 名が現行実装と異なる場合は、現行名を正とし、旧名は移行時の注意点として扱います。

旧仕様の主要項目と移行先:

| 旧仕様の項目                  | 移行先                             | 扱い                                                                   |
| ----------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| 概要、用途、目的              | 概要、用途、目的                   | 通常仕様として移行。貢献度タイプ更新は現行の固定評価更新との差分を補足 |
| アクセス権限                  | アクセス権限、権限チェックロジック | 旧仕様と現行実装の両方を記載                                           |
| 4種類のアップロードタイプ     | 各 upload type の詳細              | 現行必須列と旧仕様必須列を分けて記載                                   |
| UI構成、フォーマット表示      | ユーザーインターフェース           | 通常仕様として移行                                                     |
| ファイル検証、複数ファイル    | ファイルアップロード、制限事項     | 5MB制限は現行仕様、10ファイル/10MB/1000行は旧仕様由来の未確認要件      |
| ドラッグ＆ドロップ            | ドラッグ＆ドロップ                 | 通常仕様として移行                                                     |
| CSV処理、トランザクション     | CSVデータ処理、技術仕様            | 現行実装との差分を併記                                                 |
| 進捗、結果サマリー、失敗CSV   | 進捗表示、失敗CSV、エラー処理      | 現行確認済みと未確認の UI を分けて記載                                 |
| 応答性、WebWorker、キャンセル | 応答性とパフォーマンス             | WebWorker/キャンセル/状態維持は旧仕様由来の未確認要件                  |
| セキュリティ                  | セキュリティ                       | 通常仕様と未確認項目を分けて記載                                       |
| インタラクションフロー        | インタラクションフロー             | 通常仕様として移行                                                     |
| 技術仕様、制限事項            | 技術仕様、制限事項                 | 現行名に置き換え、旧名は差分として保持                                 |

旧仕様から移行するが、現行実装と違うため実装変更が必要な候補:

- `TASK_REPORT` で `userName` から対象ユーザーを解決し、`date` を実施日として扱う。
- `TASK_REPORT` で `task` の1〜1000文字制限、`info` の500文字制限、`reference` の URL 形式検証、未来日不可を強制する。
- `CONTRIBUTION_EVALUATION` で `evaluatorName` から評価者を解決し、既存評価を上書きする。
- `CONTRIBUTION_EVALUATION` で `evaluationLogic` の1〜500文字制限と評価日の過去/現在日制限を強制する。
- `FIXED_CONTRIBUTION` を旧仕様どおり「貢献度タイプの一括更新」として扱う。
- `TASK_STATUS` で旧仕様の `PENDING/IN_PROGRESS/COMPLETED/CANCELED` を使う。
- 同一 task id が複数行に出た場合に最後の行を採用する。
- 1000行/ファイル、最大10ファイル、複数ファイル合計10MBを強制する。
- WebWorker、処理中キャンセル、ブラウザ更新時の処理状態維持、明示的なリトライボタンを実装する。

## 概要

CSVアップロードモーダルは、CSVファイルを通じてタスクや貢献度評価などのデータを一括登録・一括更新するための機能です。複数のアップロードタイプを扱い、タスク登録、貢献評価、固定評価、タスクステータス更新を支援します。

## 用途

- タスク情報の一括登録
- 貢献度評価の一括実施
- 貢献度タイプの一括更新
- 固定評価とポイント付与の一括実施
- タスクステータスの一括更新
- 失敗行の CSV ダウンロードによる修正・再実行

## 目的

- 手動データ入力の削減
- 大量データの効率的な処理
- ユーザーワークフローの簡素化
- データ整合性の確保

## 実装場所

- `src/components/modal/csv-upload-modal.tsx`
- `src/hooks/modal/use-csv-upload.ts`
- `src/actions/task/bulk-create-task.ts`
- `src/actions/task/bulk-create-evaluation.ts`
- `src/actions/task/bulk-update-fix-evaluation.ts`
- `src/actions/task/bulk-update-task-status.ts`
- `src/components/group/group-detail.tsx`

## アクセス権限

旧仕様上の権限:

- **グループオーナー**
  - グループ関連の全ての CSV アップロード機能を利用可能
  - 自身が所有するグループのデータのみアクセス可能
  - グループ内のすべてのタスクとユーザーの操作が可能
- **アプリケーションオーナー**
  - 全ての機能を利用可能
  - システム全体のあらゆるグループのデータにアクセス可能
  - 制限なしですべての操作が許可される
- **一般ユーザー**
  - アクセス不可
  - モーダルへのアクセス自体が制限される
  - 権限不足時には適切なエラーメッセージを表示

現行実装上の権限:

- `GroupDetail` では owner の場合のみ CSVアップロードボタンを表示します。
- `useCsvUpload` は `checkIsPermission(userId, groupId, undefined, true)` で権限状態を取得します。
- `hasPermissionForUploadType` は `FIXED_CONTRIBUTION` のみ `isAuthorized` を要求し、それ以外の upload
  type は hook 上では許可します。
- `bulkUpdateFixedEvaluations` は server action 内で `checkIsPermission(userId, groupId, undefined, false)`
  を実行します。
- `bulkUpdateTaskStatus` は task ごとに `checkIsPermission(userId, task.group.id, taskId, true)` を実行します。
- `bulkCreateTask` と `bulkCreateEvaluations` は、読んだ範囲では owner/member 判定よりも
  `groupId`、`userId`、対象データの存在確認が中心です。

## 権限チェックロジック

旧仕様の権限チェックロジック:

1. セッションからユーザーIDを取得する。
2. アプリケーションオーナー権限を確認する。
   - `checkAppOwner(userId)` 相当の関数で確認する。
   - ユーザーの `isAppOwner` フラグを検証する。
3. グループオーナー権限を確認する。
   - `checkGroupOwner(userId, groupId)` 相当の関数で確認する。
   - グループメンバーシップテーブルで owner 相当の権限を検証する。
4. いずれかの権限が確認できた場合のみ機能を有効化する。

現行実装では `checkIsPermission` に集約されています。`isRoleCheck` の値により、app owner / group owner に加えて task
creator/reporter/executor を許可する経路があります。

## アップロードタイプ

| 種別                      | 必須列                                                                     | Server Action                | 概要                   |
| ------------------------- | -------------------------------------------------------------------------- | ---------------------------- | ---------------------- |
| `TASK_REPORT`             | `task`, `contributionType`                                                 | `bulkCreateTask`             | タスク一括作成         |
| `CONTRIBUTION_EVALUATION` | `taskId`, `contributionPoint`, `evaluationLogic`                           | `bulkCreateEvaluations`      | 分析評価を一括作成     |
| `FIXED_CONTRIBUTION`      | `id`, `fixedContributionPoint`, `fixedEvaluatorId`, `fixedEvaluationLogic` | `bulkUpdateFixedEvaluations` | 固定評価とポイント付与 |
| `TASK_STATUS`             | `taskId`, `status`                                                         | `bulkUpdateTaskStatus`       | タスク状態一括更新     |

## `TASK_REPORT`

タスクの内容や貢献タイプを一括で登録します。

現行必須フィールド:

- `task`: タスク内容
- `contributionType`: `REWARD` または `NON_REWARD`

現行オプションフィールド:

- `detail`: 詳細
- `reference`: 参考にした内容
- `info`: 証拠・結果・補足情報
- `category`: UIの説明には存在するが、現行 server action では受け取っていません
- `auctionStartTime`: オークション開始日時。`YYYY-MM-DD HH:MM` 形式想定
- `auctionEndTime`: オークション終了日時。`YYYY-MM-DD HH:MM` 形式想定
- `deliveryMethod`: 提供方法

旧仕様にあったフィールド:

- `userName`: 現行実装では使いません。creator/reporter/executor はログインユーザーです。
- `date`: 現行実装では使いません。

旧仕様から移行するが現行未確認または差分扱いの要件:

- `userName` はシステム内に存在するユーザー名である必要があります。
- `date` は `YYYY-MM-DD` 形式で、未来日は不可です。
- `task` は1〜1000文字以内です。
- `info` は最大500文字です。
- `reference` は指定時に有効な URL 形式である必要があります。
- `contributionType` 未指定時は `NON_REWARD` を既定値にする想定でした。
- 行ごとにユーザー名からユーザーIDを解決し、存在しないユーザー名はエラーとして記録する想定でした。
- 成功/失敗結果を集計し、失敗行を確認できる想定でした。

処理:

1. CSVを Papa Parse で読み取ります。
2. 必須列と必須セルを確認します。
3. `bulkCreateTask(data, groupId, userId)` を呼びます。
4. groupId/userId/data の存在を確認します。
5. group の存在を確認します。
6. 各行から `Task` を作成します。
7. creator を reporter/executor にします。
8. `contributionType === REWARD` の行は `Auction` も作成します。
   - `auctionStartTime` があれば開始日時に使います。
   - `auctionEndTime` があれば終了日時に使います。
   - 未指定時は開始を現在時刻、終了を1週間後にします。
   - `extensionLimitCount = 3`
   - `extensionTime = 10`
   - `remainingTimeForExtension = 10`

注意:

- CSV UI上の category 表示と異なり、サーバー側 action は category を受け取っていません。
- 権限チェックは group存在と userId 引数が中心で、server action 内での group owner/member 判定は確認できません。

## `CONTRIBUTION_EVALUATION`

タスクに対する貢献ポイントや評価ロジックを一括登録します。

現行必須フィールド:

- `taskId`: 評価対象のタスクID
- `contributionPoint`: 貢献ポイント。0以上の数値
- `evaluationLogic`: 評価ロジック

旧仕様にあったフィールド:

- `evaluatorName`: 現行実装では使いません。evaluator はログインユーザーIDです。
- `date`: 現行実装では使いません。

旧仕様から移行するが現行未確認または差分扱いの要件:

- `evaluatorName` はシステム内に存在するユーザー名である必要があります。
- `evaluationLogic` は1〜500文字以内です。
- `date` は `YYYY-MM-DD` 形式で、過去または現在日である必要があります。
- 旧仕様では既存評価がある場合は上書きし、新規評価の場合は作成する想定でした。
- 旧仕様では評価者を CSV の `evaluatorName` から解決する想定でした。
- 行ごとに task id の存在、評価者の存在、task と group の関連性を確認する想定でした。
- 成功/失敗結果を集計する想定でした。

処理:

1. CSVを Papa Parse で読み取ります。
2. 必須列と必須セルを確認します。
3. `bulkCreateEvaluations(rawData, groupId, userId)` を呼びます。
4. Zod schema で各行を検証します。
5. 対象 task が group 内に存在することを確認します。
6. `Analytics.createMany` で一括作成します。
7. `revalidatePath(/dashboard/group/${groupId})` を実行します。

バリデーション:

- `taskId` は必須です。
- `contributionPoint` は数値化でき、0以上である必要があります。
- `evaluationLogic` は必須です。
- task は該当 group 内に存在する必要があります。

注意:

- 既存評価の上書きではなく追加です。
- 1行でも Zod 検証に失敗すると、action は `success: false` と検証エラー message を返します。

## `FIXED_CONTRIBUTION`

タスクの固定評価を一括設定し、ポイント付与まで行います。

現行必須フィールド:

- `id`: Task id
- `fixedContributionPoint`: 固定貢献ポイント
- `fixedEvaluatorId`: 固定評価者ID
- `fixedEvaluationLogic`: 固定評価ロジック

現行オプションフィールド:

- `fixedEvaluationDate`: 評価日。未指定または不正な場合は現在日時

旧仕様にあったフィールド:

- `taskId`: 現行実装では `id` を Task id として扱います。
- `contributionType`: 現行実装の固定評価では使いません。

旧仕様から移行するが現行未確認または差分扱いの要件:

- 旧仕様の `FIXED_CONTRIBUTION` は、固定貢献ポイントではなくタスクの `contributionType` を一括更新する用途でした。
- `contributionType` は `REWARD` または `NON_REWARD` のみを許可する想定でした。
- 同一 task id が複数行に存在した場合、最後の行の値を適用する想定でした。
- Prisma transaction で対象タスクの貢献度タイプを一括更新し、成功/失敗結果を集計する想定でした。

処理:

1. CSVを Papa Parse で読み取ります。
2. 必須列と必須セルを確認します。
3. `bulkUpdateFixedEvaluations(data, groupId, userId)` を呼びます。
4. server action 内で権限を確認します。
5. 行ごとに必須値、数値、task 存在、status を確認します。
6. 対象 task の status が `TASK_COMPLETED` の場合のみ更新します。
7. `Task.fixed*` を更新します。
8. task status を `POINTS_AWARDED` にします。
9. 登録済み reporter/executor に対して `GroupPoint.balance` と `fixedTotalPoints` を加算します。
10. 行単位の失敗は `failedData` に集約します。
11. `revalidatePath(/dashboard/group/${groupId})` を実行します。

戻り値:

- `successData`
- `failedData`

注意:

- action 全体は、失敗行があっても `success: true` を返す実装です。
- hook 側では `failedData` があれば `登録失敗データ_YYYY-MM-DD.csv` をダウンロードします。

## `TASK_STATUS`

タスクのステータスを一括更新します。

現行必須フィールド:

- `taskId`: タスクID
- `status`: Prisma `TaskStatus`

現行 UI の説明に含まれる代表値:

- `PENDING`
- `POINTS_DEPOSITED`
- `TASK_COMPLETED`
- `FIXED_EVALUATED`
- `POINTS_AWARDED`
- `ARCHIVED`

旧仕様にあったステータス:

- `IN_PROGRESS`
- `COMPLETED`
- `CANCELED`

上記は現行の説明値とは一致しません。現行実装では `Object.values(TaskStatus).includes(status)` で検証します。

旧仕様から移行するが現行未確認または差分扱いの要件:

- 旧仕様では `PENDING/IN_PROGRESS/COMPLETED/CANCELED` のみを許可する想定でした。
- 旧仕様では任意のステータスから任意のステータスへの変更を許可する想定でした。
- 旧仕様では同一 task id が複数行に存在した場合、最後の行の値を適用する想定でした。
- 旧仕様では Prisma transaction でタスクステータスを一括更新し、成功/失敗結果を集計する想定でした。
- 現行実装では `FIXED_EVALUATED` または `POINTS_AWARDED` の task は変更不可です。

処理:

1. CSVを Papa Parse で読み取ります。
2. 必須列と必須セルを確認します。
3. `bulkUpdateTaskStatus(data, userId)` を呼びます。
4. userId がない場合は `/auth/login` へ redirect します。
5. 行ごとに taskId、status、task 存在、権限を確認します。
6. `FIXED_EVALUATED` または `POINTS_AWARDED` の task は変更不可です。
7. 更新可能な task は指定 status に更新します。
8. 行単位の失敗は `failedData` に集約します。

戻り値:

- `updatedCount`
- `failedCount`
- `failedData`

1件でも失敗がある場合、action 全体の `success` は false になります。

## ユーザーインターフェース

### モーダル構成

ヘッダー:

- タイトル: 「CSVファイルのアップロード」
- 旧仕様上のタイトル: 「CSVアップロード」
- 閉じるボタン: 右上の X アイコン
- 幅: 最大800px
- 高さ: 最大95vh
- 旧仕様上の高さ: 最大80vh

アップロードタイプ選択:

- 各 upload type をラジオボタン相当のカードで表示します。
- 選択状態を枠色で表示します。
- 権限がない upload type は無効表示にします。
- type ごとの説明文とアイコンを表示します。

ファイルアップロードエリア:

- ドラッグ＆ドロップゾーン
- ファイル選択。旧仕様上のボタン文言は「ファイルを選択」
- フォーマット情報
- サンプルCSVデータのテーブル

アップロードされたファイルリスト:

- ファイル名
- サイズ表示
- 削除ボタン
- 全削除ボタン
- 多数ファイル時のスクロール

アクションボタン:

- キャンセル
- アップロード
- アップロード中は無効化
- ファイル未選択時は無効化
- 権限がない upload type は無効化

## フォーマット情報表示

各 upload type ごとに以下を表示します。

- 必須フィールドの一覧と説明
- オプションフィールドの一覧と説明
- 必須項目のアスタリスク表示
- サンプルCSVデータのテーブル
- カラム説明
- 注意事項
- 旧仕様では、サンプルCSVのヘッダー行を太字、サンプルデータ行を1行表示、列が多い場合は横スクロール可能とする想定でした。
- 旧仕様では、カラム説明にはツールチップを表示する想定でした。
- 旧仕様では、注意事項を警告アイコン付きの枠内に表示し、特に注意すべき制約や条件を強調する想定でした。

現行実装では `UPLOAD_TYPE_INFO` の `requiredFields` / `optionalFields` / `note` / `example`
を使い、React 要素を組み立てます。

## ファイルアップロード

対応ファイル:

- CSV形式のみ
- MIME Type: `text/csv`
- 拡張子: `.csv`
- 文字コード: UTF-8

ファイルサイズ:

- 単一ファイル最大5MB
- 超過時は toast でエラー表示
- upload 前に検証

現行実装で確認できる検証:

- dropzone の `accept`
- dropzone の `maxSize`
- global drop 時の拡張子/MIME type 確認
- 必須列が存在すること
- 必須セルが空でないこと
- Papa Parse の `header: true`
- Papa Parse の `skipEmptyLines: true`

旧仕様にあったが現行未確認の検証:

- 必須フィールド名の大文字小文字を無視した比較
- スペースや特殊文字を除去したヘッダー比較
- BOM 除去
- 1ファイル1000行上限
- 複数ファイル最大10件
- 複数ファイル合計10MB

現行実装上の注意:

- 必須列チェックは基本的に列名の完全一致です。
- 旧仕様のような大文字小文字の吸収、スペース除去、BOM除去を前提にした CSV は取り込めない可能性があります。

## ドラッグ＆ドロップ

画面全体オーバーレイ:

- ファイルがブラウザウィンドウ上にドラッグされると半透明のオーバーレイを表示します。
- 「ファイルをドロップして追加」を表示します。
- ドロップ可能領域を視覚的に強調します。

モーダル内ドロップゾーン:

- 点線の枠で囲まれたエリア
- アイコンと説明テキスト
- ドラッグオーバー時の枠色、背景色、スケール変更
- 旧仕様では「ここにファイルをドロップ」というメッセージを中央に表示する想定でした。
- 現行実装では global overlay 上に「ファイルをドロップして追加」を表示します。

ドラッグ操作イベント:

- `dragenter`: オーバーレイ表示
- `dragover`: デフォルト動作の防止
- `dragleave`: オーバーレイ非表示
- `drop`: ファイル取得、CSV抽出、検証

## CSVデータ処理

CSVパース:

- Papa Parse を使用します。
- `header: true`
- `skipEmptyLines: true`
- `complete` callback で行データを受け取ります。
- `error` callback で parse error を扱います。

ヘッダー検証:

- upload type ごとの必須列を確認します。
- 現行実装では、行オブジェクトに列 key が存在するかと、値が空でないかを確認します。
- ヘッダー正規化や BOM 除去は現行未確認です。

データ型変換:

- `contributionPoint` は `Number(...)` で数値化します。
- `fixedContributionPoint` は server action で `parseInt(...)` します。
- `status` は文字列を `TaskStatus` として扱い、server action で enum に含まれるか検証します。
- 日付文字列は必要な箇所で `new Date(...)` に変換します。
- 文字列 trim は現行実装の全項目では確認できません。

トランザクション:

- `bulkCreateTask` は `prisma.$transaction` を使います。
- `bulkCreateEvaluations` は `prisma.$transaction` と `createMany` を使います。
- `bulkUpdateFixedEvaluations` は `prisma.$transaction` 内で行単位処理を行います。
- `bulkUpdateTaskStatus` は行単位処理で、読んだ範囲では全体 transaction ではありません。

行単位エラー:

- 固定評価とステータス更新は行単位の失敗を `failedData` に保持します。
- タスク作成と貢献評価は、検証または処理エラーで全体を中断しやすい構造です。

## 進捗表示

現行実装:

- ファイル単位の処理進捗を `uploadProgress` として表示します。
- `processedFiles / totalFiles * 100` で進捗率を更新します。
- アップロード中は Progress bar とパーセンテージを表示します。
- アップロード中はアップロードボタンとキャンセル操作を制限します。

旧仕様にあったが現行未確認の表示:

- 検証中、アップロード中、処理中などの処理段階表示
- 成功件数/失敗件数のモーダル内サマリー
- 処理時間の表示
- 処理完了後に「閉じる」ボタンへ変更
- アップロード中の明示的なキャンセルボタン

## 失敗CSV

固定評価とステータス更新では、失敗行を CSV としてダウンロードする UI 経路があります。

ファイル名:

- `登録失敗データ_YYYY-MM-DD.csv`

内容:

- server action が返した `failedData`
- 元データに `error` を含めた行データ

旧仕様では追加カラムとして `error_message`、`error_type` を想定していました。現行実装では `failedData`
の shape に従って Papa Parse で CSV 化します。

旧仕様から移行するが現行未確認または差分扱いの要件:

- 失敗データをダウンロードする明示ボタンを表示する。
- 元 CSV データに `error_message` と `error_type` を追加した固定フォーマットで出力する。
- 失敗データだけをフィルタリングして再アップロードできるようにする。
- 部分成功時のステータスをモーダル内に表示する。
- トースト通知は成功時5秒、警告時8秒、エラー時はユーザーが閉じるまで、位置は画面右上とする。

## エラー処理

### バリデーションエラー

ファイルサイズエラー:

- メッセージ例: `ファイル名のサイズが大きすぎます（上限: 5MB）`
- upload 前に検証します。
- エラー時はファイルリストに追加しません。

ファイル形式エラー:

- CSV以外は無効なファイル形式として toast で表示します。
- global drop では CSV 以外を無視し、warning を出します。

必須フィールド欠落/空セル:

- `「ファイル名」の「N行目」で以下の項目が未入力です: ...`
- 検証エラーがある場合は処理を中断します。

データ型エラー:

- server action 側で数値、日付、enum などを検証します。
- エラーは action の `message`、例外、または `failedData` に入ります。

参照整合性エラー:

- task、group、user、権限などの存在確認で発生します。
- 固定評価やステータス更新では行単位で `failedData` に入ります。

### 処理エラー

権限エラー:

- 固定評価 upload type では権限がない場合 UI 上で無効化します。
- server action 側でも権限エラーを返す処理があります。

通信/サーバー処理エラー:

- catch で toast にエラーメッセージを表示します。
- 不明なエラーの場合は「不明なエラーが発生しました」などを表示します。

トランザクションエラー:

- action 側で例外または `success: false` として扱います。
- transaction 内で例外が発生した場合はロールバックされます。

### エラー表示とリカバリー

- 成功: toast success
- 警告: toast warning/info
- エラー: toast error
- 失敗データがある場合は CSV を自動ダウンロードします。
- 同じファイルでの明示的なリトライボタンや、失敗行だけの再アップロード支援は現行未確認です。
- `TASK_STATUS` は `failedData` をダウンロードしても、action 全体の `success` が false になり得ます。
  - 固定評価の部分失敗時 UX と完全には同じではありません。

## 応答性とパフォーマンス

UI状態管理:

- アップロード中はアップロードボタンを無効化します。
- アップロード中は progress bar を表示します。
- キャンセルは upload 中には実行しません。
- モーダルを閉じるとファイルと progress をリセットします。

大量データ処理:

- 旧仕様では100行単位のバッチ処理、各バッチ完了時の UI 更新、メモリ効率化が要求されていました。
- 現行実装では、ファイル単位で parse し、upload type に応じた action にまとめて渡します。

バックグラウンド処理:

- WebWorker の活用、途中キャンセル、ブラウザ更新時の状態維持は現行未確認です。

## セキュリティ

権限チェック:

- クライアント側の表示制御だけでなく、重要な更新は server action 側でも検証します。
- 固定評価とステータス更新は server action 側の権限確認があります。
- タスク作成と貢献評価は、読んだ範囲では group/user/対象データの検証が中心です。

入力データ検証:

- CSVデータは upload type ごとの必須列・必須値を検証します。
- Prisma の API を通して DB 操作を行います。
- 文字列長制限、特殊文字除去、HTML escape は現行実装範囲では網羅確認していません。

アップロードファイル検証:

- MIME Type と拡張子を確認します。
- 単一ファイル5MB上限を強制します。
- CSVフォーマットは Papa Parse の parse 成否に依存します。

XSS対策:

- 旧仕様では HTML 特殊文字の escape、CSP、HTTP セキュリティヘッダーが要求されていました。
- CSVアップロード固有実装での網羅対応はこの文書では未確認です。

## インタラクションフロー

### モーダルオープン時

1. `CsvUploadModal` が表示されます。
2. `useCsvUpload` が初期化されます。
3. セッションからユーザー情報を取得します。
4. `checkIsPermission` で権限を確認します。
5. 権限に基づいて upload type の有効/無効を決めます。
6. dropzone を初期化します。
7. global drag event listener を設定します。

### アップロードタイプ選択時

1. upload type のカードをクリックします。
2. 選択 type を state に保存します。
3. フォーマット情報を更新します。
4. 必須/任意フィールド、サンプル、注意事項を表示します。

### ファイルアップロード時

ドラッグ＆ドロップ:

1. ファイルをドラッグすると global overlay を表示します。
2. dropzone に drag over すると視覚的にハイライトします。
3. drop 時に file list を取得します。
4. CSV以外を除外します。
5. 5MBを超えるファイルを除外します。
6. 検証通過したファイルをリストへ追加します。

ファイル選択:

1. dropzone クリックまたはファイル選択操作を行います。
2. ファイル選択ダイアログから CSV を選択します。
3. dropzone の `onDrop` で検証し、ファイルリストへ追加します。

### アップロード実行時

1. アップロードボタンをクリックします。
2. ファイル未選択ならエラーにします。
3. upload type の権限がなければエラーにします。
4. `isUploading = true`、`uploadProgress = 0` にします。
5. 各ファイルを Papa Parse で読み込みます。
6. 必須列と必須セルを検証します。
7. 検証エラーがあれば処理を中断します。
8. upload type に応じてデータを変換します。
9. 対応する Server Action を呼びます。
10. 失敗データがあれば CSV としてダウンロードします。
11. 全ファイル成功時は toast success、modal close、router refresh を行います。
12. finally で `isUploading = false` にします。

### エラー処理とリカバリー

1. ファイルレベルエラーは toast で表示し、そのファイルを処理しません。
2. 必須列/必須セルエラーは検証エラーとして処理を中断します。
3. 行単位エラーは `failedData` に入る場合があります。
4. 失敗データがある場合は CSV を生成してダウンロードします。
5. ユーザーはダウンロードした失敗CSVを修正して再アップロードできます。

### モーダルクローズ時

1. キャンセルまたは閉じるボタンを押します。
2. upload 中でなければ modal を閉じます。
3. ファイルリストと progress をリセットします。
4. global event listener を解除します。

## 技術仕様

### フロントエンド

React Dropzone:

- `accept: { "text/csv": [".csv"] }`
- `maxSize: 5MB`
- 複数ファイルを受け付ける
- `onDrop`
- `onDropRejected`
- `getRootProps`
- `getInputProps`
- `isDragActive`
- 旧仕様では `open` も提供メソッドとして扱っていました。
- 現行実装では `noKeyboard: true`、`preventDropOnDocument: false` を指定します。

Papa Parse:

- `header: true`
- `skipEmptyLines: true`
- `complete`
- `error`
- `unparse` による失敗CSV生成

React hooks:

- `useState`
  - `uploadType`
  - `isUploading`
  - `uploadProgress`
  - `currentFiles`
  - `isFileOver`
  - `isAuthorized`
- `useEffect`
  - 権限チェック
  - global drag event listener 設定/解除
  - modal close 時の状態 reset
- `useCallback`
  - drop handler
  - remove handler
  - upload handler
  - データ変換
- `useMemo`
  - userId
  - fileCards

カスタムフック:

- `useCsvUpload`
  - 入力: `groupId`, `isOpen`, `onCloseAction`
  - 出力: 状態、dropzone props、各 handler、format info renderer、権限判定

### バックエンド

Server Actions:

- `bulkCreateTask`
- `bulkCreateEvaluations`
- `bulkUpdateFixedEvaluations`
- `bulkUpdateTaskStatus`

旧仕様に記載されていた旧名称:

- `bulkCreateTasks`
- `bulkUpdateTaskStatuses`
- `bulkCreateTaskContributions`

上記は現行実装名と一致しません。ドキュメント上は現行実装名を正とします。

Prisma:

- `prisma.$transaction`
- `createMany`
- task/group/user/GroupPoint の参照整合性チェック
- relation を含む task 作成
- `GroupPoint.upsert`

データ検証:

- フロントエンド: ファイル形式、サイズ、必須列、必須セル
- バックエンド: ユーザー存在、タスク存在、グループ関連性、権限、status、数値、対象 status

## 制限事項

現行実装で確認できる制限:

- CSVのみ対応
- 単一ファイル最大5MB
- `FIXED_CONTRIBUTION` は権限がないと選択不可
- `FIXED_CONTRIBUTION` は `TASK_COMPLETED` の task のみ更新可能
- `TASK_STATUS` は `FIXED_EVALUATED` / `POINTS_AWARDED` の task を変更不可

旧仕様にあったが現行未確認の制限:

- 複数ファイル合計10MB
- 最大1000行/ファイル
- 最大10ファイル
- 100行単位のバッチ処理
- IE11非対応などのブラウザ互換性明記
- 全て成功するか全て失敗という upload type 共通の transaction 単位
- 失敗行のみを再処理できるエラーリカバリー
- CSV 以外の XLSX、TSV、その他表形式の非サポート明記

旧仕様上のブラウザ互換性:

- サポート対象: 最新の Chrome、Firefox、Safari、Edge
- 非サポート: IE11 およびレガシーブラウザ

旧仕様上の非対応ファイル形式:

- XLSX
- TSV
- その他の表形式
- 非対応理由は、処理の一貫性とセキュリティリスクの軽減です。

## 回帰確認観点

- owner の場合に CSVアップロードボタンが表示されること。
- owner 以外の member には CSVアップロードボタンが表示されないこと。
- `TASK_REPORT` / `CONTRIBUTION_EVALUATION` / `FIXED_CONTRIBUTION` / `TASK_STATUS` を選択できること。
- 権限がない場合に `FIXED_CONTRIBUTION` が無効化されること。
- `.csv` 以外や5MB超過ファイルが拒否されること。
- 必須列または必須セルが欠ける場合に処理が中断されること。
- 複数ファイルを順次処理し、progress が更新されること。
- `TASK_REPORT` で task と auction が期待どおり作成されること。
- `CONTRIBUTION_EVALUATION` で Analytics が作成されること。
- `FIXED_CONTRIBUTION` で fixed fields、status、GroupPoint が更新されること。
- `TASK_STATUS` で更新可能な task の status が変わり、変更不可 status は failedData に入ること。
- 固定評価とステータス更新の失敗データが CSV として出力されること。
- 成功時に modal が閉じ、router refresh が行われること。
