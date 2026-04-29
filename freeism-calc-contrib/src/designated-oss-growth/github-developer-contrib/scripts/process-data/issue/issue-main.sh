#!/bin/bash

#--------------------------------------
# issueのデータ加工を統合するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RESULT_PROCESSED_ISSUE_DIR="${OUTPUT_PROCESSED_DIR}/issue"
mkdir -p "$RESULT_PROCESSED_ISSUE_DIR"

#--------------------------------------
# 使用するファイルを読み込む
#--------------------------------------
readonly PROCESS_ISSUE_DIR="${PROCESS_DIR}/issue"
source "${PROCESS_ISSUE_DIR}/issue-node-id.sh"
source "${PROCESS_ISSUE_DIR}/issue-assigned.sh"
source "${PROCESS_ISSUE_DIR}/issue-label.sh"
source "${PROCESS_ISSUE_DIR}/issue-comment.sh"
source "${PROCESS_ISSUE_DIR}/issue-comment-reaction.sh"
source "${PROCESS_ISSUE_DIR}/issue-reaction.sh"
source "${PROCESS_ISSUE_DIR}/issue-change-state.sh"

#--------------------------------------
# issueのデータを加工する関数
#--------------------------------------
function process_issue() {

  printf '%s\n' "begin:process-issue()"

  # issueの作成者を評価
  process_issue_node_id

  # issueのコメントした人を評価
  process_issue_comment

  # issueのコメントにリアクションした人を評価
  process_issue_comment_reaction

  # issueのリアクションを評価
  process_issue_reaction

  # issueの担当者をアサインした人を評価
  process_issue_assigned

  # issueのラベル付けした人を評価
  process_issue_label

  # issueのステータスを変更した人を評価
  process_issue_change_state

  printf '%s\n' "end:process-issue()"

  return 0
}
