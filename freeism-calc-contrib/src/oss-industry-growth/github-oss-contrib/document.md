# GitHub OSS Contribution

## 概要

- 指定した GitHub リポジトリと npm パッケージに基づき、OSS 業界への貢献度を数値化する CLI。
- 取得（GitHub: Star、npm: ダウンロード）、加工、重み付け集計、CSV/JSON 出力まで自動化。

## 仕様

- 期間指定は実装していない
- データソース
  - GitHub GraphQL API（`gh api graphql`）: `stargazerCount`
  - npm Downloads API（`/downloads/range/`）: 日次ダウンロードの全期間合算
- 設定ファイル: `src/oss-industry-growth/github-oss-contrib/input-config.json`
  - `search_names.github.{owner,repo}` と `search_names.npm.name`
  - `weighting`: `npm_download_count.per_install`, `github_star_count.per_star`
- 依存コマンド: `gh`（認証必須）, `jq`, `curl`
- 出力ディレクトリ: `results/<YYYY-MM-DD-HH:MM:SS>/`
  - `get-data/`, `processed-data/`, `calc-contrib/`

## 使い方（UI: CLI）

1. 依存の準備

```bash
gh auth login
```

2. 設定の確認/変更（`input-config.json`）

```json
{
	"search_names": {
		"github": { "owner": "ryoppippi", "repo": "ccusage" },
		"npm": { "name": "ccusage" }
	},
	"weighting": {
		"npm_download_count": { "per_install": 1 },
		"github_star_count": { "per_star": 2 }
	}
}
```

3. 実行

```bash
bash src/oss-industry-growth/github-oss-contrib/main.sh
```

4. 出力確認

- JSON: `.../calc-contrib/result.json`
- CSV: `.../calc-contrib/result.csv`

---

## ロジック（Step by Step）

1. 初期化（`main.sh`）
   - `SCRIPT_DIR` に固定し、`utils.sh` を読込
   - `parse_args` で `input-config.json` から `GITHUB_OWNER`/`GITHUB_REPO`/`NPM_NAME` を取得
   - `require_tools` で `gh jq curl` と `gh auth status` を検証
   - 出力ルート `results/<timestamp>` を生成
2. データ取得（`scripts/get-data/integration.sh`）
   - `get_github_star`（`github-star.sh`）
     - GraphQL で `stargazerCount` を `get-data/github-star.json` へ
   - `get_npm_downloads`（`npm-downloads.sh`）
     - 18 ヶ月制限を考慮して 17 ヶ月刻みで 2015-01-10 から今日まで反復取得し、`get-data/npm-downloads.json` に連結
3. データ加工（`scripts/process-data/integration.sh`）
   - `process_npm_downloads`
     - 全日次を合算し `processed-data/npm-downloads.json`（`{ npm_download_count: <sum> }`）
   - `process_github_star`
     - `stargazerCount` を抽出し `processed-data/github-star.json`（`{ github_star_count: <value> }`）
   - 加工結果の統合を `processed-data/integrated-processed-data.json` に出力（`meta` と `data` を整形）
4. 貢献度算出（`scripts/calc-contrib/integration.sh`）
   - `contribution_point = npm_download_count * per_install + github_star_count * per_star`
   - JSON を `calc-contrib/result.json`、CSV を `calc-contrib/result.csv` に出力
   - CSV ヘッダ:
     - `contribution_point,npm_download_value,npm_download_point,github_star_value,github_star_point`

---

## 注意事項/制限

- 期間指定は未実装（全期間）。必要に応じて加工層で期間フィルタを追加。
- GitHub は `gh` の認証が必要で、レート制限に留意。
- npm API の区間上限により分割取得。加工時に重複は合算で解消。
  - 1 回のクエリで 18 か月分しか取得できない
  - 漏れないように 17 ヶ月ごとに日付をイテレートして取得する。
