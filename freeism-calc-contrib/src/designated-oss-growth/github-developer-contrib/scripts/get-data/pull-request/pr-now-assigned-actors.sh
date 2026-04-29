#!/bin/bash

#--------------------------------------
# pull requestの現在の担当者を取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RAW_GET_PR_NOW_ASSIGNED_ACTORS_PATH="${RESULT_GET_PR_DIR}/raw-pr-now-assigned-actors.jsonl"
readonly RESULT_GET_PR_NOW_ASSIGNED_ACTORS_PATH="${RESULT_GET_PR_DIR}/result-pr-now-assigned-actors.json"
mkdir -p "$(dirname "$RESULT_GET_PR_NOW_ASSIGNED_ACTORS_PATH")"

#--------------------------------------
# pull requestの現在の担当者を取得する関数
#--------------------------------------
function get_pull_request_now_assigned_actors() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-pull-request-now-assigned-actors()")"

  local QUERY

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        __typename
        ... on PullRequest{
          id
          number
          url
          assignedActors(first: $perPage, after: $endCursor){
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              __typename
              ... on User { databaseId id login name url }
              ... on Bot { databaseId id login url }
              ... on Mannequin { databaseId id login name url }
              ... on Organization { databaseId id login name url }
            }
          }
        }
      }
    }
  '

  # クエリを実行。node_id単位でページネーションしながら取得
  get_paginated_data_by_node_id \
    "$QUERY" \
    "$RAW_GET_PR_NOW_ASSIGNED_ACTORS_PATH" \
    "$RESULT_GET_PR_NOW_ASSIGNED_ACTORS_PATH" \
    "assignedActors" \
    "$RESULT_GET_PR_NODE_ID_PATH"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-pull-request-now-assigned-actors()" \
    "$before_remaining_ratelimit" \
    "false"
}
