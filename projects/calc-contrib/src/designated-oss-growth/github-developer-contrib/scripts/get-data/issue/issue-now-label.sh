#!/bin/bash

#--------------------------------------
# issueの現在のラベルを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RAW_GET_ISSUE_NOW_LABEL_PATH="${RESULT_GET_ISSUE_DIR}/raw-issue-now-label.jsonl"
readonly RESULT_GET_ISSUE_NOW_LABEL_PATH="${RESULT_GET_ISSUE_DIR}/result-issue-now-label.json"
mkdir -p "$(dirname "$RESULT_GET_ISSUE_NOW_LABEL_PATH")"


#--------------------------------------
# issueの現在のラベルを取得する関数
#--------------------------------------
function get_issue_now_label() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-issue-now-label()")"

  local QUERY

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        __typename
        ... on Issue{
          id
          fullDatabaseId
          databaseId
          number
          url
          title
          state
          publishedAt
          labels(first: $perPage, after: $endCursor, orderBy: {field: CREATED_AT, direction: ASC}) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes { 
              id
              url
              name
              description
            }
          }
        }
      }
    }
  '

  # クエリを実行。node_id単位でページネーションしながら取得
  get_paginated_data_by_node_id \
    "$QUERY" \
    "$RAW_GET_ISSUE_NOW_LABEL_PATH" \
    "$RESULT_GET_ISSUE_NOW_LABEL_PATH" \
    "labels" \
    "$RESULT_GET_ISSUE_NODE_ID_PATH"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-issue-now-label()" \
    "$before_remaining_ratelimit" \
    "false"
}
