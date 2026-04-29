#!/bin/bash

#--------------------------------------
# pull requestのレビューを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# プルリクエストのレビューを取得する関数
#--------------------------------------
function get_pull_request_review() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-pull-request-review()")"

  local QUERY
  local RAW_PATH="${RESULT_GET_PR_DIR}/raw-pr-review.jsonl"

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        __typename
        ... on PullRequest{
          id
          fullDatabaseId
          number
          url
          permalink
          additions
          deletions
          title
          bodyText
          publishedAt
          reviews(first: $perPage, after: $endCursor){
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              fullDatabaseId
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
              state
              publishedAt
              reactionGroups { content reactors { totalCount } }
              reactions(first: 1){ totalCount }
              comments(first: 1){ totalCount }
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
    "$RESULT_GET_PR_REVIEW_NODE_ID_PATH" \
    "reviews" \
    "$RESULT_GET_PR_NODE_ID_PATH" \
    "publishedAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-pull-request-review()" \
    "$before_remaining_ratelimit" \
    "false"
}
