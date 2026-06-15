#!/bin/bash

#--------------------------------------
# issueのコメントのリアクションを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RAW_GET_ISSUE_COMMENT_REACTION_PATH="${RESULT_GET_ISSUE_DIR}/raw-issue-comment-reaction.jsonl"
readonly RESULT_GET_ISSUE_COMMENT_REACTION_PATH="${RESULT_GET_ISSUE_DIR}/result-issue-comment-reaction.json"
mkdir -p "$(dirname "$RESULT_GET_ISSUE_COMMENT_REACTION_PATH")"

#--------------------------------------
# issueのコメントのリアクションを取得する関数
#--------------------------------------
function get_issue_comment_reaction() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-issue-comment-reaction()")"

  local QUERY

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        __typename
        ... on IssueComment{
          id
          url
          publishedAt
          reactions(first: $perPage, after: $endCursor){
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes{ 
              databaseId
              id
              content
              createdAt
              user { databaseId id login name url }
            }
          }
        }
      }
    }
  '

  # クエリを実行。node_id単位でページネーションしながら取得
  get_paginated_data_by_node_id \
    "$QUERY" \
    "$RAW_GET_ISSUE_COMMENT_REACTION_PATH" \
    "$RESULT_GET_ISSUE_COMMENT_REACTION_PATH" \
    "reactions" \
    "$RESULT_GET_ISSUE_COMMENT_NODE_ID_PATH" \
    "createdAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-issue-comment-reaction()" \
    "$before_remaining_ratelimit" \
    "false"
}
