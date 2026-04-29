#!/bin/bash

#--------------------------------------
# star関連のデータ取得を行うファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RESULT_GET_STAR_DIR="${OUTPUT_GET_DIR}/star"
readonly RAW_GET_STAR_PATH="${RESULT_GET_STAR_DIR}/raw-star.jsonl"
readonly RESULT_GET_GITHUB_STAR_PATH="${RESULT_GET_STAR_DIR}/result-star.json"

mkdir -p "$RESULT_GET_STAR_DIR"

#--------------------------------------
# スターのデータを取得する関数
#--------------------------------------
function get_star() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-star()")"

  local QUERY

  # GraphQL クエリ
  # shellcheck disable=SC2016
  QUERY='
    query($owner: String!, $name: String!, $endCursor: String, $perPage: Int!) {
      repository(owner: $owner, name: $name) {
        stargazers(first: $perPage, after:$endCursor, orderBy:{field: STARRED_AT, direction: ASC}) {
          totalCount
          pageInfo { hasNextPage endCursor }
          edges {
            starredAt
            node {
              id
              databaseId
              login
              name
              url
            }
          }
        }
      }
    }
  '

  # クエリを実行。node_id単位でページネーションしながら取得
  get_paginated_star_data \
    "$QUERY" \
    "$RAW_GET_STAR_PATH" \
    "$RESULT_GET_GITHUB_STAR_PATH"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-star()" \
    "$before_remaining_ratelimit" \
    "false"
}
