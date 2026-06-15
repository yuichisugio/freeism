#!/bin/bash

#--------------------------------------
# star関連のデータ取得を行うファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly OUTPUT_GET_GITHUB_STAR_PATH="${OUTPUT_GET_DIR}/github-star.json"

mkdir -p "$(dirname "$OUTPUT_GET_GITHUB_STAR_PATH")"

#--------------------------------------
# GitHubのOSSのstar数を取得する関数
#--------------------------------------
function get_github_star() {

  printf '%s\n' "begin:get_github_star()"

  # クエリを実行。
  # shellcheck disable=SC2016
  gh api graphql \
    -f owner="$GITHUB_OWNER" \
    -f name="$GITHUB_REPO" \
    -f query='
      query($owner:String!, $name:String!) {
        repository(owner:$owner, name:$name) {
          stargazerCount
        }
      }
    ' | jq '.' >"$OUTPUT_GET_GITHUB_STAR_PATH"

  printf '%s\n' "end:get_github_star()"
}
