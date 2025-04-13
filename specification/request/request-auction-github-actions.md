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
  - タスク実施予定
- BIDDED
  - 落札済み。報酬あり専用
- POINTS_DEPOSITED
  - ポイント預け済み。報酬あり専用
- TASK_COMPLETED
  - タスク完了。報酬の有無関係なしで、タスクが完了した場合に使用
- FIXED_EVALUATED
  - ポイント額がFIXED_CONTRIBUTION_POINTによって評価されたときに使用
- POINTS_AWARDED
  - ポイントの付与が完了したときに使用
- ARCHIVED
  - タスクをアーカイブしたときに使用

### AuctionStatus

- PENDING
  - オークション開始前
- ACTIVE
  - オークション進行中
- ENDED
  - オークション終了
  - AuctionテーブルのendTimeが今日以前の場合
- CANCELED
  - オークションキャンセル

### BidStatus

- BIDDING - 入札中 -WON - 落札済み
- LOST
  - 落札失敗
- INSUFFICIENT
  - 残高不足

### NotificationSendTiming

- NOW
  - 即時送信
- SCHEDULED
  - 予定時間送信

### AuctionEventType

- ITEM_SOLD
  - 商品が落札された
- NO_WINNER
  - 落札者がいなかった
- ENDED
  - オークションが終了した
- OUTBID
  - 自分の入札が他者に上回られた
- QUESTION_RECEIVED
  - 質問を受け取った
- AUTO_BID_LIMIT_REACHED
  - 設定した最大入札額に達した
- AUCTION_WIN
  - オークション落札
- AUCTION_LOST
  - オークション落札失敗
- POINT_RETURNED
  - ポイント返還
- AUCTION_CANCELED
  - オークションキャンセル

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

   ```typescript
     enum AuctionEventType {
       ITEM_SOLD // 商品が落札された。GitHub ActionsでsendAuctionNotification()を呼び出す
       NO_WINNER // 落札者がいなかった。GitHub ActionsでsendAuctionNotification()を呼び出す
       ENDED // オークションが終了した。GitHub ActionsでsendAuctionNotification()を呼び出す
       AUCTION_WIN // オークション落札。GitHub ActionsでsendAuctionNotification()を呼び出す
       AUCTION_LOST // オークション落札失敗。GitHub ActionsでsendAuctionNotification()を呼び出す
       POINT_RETURNED // ポイント返還。GitHub ActionsでsendAuctionNotification()を呼び出す

       OUTBID // 済み。自分の入札が他者に上回られた。現在の最高額で、新規入札で超えられた人のみに対して送る
       QUESTION_RECEIVED // 済み。質問を受け取った。
       AUTO_BID_LIMIT_REACHED // 済み。設定した最大入札額に達した
       AUCTION_CANCELED // キャンセルはオークション開始前で参加者がいないため、通知は実装しない！ので、オークションキャンセル
     }
   ```

1. オークションの完了処理の定期実行
1. ポイントの返還処理の実装
1. テスト

### GitHub Actions定期実行するタスクの種類

---

1. 自動入札を実行する
   - 1時間ごとの実行
     - 費用的に、一旦は間隔を長めにする
2. オークションの完了処理
3. オークション関連の通知を飛ばす
4. ポイント返還の処理

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
