#!/bin/bash

#--------------------------------------
# fork関連のデータ取得を行うファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RESULT_GET_FORK_DIR="${OUTPUT_GET_DIR}/fork"
readonly RAW_GET_FORK_PATH="${RESULT_GET_FORK_DIR}/raw-fork.jsonl"
readonly RESULT_GET_FORK_PATH="${RESULT_GET_FORK_DIR}/result-fork.json"

mkdir -p "$RESULT_GET_FORK_DIR"

#--------------------------------------
# fork関連のデータ取得を行う関数
#--------------------------------------
function get_fork() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-fork()")"

  local QUERY

  # GraphQL クエリ
  # shellcheck disable=SC2016
  QUERY='
    query($owner: String!, $name: String!, $endCursor: String) {
      repository(owner: $owner, name: $name) {
        forks(first: 50, after: $endCursor, orderBy: { field: CREATED_AT, direction: ASC }) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            databaseId
            createdAt
            owner {
              __typename
              ... on Organization { databaseId id login name url }
              ... on User { databaseId id login name url }
            }
          }
        }
      }
    }
  '

  # クエリを実行。node_id単位でページネーションしながら取得
  get_paginated_repository_data \
    "$QUERY" \
    "$RAW_GET_FORK_PATH" \
    "$RESULT_GET_FORK_PATH" \
    "forks" \
    "createdAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-fork()" \
    "$before_remaining_ratelimit" \
    "false"
}
