# GitHub Developer Contribution

- [GitHub Developer Contribution](#github-developer-contribution)
  - [概要](#概要)
  - [使い方](#使い方)
    - [リポジトリ全体で初回のみ](#リポジトリ全体で初回のみ)
    - [処理を実行](#処理を実行)
    - [オプション](#オプション)
  - [出力形式](#出力形式)
    - [出力される形式は以下](#出力される形式は以下)
    - [CSV のカラム](#csv-のカラム)
    - [JSON 形式](#json-形式)
    - [CSV 形式](#csv-形式)
  - [今後追加したい内容](#今後追加したい内容)
  - [評価軸を追加・削除・変更したい場合](#評価軸を追加削除変更したい場合)
  - [Rate Limit 対策](#rate-limit-対策)
  - [貢献度の算出方法](#貢献度の算出方法)
    - [概要](#概要-1)
    - [各指標ごとの計算式](#各指標ごとの計算式)
      - [貢献の実施期間](#貢献の実施期間)
      - [作業量](#作業量)
      - [参加者からの評価](#参加者からの評価)
      - [対応速度](#対応速度)
      - [ステータスの種類](#ステータスの種類)
      - [タスクの種類](#タスクの種類)
        - [プルリクエスト](#プルリクエスト)
        - [Issue](#issue)
        - [Discussions](#discussions)
        - [コミット](#コミット)
        - [others](#others)
    - [必要なカラム](#必要なカラム)
      - [Star](#star)
      - [Fork](#fork)
      - [Watch](#watch)
      - [Pull Request](#pull-request)
      - [Commit](#commit)
      - [Issue](#issue-1)
      - [Discussions](#discussions-1)
  - [工夫したポイント](#工夫したポイント)
  - [改善点](#改善点)

## 概要

- GitHub リポジトリの URL で指定したライブラリに貢献した開発者の一覧と貢献度を算出するツール

## 使い方

### リポジトリ全体で初回のみ

1. <a href="https://cli.github.com/" target="_blank" rel="noopener noreferrer">GitHub CLI(`gh`)</a>のインストール
2. <a href="https://cli.github.com/manual/gh_auth_login" target="_blank" rel="noopener noreferrer">`gh auth login`</a>でログイン
3. <a href="https://stedolan.github.io/jq/download/" target="_blank" rel="noopener noreferrer">`jq`</a>をインストール
4. `gh`に、権限を付与
   ```shell
   gh auth refresh --scopes read:user
   ```
5. シェルで、以下を実行
   ```shell
   git clone https://github.com/yuichisugio/freeism-contribution-calculate.git
   cd freeism-contribution-calculate/src/designated-oss-growth/github-developer-contrib
   ```

### 処理を実行

1. 代表的な実行例

   ```shell
   # ヘルプ
   ./main.sh -h

   # 対象リポジトリを指定（URL/SSH/owner/repo いずれも可）
   ./main.sh -u https://github.com/microsoft/vscode

   # 期間指定（開始・終了日は日単位。時刻は自動補完: 00:00:00Z / 23:59:59Z）
   ./main.sh -u owner/repo -s 2025-01-01 -un 2025-01-31

   # タスク選択（カンマ区切り or 複数 -t 指定）
   ./main.sh -u owner/repo -t "star,fork"
   ./main.sh -u owner/repo -t star -t fork

   # 現在の RateLimit を表示して終了
   ./main.sh -r
   ```

### オプション

- `-u, --url`: 対象リポジトリ。サポート形式は以下。
  - `https://github.com/OWNER/REPO` / `http://...`
  - `git@github.com:OWNER/REPO(.git)`
  - `OWNER/REPO`
- `-s, --since`: 取得・集計の開始日（例: `2025-01-01`）。時刻は `T00:00:00Z` に自動補完。
- `-un, --until`: 終了日（例: `2025-01-31`）。時刻は `T23:59:59Z` に自動補完。
- `-t, --tasks`: 実行するデータ取得/加工タスクを選択（デフォルトは全件）。
  - 指定可能値: `commit, discussion, fork, issue, pull-request, release, sponsor, star, watch`
  - 複数指定可（カンマ区切り、または `-t` を複数回）。
  - 注意: この指定は「データ取得/加工」にのみ影響します。貢献度の算出は、取得できたデータに対して全タスク種別で実行されます。
- `-ve, --verbose`: 詳細ログを追加（標準エラー出力）。出力スキーマは変わりません。
- `-r, --ratelimit`: 現在の GitHub GraphQL RateLimit 残量を表示して終了。
- `-h, --help`: ヘルプを表示して終了。
- `-v, --version`: バージョンを表示して終了。

## 出力形式

### 出力される形式は以下

1.  CSV 形式
    - csv をスプシにコピペして、他の依存 OSS の貢献などと組み合わせて依存 OSS と開発者の貢献度の一覧を表示したい
    - また、無料主義アプリにそのままアップロードできるようにしたい
2.  JSON 形式

### CSV のカラム

CSV はユーザー集計（タスク配列を除外した simple バージョン）を `result-simple.csv` に出力します。ヘッダーは以下です。

```csv
contribution_point,user_id,user_database_id,user_login,user_name,user_url,user_type,task_total_count
```

### JSON 形式

```json
{
	"meta": {
		"analytics": { "createdAt": "2025-09-25T10:09:44Z" },
		"repository": {
			"host": "github.com",
			"owner": "ryoppippi",
			"Repository": "ccusage",
			"url": "https://github.com/ryoppippi/ccusage"
		}
	},
	"data": {
		"user_total_count": 2,
		"user": [
			{
				"contribution_point": 123,
				"user_id": "MDQ6VXNlcj...",
				"user_database_id": 123456,
				"user_login": "alice",
				"user_name": "Alice",
				"user_url": "https://github.com/alice",
				"user_type": "User",
				"task_total_count": 3,
				"task": [
					{
						"task_id": "PR_kw...",
						"task_database_id": 111,
						"task_full_database_id": "PR_kw...:review123",
						"task_url": "https://github.com/OWNER/REPO/pull/1",
						"task_name": "create_pull_request",
						"task_date": "2025-01-10T12:34:56Z",
						"reference_task_date_field": "createdAt",
						"criterion_weight_for_task_type": 1,
						"criterion_weight_for_repo_creation_to_task_period": 123,
						"criterion_weight_for_amount_of_work": 45,
						"criterion_weight_for_amount_of_reaction": 6,
						"criterion_weight_for_state": 5,
						"criterion_weight_for_response_speed": 10,
						"contribution_point": 276
					}
				]
			}
		]
	}
}
```

- 生成物は以下に配置されます（例: `results/OWNER-REPO-1970-01-01T00:00:00Z-2099-12-13T23:59:59Z-20250925T100944/`）。
  - `get-data/` 取得した生データ
  - `processed-data/` 加工済みデータ（統合ファイル: `integrated-processed-data.json`）
  - `calc-contrib/`
    - `result-verbose.json`（タスク配列・各評価軸の重み・各タスクの貢献度入り）
    - `result-simple.json`（ユーザー集計のみ。`task` を除外）
    - `result-simple.csv`（上記 simple JSON を CSV 化）

### CSV 形式

```csv
contribution_point,user_id,user_database_id,user_login,user_name,user_url,user_type,task_total_count
276,MDQ6VXNlcj...,123456,alice,Alice,https://github.com/alice,User,3
```

## 今後追加したい内容

1. 期間を指定して貢献度の算出ができる仕組み
   - API 制限的に一度に取得できる数に限りがあるため
1. ステータス変更の差分を算出する
   - `updatedAt`などを見て、プルリクエストのステータスが変わっているものだけ、以前のデータからの差分を算出したい
   - タスクの算出内容も知りたいため、以前のデータは`vervose`で出力が必須。

## 評価軸を追加・削除・変更したい場合

1. `./src/designated-oss-growth/github-developer-contrib/get-data`フォルダ直下に、新規ファイルを作成して、新しくデータを取得する処理を入れる
1. `./src/designated-oss-growth/github-developer-contrib/process-data`に、フォルダ直下に、新規ファイルを作成して、新しくデータの加工処理を入れる
1. `./src/designated-oss-growth/github-developer-contrib/calc-weighted`フォルダ直下に、重み付けの値を算出する処理を追加実装する
1. `./src/designated-oss-growth/github-developer-contrib/calc-contrib`に、貢献度を算出する処理を入れる

## Rate Limit 対策

- 基本は以前の取得分に追加して取得する使い方だと思うが、RateLimit 対策は後々実装したい

## 貢献度の算出方法

### 概要

- 貢献度の算出の流れ

  1.  各タスクごとに、それぞれの評価軸の視点で貢献度を算出する
  1.  全ての評価軸の貢献度を掛け算して、タスクごとの貢献度を算出
  1.  タスクごとの貢献度を、ユーザーごとに合算する

- 評価軸の一覧
  1.  貢献の実施期間
  1.  作業量
  1.  参加者からの評価
  1.  対応速度
  1.  タスクの種類
  1.  ステータス

### 各指標ごとの計算式

#### 貢献の実施期間

- 説明

  - 初期に貢献するほど、プロジェクトを見つけて発展させる貢献度は大きいので評価したい。
  - 「ライブラリ作成日」から数えた日数を`x`に入れる。

- 計算式
  $$f(a, b) =\begin{cases} y=-x + 3650 & (y \geq 1) \\1 & (y \lt 1)\end{cases}$$

- 対応タスク
  1. 「タスクの種類」に記載の全てのタスク
     - コミット・プルリクエストについては、`git commit`した日を実行日とする

#### 作業量

- 説明

  - 作業量で重みづけ
  - 作業量は、「コードの追加・削除の行数」、「コメントの追加・削除の行数」で評価する
  - `x`が行数 or コメントの文字数
  -
  - 無駄に冗長な場合は、バッドマークの絵文字を付けてマイナスに重み付けされるので良さげな長さになるはず

- 計算式

  - コード行数
    $$f(a, b) = \begin{cases} 0.1x & (y \geq 1) \\ 1 & (y \lt 1)\end{cases}$$
  - コメントの文字数
    $$f(a, b) = \begin{cases} 0.05x & (y \geq 1) \\ 1 & (y \lt 1)\end{cases}$$

- 対応タスク
  - プルリク
    - 作成者
      - プルリクの作成者のコード行数(commit ごとにカウントする`addictions`,`deletions`)
      - プルリクの作成者による作成時のコメントの文字数
    - レビュー時
      - プルリクのレビュー時のコード行数
      - プルリクのレビュー時のコメントの文字数
    - コメント
      - プルリクの作成者以外によるコメントの文字数
      - プルリクの作成者以外によるコード行数
  - Issue
    - Issue のコメントの文字数
  - Discussions
    - Discussions のコメントの文字数
  - コミット
    - コミットのコード行数
    - コミットの`git commit`のコメントの文字数

#### 参加者からの評価

- 説明

  - リアクション数
  - 👎 バッド`b`は、一つにつき`0.1`(初期値・自由に変更可能)
  - バッド以外`a`は、一つにつき`0.1`(初期値・自由に変更可能)
  - `y`が 0 以下でも、マイナスのままにして、ユーザー合算の時に他のタスクにも影響が出るようにしたい
  - discussions の`upvoteCount`もグッドとしてカウントしたい

- 計算式

  - いきなり、$f(a, b) =0.1a - 0.1b$で計算すると$a$が`0`(リアクションなし)の場合にすべての評価軸の結果を掛け算する際の貢献度が`0`になる。<br>なので、$a$が`0.1`以下の場合は、`0.1`にしてから、$a$と$b$を計算する。<br>小数を掛け算して貢献度の桁が少なくなるのは許容。リアクションの重み付けは少なくしたい。
    $$f(a) =\begin{cases} 0.1a & (y \geq 0.1) \\0.1 & (y \lt 0.1 )\end{cases}$$
    $$f(b) =-0.1b$$
    $$f(a,b) =f(a)+f(b)$$

- 対応タスク
  - Pull Request
    - Pull Request のコード提案のリアクション数
    - Pull Request のコード提案に返信したコメントのリアクション数
  - Issue
    - Issue の議題提案のリアクション数
    - Issue の議題提案に返信したコメントのリアクション数
  - Discussions
    - Discussions の提案のリアクション数
    - Discussions の提案に返信したコメントのリアクション数

#### 対応速度

- 説明

  - 各タスクごとの対応速度で重み付け
  - 「作成日」から「実施日」までの「日数`x`」が短いほど評価を高める。

- 計算式
  $$f(a, b) =\begin{cases} -x + 30 & (y \geq 1) \\1 & (y \lt 1)\end{cases}$$

- 対応タスク

  1.  Issue
      - Issue 作成から、コメントまでの日数
      - Issue 作成から、ステータス変更までの日数
      - Issue 作成から、リアクションするまでの日数
      - Issue 作成から、ラベル付けするまでの日数
      - Issue 作成から、担当者のアサインまでの日数
  1.  Pull Request
      - Pull Request 作成から、`Rejected`or`Approved`or`Merged`までの日数
      - Pull Request 作成から、コメントまでの日数
      - Pull Request 作成から、リアクションするまでの日数
      - Pull Request 作成から、ラベル付けするまでの日数
      - Pull Request 作成から、レビュワー担当者アサインまでの日数
      - Pull Request 作成から、プルリクエスト担当者のアサインまでの日数
  1.  Discussions
      - Discussions 作成から、コメントまでの日数
      - Discussions 作成から、リアクションするまでの日数
      - ※「Discussions 作成からステータス変更」は、議論を十分する時間がなくなり望まない結果になるので算出しない。

#### ステータスの種類

- 説明

  - プルリクでは`MERGED`されたプルリクに重み付けする。などの評価軸

- 計算式
  $$f(a, b) =\begin{cases} y=-x + 3650 & (y \geq 1) \\1 & (y \lt 1)\end{cases}$$

- 対応タスク
  1. プルリクエスト
     1. `MERGED`
        1. `3`
        2. `APPROVED`などはレビューのステータスなので含めない
     2. `CLOSED`,`OPEN`(`Pending`,`Changes requested`)
        1. `1`
  2. イシュー
     1. `CLOSED` - `COMPLETED`
        1. `3`
     2. `CLOSED` - `DUPLICATE`,`NOT_PLANNED`,`REOPENED`
        1. `1`
     3. `OPEN`
        1. `1`

#### タスクの種類

- 説明
  - GitHub API **から取得できるタスクの重み付け**

##### プルリクエスト

1. プルリクエストの作成
   - `1`
2. プルリクエストにコメント投稿
   - `1`
3. プルリクエストをマージ
   - `2`
4. プルリクエストをレビュー
   - `3`
5. プルリクエストにラベル付け
   - `1`
6. プルリクエストの作成担当者のアサイン
   - `1`
7. プルリクエストのレビュー担当者のアサイン
   - `1`
8. プルリクエストにリアクションをつける
   - どんな絵文字でも 1 つ以上つけたら貢献。2 つ以上つけても合算しない。
   - `1`

##### Issue

1. Issue 作成
   - `1`
2. Issue にコメント
   - `1`
3. Issue のステータスを変更
   - `1`
4. Issue にラベル付けをする
   - `1`
5. 担当者をアサイン（アサインする側）
   - `1`
6. Issue にリアクションをつける
   - どんな絵文字でも 1 つ以上つけたら貢献。2 つ以上つけても合算しない。
   - `1`

##### Discussions

1. Discussions の作成
   - `2`
1. Discussions にコメント
   - `1`
1. Discussions にリアクション
   - どんな絵文字でも 1 つ以上つけたら貢献。2 つ以上つけても合算しない。
   - `1`
1. Discussions にラベル付け
   - API で、`timelineItems`が無いため取得できない
1. Discussions にカテゴリー分けをする
   - `1`
1. Discussions に回答する
   - `3`
1. Discussions の回答を決定する
   - `3`
1. Discussions に投票する
   - 取得できる API がない

##### コミット

1. `main` ブランチへのコミット
   - 基本はプルリクエストで管理したい
   - GitHub API で、`branchProtectionRules` オブジェクトの`Require a pull request before merging` が`true`の場合は不要
   - コミットは、main ブランチに直接プッシュした場合のみカウントしたい
   - `2`
1. コミットへコメント
   - `1`
1. コミットへのコメントへリアクション
   - `1`

##### others

- ※API の Rate Limit 的にデータは取得しない可能性もある

1. Star する
   - `1`
1. Fork する
   - `1`
   - fork 回数が何度あっても重複カウントしない
1. Watch する
   - `1`
1. スポンサーをする
   - 一旦は、GitHub Sponsors のみ対象
   - `owner`,`funding.yaml`記載のユーザー・組織に対して、リポジトリ関係なくスポンサーしている人たちが対象。このリポジトリに限らずとも支援していたら評価する
   - `50`

### 必要なカラム

#### Star

- 押した人のユーザー名
- 押した人のユーザー ID
- 押した日
  - 期間指定できないため`--paginate`を使用せず、手動ページネーションで期間のみを掲載してページネーションの for 文を止める処理を入れている

#### Fork

- 押した人のユーザー名
- 押した人のユーザー ID
- 押した日
  - 期間指定できないため`--paginate`を使用せず、手動ページネーションで期間のみを掲載してページネーションの for 文を止める処理を入れている

#### Watch

- 押した人のユーザー名
- 押した人のユーザー ID
- 押した日
  - カラムが存在しない。ソートもできないのでローカルで名前順に並び替えて差分を見るしかない？

#### Pull Request

- プルリク担当者
  - 割り振った人のユーザー名
  - 割り振った人のユーザー ID
  - 割り振った日
- レビュー担当者
  - 割り振った人のユーザー名
  - 割り振った人のユーザー ID
  - 割り振った日
- プルリクのコメント
  - コメント作成者のユーザー名
  - コメント作成者のユーザー ID
  - コメント作成日
  - コメントの文字数
- プルリクの作成
  - プルリク作成者のユーザー名
  - プルリク作成者のユーザー ID
  - プルリク作成日
  - コードの追加・削除の行数
  - コメントの文字数
- プルリクのマージ担当者
  - ステータス変更者のユーザー名
  - ステータス変更者のユーザー ID
  - ステータス変更日
  - 変更したステータスの内容
- プルリク作成のリアクション
  - リアクション作成者のユーザー名
  - リアクション作成者のユーザー ID
  - リアクション作成日
  - リアクションの種類（バッドか否か）
- プルリクへのコメントのリアクション
  - リアクション作成者のユーザー名
  - リアクション作成者のユーザー ID
  - リアクション作成日
  - リアクションの種類（バッドか否か）

#### Commit

- 取得項目
  - コミット日
  - コミット者のユーザー名
  - コミット者のユーザー ID
  - コード行数
  - コメントの文字数

#### Issue

- ラベル
  - 割り振った人のユーザー名
  - 割り振った人のユーザー ID
  - 割り振った日
- 担当者
  - 割り振った人のユーザー名
  - 割り振った人のユーザー ID
  - 割り振った日
- Issue の作成
  - Issue 作成者のユーザー名
  - Issue 作成者のユーザー ID
  - Issue 作成日
  - コメントの文字数
- Issue 提案へのコメント
  - コメント作成者のユーザー名
  - コメント作成者のユーザー ID
  - コメント作成日
  - コメントの文字数
- Issue のステータス変更
  - ステータス変更者のユーザー名
  - ステータス変更者のユーザー ID
  - ステータス変更日
- Issue 作成のリアクション
  - リアクション作成者のユーザー名
  - リアクション作成者のユーザー ID
  - リアクション作成日
  - リアクションの種類（バッドか否か）
- Issue コメントのリアクション
  - リアクション作成者のユーザー名
  - リアクション作成者のユーザー ID
  - リアクション作成日
  - リアクションの種類（バッドか否か）

#### Discussions

- カテゴリー
  - 割り振った人のユーザー名
  - 割り振った人のユーザー ID
  - 割り振った日
- ラベル
  - 割り振った人のユーザー名
  - 割り振った人のユーザー ID
  - 割り振った日
- 投票
  - 投票者のユーザー名
  - 投票者のユーザー ID
  - 投票日
- 議題提案の作成
  - 作成者のユーザー名
  - 作成者のユーザー ID
  - 作成日
  - コメントの文字数
- 議題提案へのコメント
  - 作成者のユーザー名
  - 作成者のユーザー ID
  - 作成日
  - コメントの文字数
- 議題提案へのリアクション
  - 作成者のユーザー名
  - 作成者のユーザー ID
  - 作成日
  - リアクションの種類（バッドか否か）
- 議題提案へのコメントへのリアクション
  - 作成者のユーザー名
  - 作成者のユーザー ID
  - 作成日
  - リアクションの種類（バッドか否か）

## 工夫したポイント

1. 依存関係
   1. できる限り依存関係がないように工夫した
2. ページネーション
   - `--since`,`--until`オブションで期間指定してデータを分析するために、GitHub API で期間指定のデータ取得に対応していない場合があるため、`gh api graphql --paginate`を使用せず手動でページネーションを行っている
3. id の形式
   - User オブジェクトの`id`フィールドは、`MDQ6SIOlcjg0MzI4Ng==`と`U_kgDOCihAMg`のような形式があるので、以下オプションで新しい形式に統一して取得している
   - `--header X-Github-Next-Global-ID:1`オプションを指定することで、新しい形式を取得できる
4. データの取得の流れ
   - データの取得は、GitHub GraphQL API 内の node の`id`とそのオブジェクトのデータを取得してから、`node`クエリの`id`指定で関連するオブジェクト(コメントなど)を取得している
5. 全ての ID 系のフィールドを取得
   - 何かしらの ID で突合できるように、得られる ID 系フィールド全てを取得する
6. 「アサイン」、「ラベル付け」の作業で貢献として認める仕様
   - 各 Issue などのオブジェクトごとに、現在ついている全てのラベル,アサインをそれぞれ行った最新の日・最新の人のみを貢献として認める
7. プルリクエストとコミットのデータ取得方法
   - プルリクエストとコミットの両方を貢献として評価するために、以下の流れにしている
     1. merge 済みのコミット一覧と紐づく pull request を取得
     2. 別クエリで、state が`MERGED`以外のプルリクエストを取得＆データ加工する
   - データ取得の流れと重み付けの流れ的に ↑ の方法にした
     1. github でコミット一覧から場合に merge_squash 後のコミットが出てくるのが `repository.ref.target.commit.history` オブジェクトから取る方法
     2. pull-request から紐づくコミットを取る方法だと、merge_squash 前のデータが出るため、デバッグしにくいし、github から見た場合との違いが出て混乱する
     3. データ取得の流れを issue 作成など他と統一するために node_id 取得して、それを取得して関連するデータを取得したいので、コミットのコメントなどを取得するために node_id が初めに欲しくてコミット一覧を取得する
8. プルリクの`reviewRequests`の仕様
   - プルリクの`reviewRequests`は、レビュー担当者としてアサインされながらレビューが未完了の人のみを返す。
   - なので、全員が完了済みの人も欲しい場合は`ReviewRequestedEvent`と`ReviewRequestRemovedEvent`を使用して残っている人がレビュー担当者としてアサインされている人だと見なす
9. `Discussion`には、`timelineItems`が存在しない。
   1. `Discussion`でも`labels`はあるが、`timelineItems`が存在しないため、ラベル付けしたひとを取得できないので貢献度としては算出できない
10. `MERGED_EVENT`の後に必ず`CLOSED_EVENT`が実行されている
    1. `Pull Request`オブジェクトの`timelineItems`フィールドの`MERGED_EVENT`の後に必ず`CLOSED_EVENT`が実行されているので、`MERGED_EVENT`は取得しない
    2. ステータス変更(reject or merged)した人のタスクは、`CLOSED_EVENT`だけですべて拾える
11. discussion の`answer`と`comment`は同じ扱いっぽい。
    - なので同じ人内で同じデータが`answer`と`comment`の両方で取得できてしまう。
    - また、`answer`に対して行った`reaction`や`reply`も、コメントに対してのタスクとしても出力されるので重複する
    - answer は comment の方を削除したい。answer は comment よりも重み付けしているため。
    - reaction や reply はどちらでも問題ないので、どちらかを削除したい。
    - `integrate_processed_files`関数に、node_id も answer と comment が同じため、group_by で id でグループ化して、answer を上位に配置するソート後に、.[0]は上位のみ採用する処理で対応した
12. `watch`は`createdAt`が存在しない。
    - 期間で区切っても毎回全て出力される。
    - 貢献と認めたくない場合は、`weighting.jsonc`で`0`にすれば OK
13. `Release`は、バッドリアクションが無く、グッドリアクションしか押せない・選べない
14. `Discussion`,`Issue`,`Pull Request`など文言を統一できるところは統一している
15. `state`に`state`,`stateReason`や`closed`を合体させて`state`にしている
16. CSV 形式は、simple 出力バージョンにのみ対応
17. committedDate と authoredDate の違い
    - **`uthoredDate`**: その変更が**最初に作られた時刻**（作者が `git commit` したときの日時）。
    - **`committedDate`**: その変更が**最終的にリポジトリへ適用された時刻**（例: リベース／アメンド／他者が当てたパッチで更新された時刻）
18. `first`の件数を基本は`50`にする
    1. 502 エラー、stream エラーになって止まる場合が多いので上限の 100 件は避ける
19. `release`は、good 系のリアクションしかできない。`THUMB_DOWN`リアクションがない
20. commit は、`author`,`committer`ではなく、`authors`を使用する
    1. co-author のデータも評価したいし、merge-rebase などのコミットを適応した人(`committer`)ではなく、`git commit`したコード実装者(`authors`)を評価したいため
21. データ加工(`process-data`)と貢献度の算出(`calc-contrib`)では、task_name が異なる
    1. 例）データ加工では issue のコメントと pull-request のコメントのデータで分けていたが、貢献度の算出では同じにしている
    2. `weighting.json`,`process-data`で`task_name`を分ければ分けて評価も可能

## 改善点

1. `nodes`クエリのテスト
   - `nodes`クエリでノード ID をバッチで取得して、リクエストごとの数ではなく 100 分の 1 の数の消費に抑えたい
   - 現在は`node`クエリで一つずつしか取得しておらず、rateLimit のポイントを多く消費してしまう実装になっている
   - ページネーションの設計が複雑になるので、プルリクや Issue の label 数など現実的に 50 個以上つかない場合で使用できそう
1. ①`Pull Request`の`id`フィールド(node の id)の取得と ②`id`を使用して`node`クエリで情報を取得する場合に、① は期間外だが、② は期間内のデータがあったときに、② のデータを確実に取得できるように、すべての ① のデータを取得しておく設計
   - 今後実装したい
   - 目的は期間を指定して取得することじたいではなく、データの漏れを無くすことなため、`-s`,`-un`で期間の漏れがなく指定できれば、すべてのデータを取得できるので、一旦は簡潔な設計にするため後回し
1. アサインイベント以外は jq 側で最新のデータのみ抽出するのであれば、`timelineItems`のそれぞれのイベントは`last:1`で良さそう
1. `timelineItems`で、別イベントも取得してしまっているので、一緒のクエリで取得して、データ加工時に、`__typename`で分けたほうが良さそう
1. get-data などの処理を並列で実行したい
