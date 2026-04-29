#!/bin/bash

#--------------------------------------
# discussionへのコメントにリプライにリアクションした人のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_DISCUSSION_COMMENT_REPLY_REACTION_PATH="${RESULT_PROCESSED_DISCUSSION_DIR}/result-discus-comment-reply-reaction.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_DISCUSSION_COMMENT_REPLY_REACTION_PATH")"

#--------------------------------------
# discussionへのコメントにリプライにリアクションした人のデータを加工する関数
#--------------------------------------
function process_discussion_comment_reply_reaction() {

  printf '%s\n' "begin:process_discussion_comment_reply_reaction()"

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    task_start: $obj.node_publishedAt
  '

  process_data_utils \
    --input-path "$RESULT_GET_DISCUSSION_COMMENT_REPLY_REACTION_PATH" \
    --output-path "$RESULT_PROCESSED_DISCUSSION_COMMENT_REPLY_REACTION_PATH" \
    --task-name "reaction" \
    --task-date "createdAt" \
    --author-field "user" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_discussion_comment_reply_reaction()"

  return 0
}
