#!/bin/bash

#--------------------------------------
# watchのデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_WATCH_PATH="${OUTPUT_PROCESSED_DIR}/watch/result-watch.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_WATCH_PATH")"

#--------------------------------------
# watchのデータを加工する関数
#--------------------------------------
function process_watch() {

  printf '%s\n' "begin:process_watch()"

  process_data_utils \
    --input-path "$RESULT_GET_WATCH_PATH" \
    --output-path "$RESULT_PROCESSED_WATCH_PATH" \
    --task-name "watch" \
    --task-date "null" \
    --author-field "author"

  printf '%s\n' "end:process_watch()"

  return 0
}
