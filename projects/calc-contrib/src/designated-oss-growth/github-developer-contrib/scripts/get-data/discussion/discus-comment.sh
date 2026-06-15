#!/bin/bash

#--------------------------------------
# discussionのコメントを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RAW_RESULT_GET_DISCUSSION_COMMENT_DIR="${RESULT_GET_DISCUSSION_DIR}/raw-discus-comment.jsonl"
mkdir -p "$(dirname "$RAW_RESULT_GET_DISCUSSION_COMMENT_DIR")"

#--------------------------------------
# discussionのコメントを取得する関数
#--------------------------------------
function get_discussion_comment() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-discussion-comment()")"

  local QUERY

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        __typename
        ... on Discussion {
          id
          databaseId
          number
          url
          title
          bodyText
          publishedAt
          comments(first: $perPage, after:$endCursor){
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes {
              databaseId
              id
              url
              upvoteCount
              author {
                __typename
                ... on User { databaseId id login name url }
                ... on Bot { databaseId id login url }
                ... on Mannequin { databaseId id login name url }
                ... on Organization { databaseId id login name url }
                ... on EnterpriseUserAccount { user { databaseId id login name url } }
              }
              bodyText
              publishedAt
              reactionGroups { content reactors { totalCount } }
              reactions(first: 1){
                totalCount
              }
              replies(first: 1){
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
    "$RAW_RESULT_GET_DISCUSSION_COMMENT_DIR" \
    "$RESULT_GET_DISCUSSION_COMMENT_NODE_ID_PATH" \
    "comments" \
    "$RESULT_GET_DISCUSSION_NODE_ID_PATH" \
    "publishedAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-discussion-comment()" \
    "$before_remaining_ratelimit" \
    "false"
}
