#!/bin/bash

#--------------------------------------
# データ取得を統合するファイル
#--------------------------------------

set -euo pipefail

# --------------------------------------
# 出力先のディレクトリを作成する
# --------------------------------------
readonly OUTPUT_GET_DIR="${OUTPUT_DIR}/get-data"
mkdir -p "$OUTPUT_GET_DIR"

#--------------------------------------
# 使用するファイルを読み込む
#--------------------------------------
readonly GET_DIR="${SCRIPT_DIR}/scripts/get-data"
source "${GET_DIR}/github-star.sh"
source "${GET_DIR}/npm-downloads.sh"

#--------------------------------------
# データ取得を統合する関数
#--------------------------------------
function get_data() {

  printf '%s\n' "begin:get_data()"

  # GitHubのOSSメタデータを取得する。
  get_github_star

  # npmのダウンロード数を取得する。
  get_npm_downloads

  printf '%s\n' "end:get_data()"
}
