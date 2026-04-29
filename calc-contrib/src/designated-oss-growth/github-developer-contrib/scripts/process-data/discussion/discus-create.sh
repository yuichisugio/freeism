#!/bin/bash

#--------------------------------------
# discussionの作成者のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_DISCUSSION_CREATE_PATH="${RESULT_PROCESSED_DISCUSSION_DIR}/result-discus-create.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_DISCUSSION_CREATE_PATH")"

#--------------------------------------
# discussionの作成者を評価する関数
#--------------------------------------
function process_discussion_create() {

  printf '%s\n' "begin:process_discussion_create()"

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    state:
      (
        if ($obj.closed // false)
          then "CLOSED_" + ($obj.stateReason? // "")
          else "OPEN"
        end
      ),

    letter_count:
      (
        ($obj.title? // "" | length) + ($obj.bodyText? // "" | length)
      ),

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
    --input-path "$RESULT_GET_DISCUSSION_NODE_ID_PATH" \
    --output-path "$RESULT_PROCESSED_DISCUSSION_CREATE_PATH" \
    --task-name "create_discussion" \
    --task-date "publishedAt" \
    --author-field "author" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_discussion_create()"

  return 0
}
