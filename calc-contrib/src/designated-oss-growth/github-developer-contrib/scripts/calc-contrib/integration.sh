#!/bin/bash

#--------------------------------------
# 貢献度を算出する処理を統合するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly OUTPUT_CALC_CONTRIB_DIR="${OUTPUT_DIR}/calc-contrib"
readonly OUTPUT_CALC_CONTRIB_SIMPLE_JSON_PATH="${OUTPUT_CALC_CONTRIB_DIR}/result-simple.json"
readonly OUTPUT_CALC_CONTRIB_VERBOSE_JSON_PATH="${OUTPUT_CALC_CONTRIB_DIR}/result-verbose.json"
readonly OUTPUT_CALC_CONTRIB_SIMPLE_CSV_PATH="${OUTPUT_CALC_CONTRIB_DIR}/result-simple.csv"

mkdir -p "$(dirname "$OUTPUT_CALC_CONTRIB_SIMPLE_JSON_PATH")"

#--------------------------------------
# 使用するファイルを読み込む
#--------------------------------------
readonly CALC_CONTRIB_DIR="${SCRIPT_DIR}/scripts/calc-contrib"
source "${CALC_CONTRIB_DIR}/calc-contrib-utils.sh"
source "${CALC_CONTRIB_DIR}/star.sh"
source "${CALC_CONTRIB_DIR}/fork.sh"
source "${CALC_CONTRIB_DIR}/sponsor.sh"
source "${CALC_CONTRIB_DIR}/watch.sh"
source "${CALC_CONTRIB_DIR}/pr-review.sh"
source "${CALC_CONTRIB_DIR}/create-pull-request.sh"
source "${CALC_CONTRIB_DIR}/create-issue.sh"
source "${CALC_CONTRIB_DIR}/create-release.sh"
source "${CALC_CONTRIB_DIR}/create-commit-with-pr.sh"
source "${CALC_CONTRIB_DIR}/create-discussion.sh"
source "${CALC_CONTRIB_DIR}/change-issue-state.sh"
source "${CALC_CONTRIB_DIR}/change-pull-request-state.sh"
source "${CALC_CONTRIB_DIR}/answer-discussion.sh"
source "${CALC_CONTRIB_DIR}/assigning.sh"
source "${CALC_CONTRIB_DIR}/labeling.sh"
source "${CALC_CONTRIB_DIR}/comment.sh"
source "${CALC_CONTRIB_DIR}/reaction.sh"

#--------------------------------------
# 貢献度の算出の処理を統合する関数
#--------------------------------------
function calc_contrib() {

  printf '%s\n' "begin:calc_contrib()"

  # 元のjsonをコピーして追記するjsonファイルを作成する。
  cp "$RESULT_PROCESSED_INTEGRATED_DATA_PATH" "$OUTPUT_CALC_CONTRIB_VERBOSE_JSON_PATH"

  # 確認するタスクの名前を配列に格納
  local task_name_array=(
    "watch"
    "star"
    "fork"
    "sponsor"
    "pr_review"
    "create_pull_request"
    "create_issue"
    "create_release"
    "create_commit_with_pr"
    "create_discussion"
    "change_issue_state"
    "change_pull_request_state"
    "answer_discussion"
    "comment"
    "reaction"
    "labeling"
    "assigning"
  )

  # 各タスクの貢献度を算出。毎回同じjsonにタスクごとに繰り返して追記していく。
  # なので、inputとoutputは同じPATH。
  for task_name in "${task_name_array[@]}"; do
    calc_"$task_name"
  done

  # 各ユーザーの貢献度を合算
  sum_contributions_by_user \
    --input-path "$OUTPUT_CALC_CONTRIB_VERBOSE_JSON_PATH" \
    --output-path "$OUTPUT_CALC_CONTRIB_VERBOSE_JSON_PATH"

  # タスクを削除したバージョンも作成
  exclude_task \
    --input-path "$OUTPUT_CALC_CONTRIB_VERBOSE_JSON_PATH" \
    --output-path "$OUTPUT_CALC_CONTRIB_SIMPLE_JSON_PATH"

  # CSV形式に変換。simple
  convert_to_csv \
    --input-path "$OUTPUT_CALC_CONTRIB_SIMPLE_JSON_PATH" \
    --output-path "$OUTPUT_CALC_CONTRIB_SIMPLE_CSV_PATH"

  printf '%s\n' "end:calc_contrib()"

  return 0
}
