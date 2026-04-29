#!/bin/bash

#--------------------------------------
# pull requestのタイムラインを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RAW_GET_PR_TIMELINE_PATH="${RESULT_GET_PR_DIR}/raw-pr-timeline.jsonl"
readonly RESULT_GET_PR_TIMELINE_PATH="${RESULT_GET_PR_DIR}/result-pr-timeline.json"
mkdir -p "$(dirname "$RESULT_GET_PR_TIMELINE_PATH")"

#--------------------------------------
# pull requestのタイムラインを取得する関数
#--------------------------------------
function get_pull_request_timeline() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-pull-request-timeline()")"

  local QUERY

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String, $since: DateTime!) {
      node(id: $node_id) {
        __typename
        ... on PullRequest{
          id
          fullDatabaseId
          number
          url
          state
          publishedAt
          title
          additions
          deletions
          bodyText
          timelineItems(
            first: $perPage, 
            after: $endCursor, 
            since: $since,
            itemTypes: [
              ASSIGNED_EVENT, 
              LABELED_EVENT, 
              REVIEW_REQUESTED_EVENT, 
              REVIEW_REQUEST_REMOVED_EVENT, 
              CLOSED_EVENT
            ]
          ) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              __typename
              ... on ReviewRequestRemovedEvent{
                id
                createdAt
                actor {# レビューを取り消した人（実行者）
                  __typename
                  ... on User { databaseId id login name url }
                  ... on Bot { databaseId id login url }
                  ... on Mannequin { databaseId id login name url }
                  ... on Organization { databaseId id login name url }
                  ... on EnterpriseUserAccount { user { databaseId id login name url } }
                }
                requestedReviewer{ # レビューを取り消された担当者
                  __typename
                  ... on User { databaseId id login name url }
                  ... on Bot { databaseId id login url }
                  ... on Mannequin { databaseId id login name url }
                  ... on Team { databaseId id name url }
                }
              }
              ... on ReviewRequestedEvent {
                id
                createdAt
                actor { # レビューをリクエストした人（実行者）
                  __typename
                  ... on User { databaseId id login name url }
                  ... on Bot { databaseId id login url }
                  ... on Mannequin { databaseId id login name url }
                  ... on Organization { databaseId id login name url }
                  ... on EnterpriseUserAccount { user { databaseId id login name url } }
                }
                requestedReviewer { # レビューをリクエストされた担当者
                  __typename
                  ... on User { databaseId id login name url }
                  ... on Bot { databaseId id login url }
                  ... on Mannequin { databaseId id login name url }
                  ... on Team { databaseId id name url }
                } 
              }
              ... on LabeledEvent {
                id
                createdAt
                label { 
                  id
                  url
                  name
                  description
                }
                actor { # ラベルを付けた人（実行者）
                  __typename
                  ... on User { databaseId id login name url }
                  ... on Bot { databaseId id login url }
                  ... on Mannequin { databaseId id login name url }
                  ... on Organization { databaseId id login name url }
                  ... on EnterpriseUserAccount { user { databaseId id login name url } }
                }
              }
              ... on ClosedEvent {
                id
                url
                createdAt
                actor { # クローズした人（実行者）
                  __typename
                  ... on User { databaseId id login name url }
                  ... on Bot { databaseId id login url }
                  ... on Mannequin { databaseId id login name url }
                  ... on Organization { databaseId id login name url }
                  ... on EnterpriseUserAccount { user { databaseId id login name url } }
                }
              }
              ... on AssignedEvent {
                id
                createdAt
                actor { # アサインした人（実行者）
                  __typename
                  ... on User { databaseId id login name url }
                  ... on Bot { databaseId id login url }
                  ... on Mannequin { databaseId id login name url }
                  ... on Organization { databaseId id login name url }
                  ... on EnterpriseUserAccount { user { databaseId id login name url } }
                }
                assignee { # アサインされた担当者
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
      }
    }
  '

  get_paginated_data_by_node_id \
    "$QUERY" \
    "$RAW_GET_PR_TIMELINE_PATH" \
    "$RESULT_GET_PR_TIMELINE_PATH" \
    "timelineItems" \
    "$RESULT_GET_PR_NODE_ID_PATH" \
    "createdAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-pull-request-timeline()" \
    "$before_remaining_ratelimit" \
    "false"
}
