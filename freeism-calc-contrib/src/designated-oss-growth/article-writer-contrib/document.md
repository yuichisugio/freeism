# Article Writer Contribution

## 概要

- 記事を書くことによる、指定した OSS への貢献の度合い

## 対応している記事投稿先のプラットフォーム

- Zenn

## 仕様

### Zenn

- 対応カラム

  - `title`の文字数と`body_letters_count`の合計
  - `liked_count`による重み付け
  - `bookmarked_count`による重み付け
  - `published_at`で、エポック秒による重み付け
  - `total_count`による希少性

- 改善点
  - 期間を区切って取得する方法は未実装
  - 実際に使用するようになれば実装する

## Step by Step（処理フロー）

1. 準備

   - 依存コマンドの確認（`gh`, `jq`, `curl`）。`gh auth status` による認証必須。
   - スクリプトは `set -euo pipefail`。`PROJECT_DIR` に `cd` 固定。
   - 出力ディレクトリ `results/<YYYY-MM-DD-HH:MM:SS>/` を作成。

2. 引数パース（UI）

   - `-i, --input-config <path>`: 設定ファイル（既定: `PROJECT_DIR/input-config.json`）。
   - `--qiita-token <token>`: Qiita 用トークン（現時点では未使用）。
   - `-h, --help` / `-v, --version`: ヘルプ/バージョン表示。

3. 実行本体

   - 依存チェック後、Zenn の取得処理 `get_zenn` を実行（Qiita/Note/はてなは雛形のみ）。

4. Zenn: データ取得（ロジック）

   - 設定 `input-config.json` の `search_names` を `topicname` として使用。
   - API: `https://zenn.dev/api/articles?topicname=<name>&order=latest&count=48&page=<n>` をページネーションし、全ページを走査。
   - 取得した `.articles[]` を結合し、`zenn/raw-zenn.json` に配列で保存。

5. Zenn: データ加工（ロジック）

   - 正規化フィールドを生成し `zenn/processed-zenn.json` に保存。
     - `article_id`, `post_type`, `title`, `path`。
     - `task_date`: `published_at` を UTC ISO 形式に正規化。
     - `letter_count`: `body_letters_count` + `length(title)`。
     - `liked_count`, `bookmarked_count`。
     - `user`: `{ id, username, name }`。

6. Zenn: 貢献度算出（ロジック）
   - 設定 `weighting.zenn` と `repository_created_at` を参照。
   - 各記事について指標を計算し、ユーザー単位に集計して `zenn/result-zenn.json` を出力。

## UI（CLI インターフェース）

- 実行例

  ```bash
  ./main.sh -i ./input-config.json
  # または
  ./main.sh --input-config ./input-config.json"
  ```

  - `--input-config`オプションで指定しない場合は、`main.sh`にある`input-config.json`を読み込む

- 出力先
  - `results/<timestamp>/zenn/raw-zenn.json`
  - `results/<timestamp>/zenn/processed-zenn.json`
  - `results/<timestamp>/zenn/result-zenn.json`
    - これが貢献度の算出した結果を記載したファイル

## ロジック（重み付け・集計仕様）

- 用語

  - `task_type` 重み: 定数（例: `1`）。
  - `metric_weight(src, weight, lower_limit)`:
    - 計算: `src * weight`。結果が `lower_limit` 未満なら `lower_limit` を採用。
  - `clamp(max_period, period_weight, minus_unit, days, lower_limit)`:
    - 計算: `(max_period - minus_unit * days) * period_weight`。結果が `lower_limit` 未満なら `lower_limit`。
  - 経過日数 `days`: `floor((task_date - repository_created_at) / 86400)`。

- 記事ごとの寄与値（Zenn）

  - `criterion_weight_for_task_type = task_type`。
  - `criterion_weight_for_liked_count = metric_weight(liked_count, liked.weight, liked.lower_limit)`。
  - `criterion_weight_for_bookmarked_count = metric_weight(bookmarked_count, bookmarked.weight, bookmarked.lower_limit)`。
  - `criterion_weight_for_letter_count = metric_weight(letter_count, letter.weight, letter.lower_limit)`。
  - `criterion_weight_for_task_date = clamp(task_date.max_period, task_date.period_weight, task_date.minus_unit, days, task_date.lower_limit)`。
  - `contribution_point = 上記5指標の積`。

- 集計
  - ユーザー `user.id` ごとに記事を束ね、`task_date` 昇順にソート。
  - ユーザーごと `contribution_point` は「記事ごとの寄与値の合計」。
  - メタ情報に `createdAt`, `analysisPeriod`, `search_names`, `weighting` を格納。

## 入力設定ファイル（`input-config.json`）

- `search_names: string[]` — Zenn の `topicname` にそのまま使用。
- `repository_created_at: string(ISO)` — 期間重みの起点日。
- `weighting.zenn`
  - `task_type: number`
  - `liked_count: { weight: number, lower_limit: number }`
  - `bookmarked_count: { weight: number, lower_limit: number }`
  - `letter_count: { weight: number, lower_limit: number }`
  - `task_date: { max_period: number, period_weight: number, minus_unit: number, lower_limit: number }`

## 実装状況

- Zenn: 実装済み（取得・加工・算出・集計）。
- Qiita / Note / はてな: スタブのみ（`scripts/*.sh` 雛形、未実装）。

## 制約・注意事項

- 取得期間の制御は未実装（全ページ走査）。API レスポンスの `next_page` が `null` になるまで取得。
- `gh` の認証確認を行うため、Zenn のみ利用時でも `gh auth login` が必要。
- `search_names` は必須。空配列の場合は結果も空になる可能性。
- 各プラットフォームごとに重みは独立（現状は Zenn のみ参照）。

## 出力スキーマ（抜粋）

- `zenn/result-zenn.json`
  - `meta`: `{ createdAt, analysisPeriod: { since, until }, search_names, weighting }`
  - `data.user[]`: ユーザー単位の集計
    - `contribution_point: number`
    - `id, username, name`
    - `task_total_count: number`
    - `task[]`: 記事明細（`id, title, task_url, task_date, letter_count, liked_count, bookmarked_count, 各criterion, contribution_point`）

## 改善点（補足）

- 期間フィルタの導入（`since/until` を引数または設定に追加）。
- Zenn 以外（Qiita/Note/はてな）の実装。
- `result-zenn.json` のハッシュ化/署名による改竄検知。

## 工夫

1. ファイル・フォルダを「過程」or「貢献の種類」のどちらで分けるか
   1. `get-data`,`process-data`,`calc-contrib`などの過程
   2. `zenn`,`qiita`,`note`,`hatena`などの記事の投稿先の種類
   3. 結論
      1. 基本は種類で分ける。一つだけ選んでも、その実装が複雑になる場合はその対象のみ切り出して過程で分ける
2. 複数の API にまたがる場合は、それぞれのパラメーターの指定が必要なので、コマンド引数ではなく json ファイルに記載してもらったほうが良い
   1. トークンなどの情報のみコマンド引数で受け取る

## 改善点

- `result-zenn.json`をハッシュ化して、改竄されたかわかるようにしたい
