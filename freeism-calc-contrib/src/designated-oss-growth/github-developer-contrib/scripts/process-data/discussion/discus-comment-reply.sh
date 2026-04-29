#!/bin/bash

#--------------------------------------
# discussionへのコメントにリプライした人のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_DISCUSSION_COMMENT_REPLY_PATH="${RESULT_PROCESSED_DISCUSSION_DIR}/result-discus-comment-reply.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_DISCUSSION_COMMENT_REPLY_PATH")"

#--------------------------------------
# discussionへのコメントにリプライした人のデータを加工する関数
#--------------------------------------
function process_discussion_comment_reply() {

  printf '%s\n' "begin:process_discussion_comment_reply()"

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    letter_count:   ($obj.bodyText? // "" | length),
    task_start: $obj.node_publishedAt,
    # 👎だけbad、それ以外はgoodに計上 + Discussionsのupvoteも合算
    good_reaction:
      ((
        ( $obj.reactionGroups? // [] )
        | map(
            if (.content // "") == "THUMBS_DOWN"
            then 0
            else (.reactors.totalCount // 0)
            end
          )
        | add // 0
      )
      + ($obj.upvoteCount // 0)),

    bad_reaction:
      (
        ( $obj.reactionGroups? // [] )
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
    --input-path "$RESULT_GET_DISCUSSION_COMMENT_REPLY_NODE_ID_PATH" \
    --output-path "$RESULT_PROCESSED_DISCUSSION_COMMENT_REPLY_PATH" \
    --task-name "comment" \
    --task-date "publishedAt" \
    --author-field "author" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_discussion_comment_reply()"

  return 0
}
