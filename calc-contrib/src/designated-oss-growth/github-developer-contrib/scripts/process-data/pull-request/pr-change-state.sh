#!/bin/bash

#--------------------------------------
# pull-requestのステータスを変更した人のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_PR_CHANGE_STATE_PATH="${RESULT_PROCESSED_PR_DIR}/result-pr-change-state.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_PR_CHANGE_STATE_PATH")"

#--------------------------------------
# pull-requestのステータスを変更した人のデータを加工する関数
#--------------------------------------
function process_pr_change_state() {

  printf '%s\n' "begin:process_pr_change_state()"

  # shellcheck disable=SC2016
  local FIRST_OTHER_QUERY='
    {
      data: {
        user: (
          [
            (
              # ClosedEventのみ残す
              [ .[]? | select((.__typename? // "") == "ClosedEvent") ]
              # group_by の前にキーでソート
              | sort_by(.node_id)
              # node_id ごとにグルーピング
              | group_by(.node_id)
              # 各グループの最新だけ残す
              | map( max_by(.createdAt | fromdateiso8601) )
              | .[]
            )
            | . as $obj
            | .actor as $author
  '

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    task_start: $obj.node_publishedAt,
    letter_count:(
      ( $obj.node_title? // "" | length )
      + ( $obj.node_bodyText? // "" | length )
    ),
    lines_of_code:(
      ( $obj.node_additions? // 0 ) + ( $obj.node_deletions? // 0 )
    )
  '

  process_data_utils \
    --input-path "$RESULT_GET_PR_TIMELINE_PATH" \
    --output-path "$RESULT_PROCESSED_PR_CHANGE_STATE_PATH" \
    --task-name "change_pull_request_state" \
    --task-date "createdAt" \
    --author-field "actor" \
    --first-other-query "$FIRST_OTHER_QUERY" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_pr_change_state()"

  return 0
}
