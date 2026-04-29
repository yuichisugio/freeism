#!/bin/bash

#--------------------------------------
# forkのデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_FORK_PATH="${OUTPUT_PROCESSED_DIR}/fork/result-fork.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_FORK_PATH")"

#--------------------------------------
# forkのデータを加工する関数
#--------------------------------------
function process_fork() {

  printf '%s\n' "begin:process_fork()"

  process_data_utils \
    --input-path "$RESULT_GET_FORK_PATH" \
    --output-path "$RESULT_PROCESSED_FORK_PATH" \
    --task-name "fork" \
    --task-date "createdAt" \
    --author-field "owner"

  printf '%s\n' "end:process_fork()"

  return 0
}
