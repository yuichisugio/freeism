#!/bin/bash

#--------------------------------------
# discussionの回答のリプライを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# discussionの回答のリプライを取得する関数
#--------------------------------------
function get_discussion_answer_reply() {
  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-discussion-answer-reply()")"

  local QUERY
  local RAW_PATH="${RESULT_GET_DISCUSSION_DIR}/raw-discus-answer-reply.jsonl"

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
    "$RESULT_GET_DISCUSSION_ANSWER_REPLY_NODE_ID_PATH" \
    "replies" \
    "$RESULT_GET_DISCUSSION_ANSWER_NODE_ID_PATH" \
    "publishedAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-discussion-answer-reply()" \
    "$before_remaining_ratelimit" \
    "false"
}
