#!/bin/bash

#--------------------------------------
# discussionのコメントのリプライを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# discussionのコメントのリプライを取得する関数
#--------------------------------------
function get_discussion_comment_reply() {
  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-discussion-comment-reply()")"

  local QUERY
  local RAW_PATH="${RESULT_GET_DISCUSSION_DIR}/raw-discus-comment-reply.jsonl"

  # shellcheck disable=SC2016
  QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        __typename
        ... on DiscussionComment {
          id
          url
          publishedAt
          replies(first: $perPage, after: $endCursor){
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
    "$RESULT_GET_DISCUSSION_COMMENT_REPLY_NODE_ID_PATH" \
    "replies" \
    "$RESULT_GET_DISCUSSION_COMMENT_NODE_ID_PATH" \
    "publishedAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-discussion-comment-reply()" \
    "$before_remaining_ratelimit" \
    "false"
}
