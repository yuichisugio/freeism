#!/bin/bash

#--------------------------------------
# issueの作成者のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_ISSUE_NODE_ID_PATH="${RESULT_PROCESSED_ISSUE_DIR}/result-issue-node-id.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_ISSUE_NODE_ID_PATH")"

#--------------------------------------
# issueの作成者のデータを加工する関数
#--------------------------------------
function process_issue_node_id() {

  printf '%s\n' "begin:process_issue_node_id()"

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    letter_count:
      (
        ($obj.title? // "" | length) + ($obj.bodyText? // "" | length)
      ),

    # OPEN, CLOSED_RESOLVED, CLOSED_DUPLICATE, CLOSED_NOT_PLANNED, CLOSED_REOPENED
    state:
      (
        ($obj.state // "") as $s
        | ($obj.stateReason // "") as $r
        | if $s == "OPEN"
            then $s
            else "CLOSED_" + $r
          end
      ),

    node_url: $obj.node_url,

    good_reaction:
      (
        ( $obj.reactionGroups? // [] )
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
    --input-path "$RESULT_GET_ISSUE_NODE_ID_PATH" \
    --output-path "$RESULT_PROCESSED_ISSUE_NODE_ID_PATH" \
    --task-name "create_issue" \
    --task-date "publishedAt" \
    --author-field "author" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_issue_node_id()"

  return 0
}
