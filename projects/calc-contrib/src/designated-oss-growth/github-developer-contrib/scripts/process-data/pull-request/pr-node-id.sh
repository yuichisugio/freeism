#!/bin/bash

#--------------------------------------
# プルリクエストの作成者のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_PR_NODE_ID_PATH="${RESULT_PROCESSED_PR_DIR}/result-pr-node-id.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_PR_NODE_ID_PATH")"

#--------------------------------------
# MERGED以外のpull-requestの作成者を評価する関数。MERGEDのPR作成者はcommit一覧で作成済み
#--------------------------------------
function process_pr_node_id() {

  printf '%s\n' "begin:process_pr_node_id()"

  # shellcheck disable=SC2016
  local FIRST_OTHER_QUERY='
    {
      data: {
        user: (
          [ .[]?
            | select((.state? // "") != "MERGED")
            | . as $obj
            | .author as $author
  '

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    letter_count:
      (
        ($obj.title? // "" | length) + ($obj.bodyText? // "" | length)
      ),
    record_count: (($obj.additions? // 0) + ($obj.deletions? // 0)),
    state: $obj.state,
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
    --input-path "$RESULT_GET_PR_NODE_ID_PATH" \
    --output-path "$RESULT_PROCESSED_PR_NODE_ID_PATH" \
    --task-name "create_pull_request" \
    --task-date "publishedAt" \
    --author-field "author" \
    --first-other-query "$FIRST_OTHER_QUERY" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_pr_node_id()"

  return 0
}
