# GitHub Actionsの定期実行について

## 目次

- [概要](#概要)
- [各ステータスの仕様](#各ステータスの仕様)
  - [TaskStatus](#TaskStatus)
  - [AuctionStatus](#AuctionStatus)
  - [BidStatus](#BidStatus)
  - [NotificationSendTiming](#NotificationSendTiming)
  - [AuctionEventType](#AuctionEventType)
- [GitHub Actionsの仕様](#GitHub-Actionsの仕様)
  - [GitHub Actionsのキャッシュ](#GitHub-Actionsのキャッシュ)
  - [GitHub Actionsの今後のタスク](#GitHub-Actionsの今後のタスク)
  - [GitHub Actions定期実行するタスクの種類](#GitHub-Actions定期実行するタスクの種類)
  - [GitHub Actionsの無料枠](#GitHub-Actionsの無料枠)

## 概要

1. GitHub Actionsの定期実行を行う際の仕様の整理
1. Auction関連の各ステータスになる条件を整理

## 各ステータスの仕様

### TaskStatus

- PENDING
  - 使用
    - タスク実施予定
  - トリガー
    - Taskテーブルのレコードを作成した際に自動で入る
  - 詳細
    - タスクを新規作成した時のステータス
- POINTS_DEPOSITED
  - 使用
    - ポイント預け済み
  - トリガー
    - オークションの完了処理の際に、落札者の入札額を差し引いた際に、「POINTS_DEPOSITED」になる
  - 専用
    - 報酬あり専用
- TASK_COMPLETED
  - 使用
    - タスクの実行が完了した場合に使用
  - トリガー
    - 手動で変更(CSVアップロード or タスクのテーブルのComboBoxで変更)
  - 詳細
    - 貢献度の評価を行うためには、「TASK_COMPLETED」にする必要がある
- FIXED_EVALUATED
  - 使用
    - 貢献度の評価が行われ、貢献度がFIXしたときに使用
  - トリガー
    - ポイント額が「Task」テーブルの「fixedContributionPoint」カラムに値を入れるときに変更
- POINTS_AWARDED
  - 使用
    - ポイントの付与が完了したときに使用
  - トリガー
    - ポイント額が「Task」テーブルの「fixedContributionPoint」カラムに値を入れるときに変更
  - 補足
    - 今後は、給料日みたいに評価確定とは別日に、決まった日にポイント付与する場合は、「POINTS_AWARDED」と異なるトリガーになる
- ARCHIVED
  - 使用
    - タスクをアーカイブしたときに使用
  - 補足
    - これは現在はアーカイブにする機能がないので使用しない

### AuctionStatus

- PENDING
  - 使用
    - タスク実施予定
  - トリガー
    - Taskテーブルのレコードを作成した際に自動で入る
  - 詳細
    - タスクを新規作成した時のステータス
- ACTIVE
  - 使用
    - オークション進行中
  - トリガー
    - AuctionのstartTimeが今日以前をGitHub Actionsでステータス変更する際に実行
- ENDED
  - 使用
    - オークション終了
  - トリガー
    - AuctionテーブルのendTimeが今日以前の場合
- CANCELED
  - 使用
    - オークションキャンセルして実施しない場合に使用
  - トリガー
    - タスクを削除した場合

### BidStatus

- BIDDING
  - 使用
    - 入札中
  - トリガー
    - `BitHistory`のレコードが作成された際に自動で入る
- WON
  - 使用
    - 落札済み
  - トリガー
    - オークションの完了処理が完了したとき
- LOST
  - 使用
    - 落札失敗
  - トリガー
    - オークションの完了処理が完了したとき
- INSUFFICIENT
  - 使用
    - 残高不足
  - トリガー
    - オークションの完了処理の際に、保有ポイントが落札ポイントより低い場合に自動で入る

### NotificationSendTiming

- NOW
  - 使用
    - 即時送信
  - トリガー
    - 通知作成時
- SCHEDULED
  - 使用
    - 予定時間送信
  - トリガー
    - 通知作成時
  - 詳細
    - GitHub Actionsで、通知の送信の実行を行った際に使用

### AuctionEventType

- ITEM_SOLD
  - 使用
    - 商品が落札された
  - トリガー
    - オークションの完了処理が完了したとき
- NO_WINNER
  - 使用
    - 落札者がいなかった
  - トリガー
- ENDED
  - 使用
    - オークションが終了した
  - トリガー
- OUTBID
  - 使用
    - 自分の入札が他者に上回られた
  - トリガー
- QUESTION_RECEIVED
  - 使用
    - 質問を受け取った
  - トリガー
- AUTO_BID_LIMIT_REACHED
  - 使用
    - 設定した最大入札額に達した
  - トリガー
- AUCTION_WIN
  - 使用
    - オークション落札
  - トリガー
- AUCTION_LOST
  - 使用
    - オークション落札失敗
  - トリガー
- POINT_RETURNED
  - 使用
    - ポイント返還
  - トリガー
- AUCTION_CANCELED
  - 使用
    - オークションキャンセル
  - トリガー

## GitHub Actionsの仕様

### 実装の注意点

---

- schedule:を使用した定期実行の実装
- workflow_dispatch:トリガーも加えて手動実行できるようにする
- GitHub Actionsのキャッシュを使用する
  ```yaml
  - name: キャッシュの復元
    uses: actions/cache@v3
    with:
    path: |
      ~/.pnpm-store
      node_modules
      .next/cache
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-
  ```
- 実行するOSは、Ubuntu (Linux)
- typescriptを使用する設定を行う
  - **基本的には全依存ファイルのトランスパイルが必要です**
  - 実行するTypeScriptファイルと、それがインポートするすべてのファイル
  - Next.jsのサーバーアクションも含めて対象になります
  - プロジェクト全体をトランスパイルするコード `tsc --project tsconfig.json`
  - 使用するファイルのみをPATHで指定した専用のtsconfig.jsonを作成して、それをトランスパイルする方法でも良い。その方が速度が速い
    `tsc --project tsconfig.cron.json`
    `yaml     {       "extends": "./tsconfig.json",       "include": ["scripts/**/*.ts"],       "exclude": ["node_modules", "**/*.test.ts"],       "compilerOptions": {         "outDir": "dist/scripts"       }     }     `
- Next.js専用の設定
- パッケージのinstallは、`pnpm install --frozen-lockfile`を使用する

### 定期実行GitHub Actionsの今後のタスク

---

1. request-auction.mdを見て、必要な処理を、このファイルにまとめる
1. テストとして、GitHub Actionsで、5分ごとにmessageをコンソールする実行するyamlコードを書いて、手動実行できるようにもする
1. 自動入札の修正
   - 実行間隔を環境変数で管理(定数ファイルで管理しない理由は、github actionのscheduleで数字を使用したいため)
   - 30分ごとの実行
   - setInterval()ではなく、GitHub Actionsの定期実行に切り替える
1. オークションの通知の定期実行
1. オークションの完了処理の定期実行
1. ポイントの返還処理の実装
1. オークションの開始処理
1. テスト

### GitHub Actions定期実行するタスクの種類

---

1. 自動入札を実行する
   - 1時間ごとの実行
     - 費用的に、一旦は間隔を長めにする
1. オークションの完了処理
1. ポイント返還の処理
1. 通知の送信
   1. オークション関連の通知は、GitHub Actionsのオークション関連の実装時に行うで実装する
   1. `NotificationSendTiming`が`SCHEDULED`の予約送信する通知の送信

### オークションの開始処理

---

1. 「Auction」テーブルの「startTime」カラムが今日以前で、「status」カラムが「CANCEL」以外の場合は、「ACTIVE」にする

### オークションの完了処理

---

- 実行するオークションの条件 - `Auction`テーブルの`endTime`カラムが今日以前の場合

- 以下の処理を行う

  1. 落札者の入札額を差し引く

     - 処理前に落札者の保有ポイント額が、落札商品の入札額が2番目に多いユーザーに1ポイント加算した額より、小さい場合は、`BidHistory`テーブルの`status`カラムを`INSUFFICIENT`にして、2番目に多い人を繰り上げ当選させる
       - その2番目の入札額のユーザーのポイントを差し引く額は、3番目の入札額に1ポイント加算した額

  1. `Auction`テーブル/`Task`テーブル/`BidHistory`テーブルのステータス変更
     - 変更カラム
       - `Auction`テーブルの`status`カラムを`ENDED`に変更
       - `Task`テーブルの`status`カラムを`POINTS_DEPOSITED`に変更
       - `BidHistory`テーブルの落札者の最高額の入札レコードの`status`カラムを`WON`に変更
       - `BidHistory`テーブルの`WON`と`INSUFFICIENT`以外のレコードは`LOST`にする

### ポイント返還する処理

---

- 落札した日からカウントして、Groupごとに指定している「ポイントを預ける期間」（`Group`テーブルの`depositPeriod`カラム）が経過したら、落札したポイント額を返還する。
  - 入札した金額分だけ、`balance`カラムに足し算する
  - Groupが削除された場合にも、ポイントの返還はあるようにしたい
    - 何故なら、今後、異なるGroupのポイントの互換性を持たせる可能性があるため。互換性については、一旦は考えなくて良い
  - ポイント返還処理を行うトリガーは、GitHub Actionsの定期実行するワークフローで、毎日の日本時間の深夜0時に実行する

### 自動入札する処理

---

- 同じオークション商品に、複数ユーザーが自動入札を設定している場合は、同時に複数の入札が発生することになる
  - その場合の実装は、
    1. 同じauctionIdの自動入札設定をfindMany()で一括取得する
       - 検索条件は、currentHighestBidがAutoBidテーブルのmaxBidAmountカラム以下の場合の設定のみ
    2. AutoBidテーブルのカラム作成(createdAt)が一番最初の人のみ自動入札の更新を行う

### GitHub Actionsの無料枠

---

- GitHub Actionsの無料枠には以下の制限があります
  - パブリックリポジトリ：無制限の実行分数（回数・時間に制限なし）
  - プライベートリポジトリ：月あたり2,000分の無料実行時間
  - ストレージとアーティファクト：500MBのストレージと1GBのアーティファクト転送
- 自動入札機能を30分ごとの実行にしても、GitHub Actionsの無料枠に十分収まる可能性が高いです。
  - 30分ごとの実行の場合の使用量計算
    - 1日あたり：48回の実行（24時間÷0.5時間）
    - 1ヶ月（30日）あたり：1,440回の実行（48回×30日）
    - 1回の実行は通常数秒から数十秒で完了
    - 平均して1回の実行が30秒かかると仮定した場合：1ヶ月の総実行時間：30秒×1,440回=43,200秒=720分
    - プライベートリポジトリの無料枠2,000分の約36%に相当
