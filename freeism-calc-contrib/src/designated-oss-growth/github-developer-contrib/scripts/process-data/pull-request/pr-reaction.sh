#!/bin/bash

#--------------------------------------
# プルリクエストのリアクションした人のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_PR_REACTION_PATH="${RESULT_PROCESSED_PR_DIR}/result-pr-reaction.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_PR_REACTION_PATH")"

#--------------------------------------
# プルリクエストのリアクションした人のデータを加工する関数
#--------------------------------------
function process_pr_reaction() {

  printf '%s\n' "begin:process_pr_reaction()"

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    task_start: $obj.node_publishedAt
  '

  process_data_utils \
    --input-path "$RESULT_GET_PR_REACTION_PATH" \
    --output-path "$RESULT_PROCESSED_PR_REACTION_PATH" \
    --task-name "reaction" \
    --task-date "createdAt" \
    --author-field "user" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_pr_reaction()"

  return 0
}
