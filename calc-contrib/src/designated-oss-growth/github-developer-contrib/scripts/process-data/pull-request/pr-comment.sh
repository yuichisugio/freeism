#!/bin/bash

#--------------------------------------
# pull-requestのコメントした人のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_PR_COMMENT_PATH="${RESULT_PROCESSED_PR_DIR}/result-pr-comment.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_PR_COMMENT_PATH")"

#--------------------------------------
# pull-requestのコメントした人のデータを加工する関数
#--------------------------------------
function process_pr_comment() {

  printf '%s\n' "begin:process_pr_comment()"

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    letter_count:   ($obj.bodyText? // "" | length),
    task_start: $obj.node_publishedAt,
    good_reaction:
      (
        ($obj.reactionGroups? // [] )
        | map(
          if (.content // "") == "THUMBS_DOWN"
            then 0
            else (.reactors.totalCount // 0)
            end
          )
        | add // 0
      ),

    bad_reaction:
      (
        ($obj.reactionGroups? // [] )
        | map(
            if (.content // "") == "THUMBS_DOWN"
            then (.reactors.totalCount // 0)
            else 0
            end
          )
        | add // 0
      )
  '

  process_data_utils \
    --input-path "$RESULT_GET_PR_COMMENT_NODE_ID_PATH" \
    --output-path "$RESULT_PROCESSED_PR_COMMENT_PATH" \
    --task-name "comment" \
    --task-date "publishedAt" \
    --author-field "author" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_pr_comment()"

  return 0
}
