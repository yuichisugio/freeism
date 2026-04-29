#!/bin/bash

#--------------------------------------
# discussionのanswerを作成した人のデータを加工するファイル
# answerはdiscussionの議題に対する回答であり、コメントの一種
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_DISCUSSION_ANSWER_PATH="${RESULT_PROCESSED_DISCUSSION_DIR}/result-discus-answer.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_DISCUSSION_ANSWER_PATH")"

#--------------------------------------
# discussionのanswerを作成した人を評価する関数
#--------------------------------------
function process_discussion_answer() {

  printf '%s\n' "begin:process_discussion_answer()"

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    letter_count: ($obj.bodyText? // "" | length),
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
    --input-path "$RESULT_GET_DISCUSSION_ANSWER_NODE_ID_PATH" \
    --output-path "$RESULT_PROCESSED_DISCUSSION_ANSWER_PATH" \
    --task-name "$ANSWER_TASK_NAME" \
    --task-date "publishedAt" \
    --author-field "author" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_discussion_answer()"

  return 0
}
