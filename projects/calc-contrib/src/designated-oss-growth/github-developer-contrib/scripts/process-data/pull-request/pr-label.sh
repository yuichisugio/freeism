#!/bin/bash

#--------------------------------------
# pull-requestのラベル付けした人のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_PR_LABEL_PATH="${RESULT_PROCESSED_PR_DIR}/result-pr-label.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_PR_LABEL_PATH")"

#--------------------------------------
# pull-requestのラベル付けした人のデータを加工する関数
#--------------------------------------
function process_pr_label() {

  printf '%s\n' "begin:process_pr_label()"

  process_data_utils_by_two_files \
    --input-now-path "$RESULT_GET_PR_NOW_LABEL_PATH" \
    --input-timeline-path "$RESULT_GET_PR_TIMELINE_PATH" \
    --output-path "$RESULT_PROCESSED_PR_LABEL_PATH" \
    --event-type "LabeledEvent" \
    --nest-event-field "label" \
    --task-name "labeling" \
    --task-date "createdAt" \

  printf '%s\n' "end:process_pr_label()"

  return 0
}
