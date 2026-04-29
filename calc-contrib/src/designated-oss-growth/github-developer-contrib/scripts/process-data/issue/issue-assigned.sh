#!/bin/bash

#--------------------------------------
# issueの担当者をアサインした人のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_ISSUE_ASSIGNED_PATH="${RESULT_PROCESSED_ISSUE_DIR}/result-issue-assigned.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_ISSUE_ASSIGNED_PATH")"

#--------------------------------------
# issueの担当者をアサインした人のデータを加工する関数
#--------------------------------------
function process_issue_assigned() {

  printf '%s\n' "begin:process_issue_assigned()"

  process_data_utils_by_two_files \
    --input-now-path "$RESULT_GET_ISSUE_NOW_ASSIGNED_ACTORS_PATH" \
    --input-timeline-path "$RESULT_GET_ISSUE_TIMELINE_PATH" \
    --output-path "$RESULT_PROCESSED_ISSUE_ASSIGNED_PATH" \
    --event-type "AssignedEvent" \
    --nest-event-field "assignee" \
    --task-name "assigning" \
    --task-date "createdAt"

  printf '%s\n' "end:process_issue_assigned()"

  return 0
}
