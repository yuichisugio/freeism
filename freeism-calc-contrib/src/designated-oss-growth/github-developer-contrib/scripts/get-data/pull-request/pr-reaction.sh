#!/bin/bash

#--------------------------------------
# pull requestのリアクションを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RAW_GET_PR_REACTION_PATH="${RESULT_GET_PR_DIR}/raw-pr-reaction.jsonl"
readonly RESULT_GET_PR_REACTION_PATH="${RESULT_GET_PR_DIR}/result-pr-reaction.json"
mkdir -p "$(dirname "$RESULT_GET_PR_REACTION_PATH")"

#--------------------------------------
# プルリクエストのリアクションを取得する関数
#--------------------------------------
function get_pull_request_reaction() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-pull-request-reaction()")"

  local QUERY

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        __typename
        ... on PullRequest{
          id
          publishedAt
          reactions(first: $perPage, after: $endCursor){
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes { 
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
    "$RAW_GET_PR_REACTION_PATH" \
    "$RESULT_GET_PR_REACTION_PATH" \
    "reactions" \
    "$RESULT_GET_PR_NODE_ID_PATH" \
    "createdAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-pull-request-reaction()" \
    "$before_remaining_ratelimit" \
    "false"
}
