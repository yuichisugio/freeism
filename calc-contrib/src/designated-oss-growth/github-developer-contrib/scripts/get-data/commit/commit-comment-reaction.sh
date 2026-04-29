#!/bin/bash

#--------------------------------------
# コミットのコメントのリアクションを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RAW_GET_COMMIT_COMMENT_REACTION_PATH="${RESULT_GET_COMMIT_DIR}/raw-commit-comment-reaction.jsonl"
readonly RESULT_GET_COMMIT_COMMENT_REACTION_PATH="${RESULT_GET_COMMIT_DIR}/result-commit-comment-reaction.json"
mkdir -p "$(dirname "$RESULT_GET_COMMIT_COMMENT_REACTION_PATH")"

#--------------------------------------
# コミットのコメントのリアクションを取得する関数
#--------------------------------------
function get_commit_comment_reaction() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-commit-comment-reaction()")"

  local QUERY

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        ... on CommitComment {
          id
          databaseId
          url
          body
          publishedAt
          reactions(first: $perPage, after:$endCursor) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              databaseId
              id
              content
              createdAt
              user { __typename databaseId id login name url }
            }
          }
        }
      }
    }
  '

  # クエリを実行。node_id単位でページネーションしながら取得
  get_paginated_data_by_node_id \
    "$QUERY" \
    "$RAW_GET_COMMIT_COMMENT_REACTION_PATH" \
    "$RESULT_GET_COMMIT_COMMENT_REACTION_PATH" \
    "reactions" \
    "$RESULT_GET_COMMIT_COMMENT_PATH" \
    "createdAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-commit-comment-reaction()" \
    "$before_remaining_ratelimit" \
    "false"
}
