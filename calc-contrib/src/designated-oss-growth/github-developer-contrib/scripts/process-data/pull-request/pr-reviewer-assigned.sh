#!/bin/bash

#--------------------------------------
# pull-requestのレビュー担当者をアサインした人のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_PR_REVIEWER_ASSIGNED_PATH="${RESULT_PROCESSED_PR_DIR}/result-pr-reviewer-assigned.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_PR_REVIEWER_ASSIGNED_PATH")"

#--------------------------------------
# pull-requestのレビュー担当者をアサインした人のデータを加工する関数
#--------------------------------------
function process_pr_reviewer_assigned() {
  
  printf '%s\n' "begin:process_pr_reviewer_assigned()"

  # shellcheck disable=SC2016
  local FIRST_OTHER_QUERY='
    {
      data: {
        user: (
          [
            (
              # 1: 対象となるイベントだけ残す（review request の付与/解除）
              [ .[]?
                | select(
                    ((.__typename? // "") == "ReviewRequestedEvent" or
                    (.__typename? // "") == "ReviewRequestRemovedEvent")
                    and (.requestedReviewer?.id?)      # reviewer が特定できるものだけ
                  )
              ]

              # 2: PR × reviewer ごとに時系列で評価できるよう並べ替え
              | sort_by(
                  [
                    .node_id, 
                    (.requestedReviewer.id // ""), 
                    ((.createdAt // "1970-01-01T00:00:00Z") | fromdateiso8601)
                  ]
                )

              # 3: PR × reviewer でグルーピングし、各グループの「最後のイベント」を取得
              | group_by([.node_id, (.requestedReviewer.id // "")])
              | map( max_by((.createdAt // "1970-01-01T00:00:00Z") | fromdateiso8601) )

              # 4: 最新が付与イベントのもの＝現在も依頼が残っている reviewer だけ残す
              | map( select((.__typename? // "") == "ReviewRequestedEvent") )
              | .[]
            )
            | . as $obj
            | .actor as $author
  '

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    pr_node_id:            $obj.node_id,
    pr_node_url:           $obj.node_url,
    reviewer_id:           $obj.requestedReviewer.id,
    reviewer_login:        ($obj.requestedReviewer.login // null),
    reviewer_name:         ($obj.requestedReviewer.name  // null),
    reviewer_url:          ($obj.requestedReviewer.url   // null),
    task_start: $obj.node_publishedAt
  '

  process_data_utils \
    --input-path "$RESULT_GET_PR_TIMELINE_PATH" \
    --output-path "$RESULT_PROCESSED_PR_REVIEWER_ASSIGNED_PATH" \
    --task-name "assigning" \
    --task-date "createdAt" \
    --author-field "actor" \
    --first-other-query "$FIRST_OTHER_QUERY" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_pr_reviewer_assigned()"

  return 0
}
