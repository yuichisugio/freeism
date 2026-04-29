#!/bin/bash

# --------------------------------------
# GitHub starのデータを加工するファイル
# --------------------------------------

set -euo pipefail

# --------------------------------------
# 出力先のファイルを定義
# --------------------------------------
readonly OUTPUT_PROCESSED_GITHUB_STAR_PATH="${OUTPUT_PROCESSED_DIR}/github-star.json"

#--------------------------------------
# GitHub starのデータを加工する関数
#--------------------------------------
function process_github_star() {

  printf '%s\n' "begin:process_github_star()"

  jq \
    '
    {
      github_star_count: .data.repository.stargazerCount
    }
    ' \
    "$OUTPUT_GET_GITHUB_STAR_PATH" >"$OUTPUT_PROCESSED_GITHUB_STAR_PATH"

  printf '%s\n' "end:process_github_star()"
}

# 一旦は、GitHubのインサイト取得に集中するつもりなので実装しない
