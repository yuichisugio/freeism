#!/bin/bash

#--------------------------------------
# プルリクエストのレビューへのコメントにリアクションした人のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_PR_REVIEW_COMMENT_REACTION_PATH="${RESULT_PROCESSED_PR_DIR}/result-pr-review-comment-reaction.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_PR_REVIEW_COMMENT_REACTION_PATH")"

#--------------------------------------
# プルリクエストのレビューへのコメントにリアクションした人のデータを加工する関数
#--------------------------------------
function process_pr_review_comment_reaction() {

  printf '%s\n' "begin:process_pr_review_comment_reaction()"

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    task_start: $obj.node_publishedAt
  '

  process_data_utils \
    --input-path "$RESULT_GET_PR_REVIEW_COMMENT_REACTION_PATH" \
    --output-path "$RESULT_PROCESSED_PR_REVIEW_COMMENT_REACTION_PATH" \
    --task-name "reaction" \
    --task-date "createdAt" \
    --author-field "user" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_pr_review_comment_reaction()"

  return 0
}
