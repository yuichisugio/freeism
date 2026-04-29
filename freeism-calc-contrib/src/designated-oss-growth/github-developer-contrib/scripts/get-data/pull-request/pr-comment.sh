#!/bin/bash

#--------------------------------------
# pull requestのコメントを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# プルリクエストのコメントを取得する関数
#--------------------------------------
function get_pull_request_comment() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-pull-request-comment()")"

  local QUERY
  local RAW_PATH="${RESULT_GET_PR_DIR}/raw-pr-comment.jsonl"

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        __typename
        ... on PullRequest{
          id
          number
          url
          publishedAt
          comments(first: $perPage, after: $endCursor){
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              fullDatabaseId
              databaseId
              id
              url
              author { 
                __typename
                ... on User { databaseId id login name url }
                ... on Bot { databaseId id login url }
                ... on Mannequin { databaseId id login name url }
                ... on Organization { databaseId id login name url }
                ... on EnterpriseUserAccount { user { databaseId id login name url } }
              }
              bodyText
              publishedAt
              reactionGroups { content reactors { totalCount } }
              reactions(first: 1){
                totalCount
              }
            }
          }
        }
      }
    }
  '

  # クエリを実行。node_id単位でページネーションしながら取得
  get_paginated_data_by_node_id \
    "$QUERY" \
    "$RAW_PATH" \
    "$RESULT_GET_PR_COMMENT_NODE_ID_PATH" \
    "comments" \
    "$RESULT_GET_PR_NODE_ID_PATH" \
    "publishedAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-pull-request-comment()" \
    "$before_remaining_ratelimit" \
    "false"
}
