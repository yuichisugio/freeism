#!/bin/bash

#--------------------------------------
# pull requestのデータ加工を統合するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RESULT_PROCESSED_PR_DIR="${OUTPUT_PROCESSED_DIR}/pull-request"
mkdir -p "$RESULT_PROCESSED_PR_DIR"

#--------------------------------------
# 使用するファイルを読み込む
#--------------------------------------
readonly PROCESS_PR_DIR="${PROCESS_DIR}/pull-request"
source "${PROCESS_PR_DIR}/pr-node-id.sh"
source "${PROCESS_PR_DIR}/pr-comment.sh"
source "${PROCESS_PR_DIR}/pr-comment-reaction.sh"
source "${PROCESS_PR_DIR}/pr-reaction.sh"
source "${PROCESS_PR_DIR}/pr-change-state.sh"
source "${PROCESS_PR_DIR}/pr-reviewer-assigned.sh"
source "${PROCESS_PR_DIR}/pr-label.sh"
source "${PROCESS_PR_DIR}/pr-coder-assigned.sh"
source "${PROCESS_PR_DIR}/pr-review.sh"
source "${PROCESS_PR_DIR}/pr-review-reaction.sh"
source "${PROCESS_PR_DIR}/pr-review-comment.sh"
source "${PROCESS_PR_DIR}/pr-review-comment-reaction.sh"

#--------------------------------------
# プルリクエストのデータを加工する関数
#--------------------------------------
function process_pull_request() {

  printf '%s\n' "begin:process-pull-request()"

  # MERGED以外のpull-requestの作成者を評価。MERGEDのPR作成者はcommit一覧で作成済み
  process_pr_node_id

  # プルリクエストのリアクションを評価
  process_pr_reaction

  # プルリクエストのレビュー担当者をアサインした人を評価
  process_pr_reviewer_assigned

  # プルリクエストのラベル付けした人を評価
  process_pr_label

  # プルリクエストのコメントした人を評価
  process_pr_comment

  # プルリクエストのコメントにリアクションした人を評価
  process_pr_comment_reaction

  # プルリクエストをレビューした人を評価
  process_pr_review

  # プルリクエストのレビューにリアクションした人を評価
  process_pr_review_reaction

  # プルリクエストのレビューコメントした人を評価
  process_pr_review_comment

  # プルリクエストのレビューコメントにリアクションした人を評価
  process_pr_review_comment_reaction

  # プルリクエストのステータスを変更した人を評価
  process_pr_change_state

  # プルリクエストの担当者をアサインした人を評価
  process_pr_coder_assigned

  printf '%s\n' "end:process-pull-request()"

  return 0
}
