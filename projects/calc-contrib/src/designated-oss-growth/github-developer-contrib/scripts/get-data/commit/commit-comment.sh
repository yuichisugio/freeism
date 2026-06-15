#!/bin/bash

#--------------------------------------
# コミットのコメントを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RAW_COMMIT_COMMENT_PATH="${RESULT_GET_COMMIT_DIR}/raw-commit-comment.jsonl"

#--------------------------------------
# コミットのコメントを取得する関数
#--------------------------------------
function get_commit_comment() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-commit-comment()")"

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        ... on Commit {
          id
          oid
          abbreviatedOid
          url
          commitUrl
          authoredDate
          comments(first: $perPage, after:$endCursor) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              databaseId
              id
              url
              body
              bodyText
              publishedAt
              reactionGroups { content reactors { totalCount } }
              author {
                __typename
                ... on User { databaseId id login name url }
                ... on Bot { databaseId id login url }
                ... on Mannequin { databaseId id login name url }
                ... on Organization { databaseId id login name url }
                ... on EnterpriseUserAccount { user { databaseId id login name url } }
              }
              reactions(first:1) {
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
    "$RAW_COMMIT_COMMENT_PATH" \
    "$RESULT_GET_COMMIT_COMMENT_PATH" \
    "comments" \
    "$RESULT_GET_COMMIT_NODE_ID_WITH_PR_PATH" \
    "publishedAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-commit-comment()" \
    "$before_remaining_ratelimit" \
    "false"
}
