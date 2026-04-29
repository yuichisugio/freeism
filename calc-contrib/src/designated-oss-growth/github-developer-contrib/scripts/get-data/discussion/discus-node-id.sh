#!/bin/bash

#--------------------------------------
# discussionのnode_idと各種フィールドのtotalCountを取得するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# discussionのnode_idと各種フィールドのtotalCountを取得する関数
#--------------------------------------
function get_discussion_node_id() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-discussion-node-id()")"

  local QUERY
  local RAW_PATH="${RESULT_GET_DISCUSSION_DIR}/raw-discus-node-id.jsonl"

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
        hasDiscussionsEnabled
        discussionCategories(first: 10) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            name
            description
            slug
            createdAt
            updatedAt
          }
        }
        discussions(first: $perPage, after: $endCursor, orderBy:{field: CREATED_AT, direction: ASC } ) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            databaseId
            number
            url
            title
            bodyText
            publishedAt
            upvoteCount
            closed
            stateReason
            reactionGroups { content reactors { totalCount } }
            reactions(first: 1){
              totalCount
            }
            category{
              id
              name
              description
              slug
              createdAt
              isAnswerable
              emoji
            }
            author{
              __typename
              ... on Bot { databaseId id login url }
              ... on EnterpriseUserAccount { id login name url }
              ... on Mannequin { databaseId id login name url }
              ... on Organization { databaseId id login name url }
              ... on User { databaseId id login name url }
            }
            closedAt
            comments(first: 1){
              totalCount
            }
            poll{
              id
              question
              totalVoteCount
              options(first: 5){
                totalCount
                pageInfo { hasNextPage endCursor }
                nodes {
                  id
                  option
                  totalVoteCount
                }
              }
            }
            answerChosenBy{
              __typename
              ... on Bot { databaseId id login url }
              ... on EnterpriseUserAccount { id login name url }
              ... on Mannequin { databaseId id login name url }
              ... on Organization { databaseId id login name url }
              ... on User { databaseId id login name url }
            }
            answerChosenAt
            answer{
              databaseId
              id
              url
              upvoteCount
              author {
                __typename
                ... on Bot { databaseId id login url }
                ... on EnterpriseUserAccount { id login name url }
                ... on Mannequin { databaseId id login name url }
                ... on Organization { databaseId id login name url }
                ... on User { databaseId id login name url }
              }
              bodyText
              publishedAt
              createdAt
              deletedAt
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

  # クエリを実行。
  get_paginated_repository_data \
    "$QUERY" \
    "$RAW_PATH" \
    "$RESULT_GET_DISCUSSION_NODE_ID_PATH" \
    "discussions" \
    "publishedAt"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-discussion-node-id()" \
    "$before_remaining_ratelimit" \
    "false"
}
