#!/bin/bash

#--------------------------------------
# starのデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_STAR_PATH="${OUTPUT_PROCESSED_DIR}/star/result-star.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_STAR_PATH")"

#--------------------------------------
# starのデータを加工する関数
#--------------------------------------
function process_star() {

  printf '%s\n' "begin:process_star()"

  process_data_utils \
    --input-path "$RESULT_GET_GITHUB_STAR_PATH" \
    --output-path "$RESULT_PROCESSED_STAR_PATH" \
    --task-name "star" \
    --task-date "starredAt" \
    --author-field "node"

  printf '%s\n' "end:process_star()"

  return 0
}
