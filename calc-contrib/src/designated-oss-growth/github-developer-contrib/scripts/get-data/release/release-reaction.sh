#!/bin/bash

#--------------------------------------
# リリースのリアクションを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_GET_RELEASE_REACTION_PATH="${RESULT_GET_RELEASE_DIR}/result-release-reaction.json"
mkdir -p "$(dirname "$RESULT_GET_RELEASE_REACTION_PATH")"

#--------------------------------------
# リリースのリアクションを取得する関数
#--------------------------------------
function get_release_reaction() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-release-reaction()")"

  local QUERY
  local RAW_PATH="${RESULT_GET_RELEASE_DIR}/raw-release-reaction.jsonl"

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        __typename
        ... on Release{
          databaseId
          id
          name
          description
          url
          publishedAt
          reactions(first: $perPage, after:$endCursor){
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
    "$RAW_PATH" \
    "$RESULT_GET_RELEASE_REACTION_PATH" \
    "reactions" \
    "$RESULT_GET_RELEASE_NODE_ID_PATH" \
    "createdAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-release-reaction()" \
    "$before_remaining_ratelimit" \
    "false"
}
