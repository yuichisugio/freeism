#!/bin/bash

#--------------------------------------
# pull-requestのコーダーをアサインした人のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_PR_CODER_ASSIGNED_PATH="${RESULT_PROCESSED_PR_DIR}/result-pr-coder-assigned.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_PR_CODER_ASSIGNED_PATH")"

#--------------------------------------
# pull-requestのコーダーをアサインした人のデータを加工する関数
#--------------------------------------
function process_pr_coder_assigned() {

  printf '%s\n' "begin:process_pr_coder_assigned()"

  process_data_utils_by_two_files \
    --input-now-path "$RESULT_GET_PR_NOW_ASSIGNED_ACTORS_PATH" \
    --input-timeline-path "$RESULT_GET_PR_TIMELINE_PATH" \
    --output-path "$RESULT_PROCESSED_PR_CODER_ASSIGNED_PATH" \
    --event-type "AssignedEvent" \
    --nest-event-field "assignee" \
    --task-name "assigning" \
    --task-date "createdAt"

  printf '%s\n' "end:process_pr_coder_assigned()"

  return 0
}
