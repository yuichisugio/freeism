#!/bin/bash

#--------------------------------------
# issueのラベル付けした人のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_ISSUE_LABEL_PATH="${RESULT_PROCESSED_ISSUE_DIR}/result-issue-label.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_ISSUE_LABEL_PATH")"

#--------------------------------------
# issueのラベル付けした人のデータを加工する関数
#--------------------------------------
function process_issue_label() {

  printf '%s\n' "begin:process_issue_label()"

  process_data_utils_by_two_files \
    --input-now-path "$RESULT_GET_ISSUE_NOW_LABEL_PATH" \
    --input-timeline-path "$RESULT_GET_ISSUE_TIMELINE_PATH" \
    --output-path "$RESULT_PROCESSED_ISSUE_LABEL_PATH" \
    --event-type "LabeledEvent" \
    --nest-event-field "label" \
    --task-name "labeling" \
    --task-date "createdAt"

  printf '%s\n' "end:process_issue_label()"

  return 0
}
