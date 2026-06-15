#!/bin/bash

#--------------------------------------
# リリースのnode_idと各種フィールドのtotalCountを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# リリースのnode_idと各種フィールドのtotalCountを取得する関数
#--------------------------------------
function get_release_node_id() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-release-node-id()")"

  local QUERY
  local RAW_PATH="${RESULT_GET_RELEASE_DIR}/raw-release-node-id.jsonl"

  # shellcheck disable=SC2016
  QUERY='
    query(
      $owner: String!,
      $name: String!,
      $perPage: Int!,
      $endCursor: String
    ) {
      repository(owner:$owner, name:$name) {
        id
        databaseId
        createdAt
        name
        description
        homepageUrl
        url
        releases(first: $perPage, after:$endCursor, orderBy:{field: CREATED_AT, direction: ASC } ){
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            databaseId
            id
            name
            description
            url
            author {
              databaseId id login name url
            }
            publishedAt
            reactions(first: 1){
              totalCount
            }
          }
        }
      }
    }
  '

  # クエリを実行。
  get_paginated_repository_data \
    "$QUERY" \
    "$RAW_PATH" \
    "$RESULT_GET_RELEASE_NODE_ID_PATH" \
    "releases" \
    "publishedAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-release-node-id()" \
    "$before_remaining_ratelimit" \
    "false"
}
