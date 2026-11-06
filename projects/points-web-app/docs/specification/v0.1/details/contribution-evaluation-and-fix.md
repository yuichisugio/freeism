# 貢献評価・固定評価・ポイント付与仕様

## 既存仕様書との乖離・注意点

既存CSV仕様では `ContributionEvaluation` や `FixedContribution`
のような専用概念が登場しますが、現行DBでは未固定の分析評価を `Analytics`、確定評価を
`Task.fixed*`、ユーザーの累計/残高を `GroupPoint` で扱います。

## 実装場所

- `src/actions/task/bulk-create-evaluation.ts`
- `src/actions/task/bulk-update-fix-evaluation.ts`
- `src/actions/task/cache-export-group-analytics.ts`
- `prisma/schema.prisma`

## 未固定の貢献評価

`CONTRIBUTION_EVALUATION` CSV により `Analytics` を作成します。

入力:

- `taskId`
- `contributionPoint`
- `evaluationLogic`

処理:

- 全行を Zod で検証します。
- 対象 task が指定 group に存在することを確認します。
- `Analytics.createMany` で評価を追加します。
- evaluator はログインユーザーです。

制約:

- 日付列は扱いません。
- evaluatorName は扱いません。
- 既存 `Analytics` の上書きではありません。

## 固定評価

`FIXED_CONTRIBUTION` CSV により `Task.fixed*` を更新します。

入力:

- `id`: Task id
- `fixedContributionPoint`
- `fixedEvaluatorId`
- `fixedEvaluationLogic`
- `fixedEvaluationDate?`

条件:

- group owner 相当の権限が必要です。
- 対象 task は `TASK_COMPLETED` である必要があります。

処理:

1. 行単位で task を確認します。
2. `fixedContributionPoint` と評価者/評価ロジック/評価日を保存します。
3. `Task.status` を `POINTS_AWARDED` にします。
4. reporter/executor の登録ユーザーへ `GroupPoint` を upsert します。
5. `balance` と `fixedTotalPoints` を加算します。

## ポイント付与対象

固定評価でポイント加算されるのは、対象 task に紐づく登録済み user の reporter/executor です。名前だけの非登録 reporter/executor は
`GroupPoint` 付与対象にはなりません。

## `GroupPoint`

- `balance`: オークション入札や落札depositに使う残高
- `fixedTotalPoints`: 固定評価で付与された累計ポイント

固定評価時は両方が増えます。オークション終了処理では、落札者の `balance` が減算されます。

## エラー処理

固定評価は行単位で失敗を集約します。部分失敗があっても、action全体は `success: true` のまま `failedData`
を返す経路があります。

## 注意点

- `FIXED_EVALUATED` enum は存在しますが、現行の固定評価CSVは `POINTS_AWARDED` に更新します。
- `POINTS_AWARDED` 済みタスクは CSVステータス更新で変更不可です。
