#!/bin/bash

#--------------------------------------
# issue関連のデータ取得を行うファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# issueのnode_idと各種フィールドのtotalCountを取得する関数
#--------------------------------------
function get_issue_node_id() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-issue-node-id()")"

  local QUERY
  local RAW_PATH="${RESULT_GET_ISSUE_DIR}/raw-issue-node-id.json"

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
        hasIssuesEnabled
        isBlankIssuesEnabled
        issueTemplates {
          about
          body
          filename
          name
          title
          type {
            id
            name
            description
            isEnabled
          }
        }
        issues( first: $perPage, after: $endCursor, orderBy:{field: CREATED_AT, direction: ASC } ){
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            id # node_id
            fullDatabaseId
            databaseId
            number
            url
            bodyUrl
            bodyText
            title
            state
            stateReason
            publishedAt # draftからOpenになった日 or 直接Openになった日
            createdAt
            closedAt
            author {
              __typename
              ... on Bot { databaseId id login url }
              ... on EnterpriseUserAccount { id login name url }
              ... on Mannequin { databaseId id login name url }
              ... on Organization { databaseId id login name url }
              ... on User { databaseId id login name url }
            }
            reactionGroups { content reactors { totalCount } } # リアクション数
            reactions(first: 1){
              totalCount
            }
            assignedActors(first: 1){
              totalCount
            }
            labels(first: 1){
              totalCount
            }
            timelineItems(
              first: 1, 
              itemTypes: [
                LABELED_EVENT, 
                ASSIGNED_EVENT, 
                CLOSED_EVENT
              ]
            ) {
              totalCount
              pageCount
              filteredCount
            }
            comments(first: 1){
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
    "$RESULT_GET_ISSUE_NODE_ID_PATH" \
    "issues" \
    "publishedAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-issue-node-id()" \
    "$before_remaining_ratelimit" \
    "false"
}
