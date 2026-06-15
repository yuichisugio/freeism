# freeism-calc-contrib

- [freeism-calc-contrib](#freeism-calc-contrib)
  - [v0.1](#v0.1)
    - [プロトタイプの設計](#プロトタイプの設計)
    - [「OSS業界全体の発展」パッケージ（GitHub API）](#oss業界全体の発展パッケージgithub-api)
    - [「指定OSSの発展」パッケージ（GitHub API）](#指定ossの発展パッケージgithub-api)
    - [「幸福度の向上」パッケージ](#幸福度の向上パッケージ)
  - [v2](#v2)
    - [プロトタイプの設計](#プロトタイプの設計-1)

## v0.1

### プロトタイプの設計

- 説明
  - 指定コンテンツの作成に貢献した人を特定して、貢献度を算出するソフトウェアのプロトタイプを作る
    - または、「貢献検知の仕組み」で特定した貢献者の貢献度を算出するソフトウェア

- 設計
  1.  疎結合
      - 無料主義アプリに組み込まず、疎結合で実装する
      - すぐに別ツールに移行できるようにしたい
  2.  本質的な機能のみ実装
      - リッチな機能にしたいわけではない
      - シンプルで貢献度の算出方法の例としてすぐに伝わるようにしたい
      - いったんは、CLI で実装
  3.  無料主義アプリへ貢献度を一括登録できるフォーマットで出力する

- 貢献度の評価方法
  - 説明
    - このプロトタイプで実装する貢献度の算出方法としては、一人ずつ、1 つのタスクごとに「タスク」×「各評価軸ごとに重みづけの値の掛け算結果」を計算して、その合計を出して、その人の貢献度とする

- アウトプットで必要な内容
  - CSV ファイルで出力する
    - スプレッドシートにそのままコピー&ペーストして使えるし、人間が見てもわかりやすいし、システムでアップロード処理も簡単なため
  - 無料主義アプリにアップロードする用
    - メモ
      - ユーザーごとに並び替えたタスクごとの貢献度の数値一覧
      - 無料主義アプリに、タスクごとの貢献度と貢献度の分析が正しいかチェックするために算出ロジックを示す必要があるため、算出ロジックも記載する
    - 記載するデータ一覧
      1. データ取得元のサービス名
      2. データ取得元のユーザ ID
      3. タスク名
      4. データ取得元のタスク ID
         - 同じタスクを重複登録しないようにするため
      5. 貢献度の数値
      6. 貢献度の算出ロジック（各重み付けの値や掛け算などの算出ロジックを記載）
      7. 各重み付けの値
      8. メモ
      9. 算出した日（今日）
  - 貢献度の確認のみの CSV
    - ユーザーごとの貢献度の数値一覧

- CSV をスプレッドシートに変換する方法
  - 方法
    - CSV をスプシに、Shift + Command + V で、書式なしコピー&ペーストして、ドロップダウン「テキストを列に分割」を選択
  - ポイント
    - 改行されない場合は、行末の改行コードが間違っているので、一度エディタにコピー&ペーストして、`LF`にしてから、再度スプシにコピー&ペーストすれば大丈夫

### 「OSS業界全体の発展」パッケージ（GitHub API）

- 説明
  - GitHub API で取れる範囲の「OSS 業界全体の発展」パッケージの貢献度を算出するプロトタイプの CLI
  - https://github.com/yuichisugio/freeism-calc-contrib/tree/main/src/oss-industry-growth/github-oss-contrib

- 「OSS 業界全体の発展」をプロトタイプのパッケージとして設定する理由
  1.  無料主義を説明するうえで、比較的簡単にデータを取得でき、目標への貢献を分析できる
  2.  最初に説明する層がエンジニアをそ想定している

- 要件
  1. 「Open Source Software Scorecard」は指標として使用しない
     - 理解促進のためのコードなので、Token やインストールなどの準備が多いと他の人たちに体験してもらえないし、ハードルが高くなるため

- 使用するデータ
  1.  スター数
      - 計算式
        - $x$がスターの数
        - デフォでは、$y=2x$にする
      - データ取得方法
        - `gh api repos/<オーナー名>/<リポジトリ名> --jq .stargazers_count`
        - ↑は、REST API の取得方法なので、GraphQL API で star のみ指定して、オーバーフェッチングを避ける
  2.  ダウンロード数
      - 計算式
        - $x$がインストール数
        - デフォでは、$y=1x$にする
      - 取得方法
        - `curl "https://api.npmjs.org/downloads/point/last-month/<リポジトリ名>"`
          - 合計値を取得できるが 1 か月分が限界
        - `curl "https://api.npmjs.org/downloads/range/2025-02-01:2025-07-31/<リポジトリ名>"`
          1.  1 回のリクエストで最大 18 か月まで取得可能
              - 次がある限り while で回す繰り返して合算する処理が必要
          2.  日別 DL 数なので、自分で合算が必要
      - 参考
        - [https://github.com/npm/registry/blob/main/docs/download-counts.md](https://github.com/npm/registry/blob/main/docs/download-counts.md)
        - [https://blog.npmjs.org/post/92574016600/numeric-precision-matters-how-npm-download-counts-work.html](https://blog.npmjs.org/post/92574016600/numeric-precision-matters-how-npm-download-counts-work.html)

### 「指定OSSの発展」パッケージ（GitHub API）

- 説明
  - GitHub API で取れる範囲の「指定 OSS の発展」パッケージの貢献度を算出するプロトタイプの CLI
  - https://github.com/yuichisugio/freeism-calc-contrib/tree/main/src/designated-oss-growth/github-developer-contrib

- 全体の計算ロジック
  - 説明
    - 全ての重み付けの値を掛け算する
    - 基準値は`1`で、それに全ての重み付け値を掛け算する
  - 計算式
    - 全ての重み付け値を掛け算
    - $\prod_{i=1}^{n} x_i$

1. 貢献の実施期間
   - メモ
     - 「ライブラリ作成日」と「最後の main ブランチへのコミット日」をプロジェクト全体の期間として設定する
     - 「ライブラリ作成日」から数えた日数を`$x$`に入れる
     - 貢献時期が早いほど重み付けする
     - 単位は、`day`
     - $x$が日にち
   - 計算式
     - $f(a, b) =\begin{cases} y=-x + 3650 & (y \geq 1) \\1 & (y \lt 1)\end{cases}$
   - 対応タスク
     1. 全てのタスク
2. 作業量
   - メモ
     - コード・コード行数
     - $x$が行数
   - 計算式
     - $f(a, b) =  \begin{cases} 0.1x & (y \geq 1) \\  1    & (y \lt 1)\end{cases}$
   - 対応タスク
     1. commit
     2. Pull Request
     3. Issue
     4. Comment
     5. discussions
3. 参加者からの評価
   - メモ
     - リアクション数
     - 👎バッド`b`は、1 つにつき`-0.1`
     - バッド以外`a`は、1 つにつき`0.1`
     - `y`が 0 以下の場合は`0`にする
   - 計算式
     - $f(a, b) =\begin{cases}0.1a - 0.1b & (y \geq 1) \\1 & (y \lt 1)\end{cases}$
   - 対応タスク
     1. issue
     2. pullrequest
     3. discussions
     4. comment
4. 対応速度
   - メモ
     - 「作成日」から「実施日」までの「日数（`x`)」が短いほど評価を高める
     - 単位は、`day`
     - $x$が日にち
   - 計算式
     - $f(a, b) =\begin{cases} -x + 30 & (y \geq 1) \\1 & (y \lt 1)\end{cases}$
   - 対応タスク
     1. プルリクエスト作成からレビュー日
5. タスクの種類
   - 対応タスク

```json
	"task_type": {
		"pr": {
			"open_pr_created": 5, // 作成
			"draft_pr_created": 2, // 下書き作成
			"approved_pr_created": 10, // 承認された作成
			"rejected_pr_created": 5, // 却下された作成
			"pr_commented": 2, // コメント
			"pr_merged": 3, // マージ
			"pr_reviewed": 5 // レビュー
		},
		"issue": {
			"open_issue_created": 3, // 作成
			"not_planned_issue_created": 2, // 作成
			"completed_issue_created": 5, // 作成
			"issue_commented": 2, // コメント
			"issue_status_changed": 5 // ステータス変更
		},
		"commit": {
			"commits": 6 // コミット
		},
		"sponsor": {
			"spot_high": 3,
			"spot_medium": 2,
			"spot_low": 1,
			"monthly_high": 5,
			"monthly_medium": 4,
			"monthly_low": 3
		},
		"star": 1,
		"fork": 1,
		"watch": 1,
		"install": 1
	}
```

### 「幸福度の向上」パッケージ

- 説明
  - 感情を分析する CLI

- 使用場面
  1. 「幸福度の向上」パッケージで、幸福度が向上しているか、何が原因かを分析する

- 参考
  1. OpenAI の API と Supabase と Next.js で感情分析アプリを作る
     - https://zenn.dev/fr0608/books/8926012b52330e
     - 形態素分析は、Python or Yahoo!の形態素解析 API を使用してもよさそう

## v2

### プロトタイプの設計

- v2 に実装予定の機能
  1.  他の評価軸に対応
      - 説明
        - GitHub API 以外のデータを取得して、「OSS 業界全体の発展」や「指定 OSS の発展」の貢献度を算出する実装の追加
  2.  自動実行
      - 説明
        - GitHub Actions などで、定期的にスクリプトを実行して指定ライブラリの新規タスクの貢献度を算出する仕組み
  3.  `main.sh`ではないコマンド名が欲しい
      - 説明
        - シェルスクリプトのファイル実行権限の付与やファイルの実行 PATH の指定が面倒なので、「1 コマンド」で「短文」で実行できるようにしたい
      - メモ
        - `npx` or `bunx` or `homebrew`では登録が面倒だったら、`mise`で設定しても良さそう
        - 登録するならインストールして、`freeism`コマンドを作って実行したい
  4.  出力形式を、「JSON」と「CSV」ファイルに対応
  5.  複数トークンに対応
      - 設定
        - GitHub API で複数トークンを使い回せるようにしたい
        - 1 つの PAT だと RateLimit が来たら止まるため、止まらないように複数登録したい
      - 参考
        1.  [https://deepwiki.com/adobe/oss-contributors/4.3-github-token-management](https://deepwiki.com/adobe/oss-contributors/4.3-github-token-management)
        2.  [https://github.com/adobe/oss-contributors/blob/cf675dee/src/util/github_tokens.js](https://github.com/adobe/oss-contributors/blob/cf675dee/src/util/github_tokens.js)
