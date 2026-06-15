#!/bin/bash

#--------------------------------------
# pull requestのレビューのコメントを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# プルリクエストのレビューのコメントを取得する関数
#--------------------------------------
function get_pull_request_review_comment() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-pull-request-review-comment()")"

  local QUERY
  local RAW_PATH="${RESULT_GET_PR_DIR}/raw-pr-review-comment.jsonl"
  local RESULT_PATH="${RESULT_GET_PR_DIR}/result-pr-review-comment.json"

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        __typename
        ... on PullRequestReview {
          id
          url
          comments(first: $perPage, after: $endCursor){
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
              publishedAt
              reactionGroups { content reactors { totalCount } }
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
    "$RESULT_PATH" \
    "comments" \
    "$RESULT_GET_PR_REVIEW_NODE_ID_PATH" \
    "createdAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-pull-request-review-comment()" \
    "$before_remaining_ratelimit" \
    "false"
}
