#!/bin/bash

# --------------------------------------
# Pull Request のReview関連(+リアクション)に必要なすべてのデータをテスト的に取得する
# --------------------------------------

readonly OWNER="${1:-yuichisugio}"
readonly REPO="${2:-myFirstTest}"
readonly OUTPUT_FILE="./src/designated-oss-growth/github-developer-contrib/archive/pull-request-review/4-${REPO}.json"
readonly PER_PAGE="${3:-50}"

set -euo pipefail

# shellcheck disable=SC2016
gh api graphql \
  --header X-Github-Next-Global-ID:1 \
  -f owner="${OWNER}" \
  -f name="${REPO}" \
  -F perPage="${PER_PAGE}" \
  -f query='
    query($owner: String!, $name: String!, $perPage: Int!) {
      repository(owner:$owner, name:$name) {
        pullRequests(first: $perPage ,orderBy: {field : CREATED_AT,direction: ASC}){
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes {
            fullDatabaseId
            id # node_id
            number
            permalink # プルリクのURL
            url # プルリクのURL
            checksUrl # チェックのURL
            additions # コード追加の行数
            deletions # コード削除の行数
            title # pull-requestもレビューする対象なのでコード行数に加算するために取得
            bodyText # プルリクの説明
            state # OPEN, CLOSED, MERGED
            publishedAt # draftからOpenになった日 or 直接Openになった日
            closedAt # REJECTEDかCLOSEDになった日
            mergedAt # マージ日
            mergedBy { login url } # マージ担当者
            reactionGroups { content reactors { totalCount } } # リアクション数
            reactions(first: $perPage){
              totalCount
              pageInfo { hasNextPage endCursor }
              nodes{ databaseId id content createdAt user { databaseId id login name url } }
            }
            comments(first: $perPage){
              totalCount
              pageInfo { hasNextPage endCursor }
              nodes {
                fullDatabaseId
                databaseId
                id
                url
                author { 
                  __typename
                  ... on User { databaseId id login name url }
                  ... on Bot { databaseId id login url }
                  ... on Mannequin { databaseId id login name url }
                  ... on Organization { databaseId id login name url }
                  ... on EnterpriseUserAccount { id login name url }
                }
                bodyText
                publishedAt
                reactionGroups { content reactors { totalCount } }
                reactions(first: $perPage){
                  totalCount
                  pageInfo { hasNextPage endCursor }
                  nodes{ databaseId id content createdAt user { databaseId id login name url } }
                }
                includesCreatedEdit # 編集したかどうか
                editor {
                  __typename
                  ... on User { databaseId id login name url }
                  ... on Bot { databaseId id login url }
                  ... on Mannequin { databaseId id login name url }
                  ... on Organization { databaseId id login name url }
                  ... on EnterpriseUserAccount { id login name url }
                }
                userContentEdits(first: $perPage){
                  totalCount
                  pageInfo { hasNextPage endCursor }
                  nodes{
                    id
                    deletedBy {
                      __typename
                      ... on User { databaseId id login name url }
                      ... on Bot { databaseId id login url }
                      ... on Mannequin { databaseId id login name url }
                      ... on Organization { databaseId id login name url }
                      ... on EnterpriseUserAccount { id login name url }
                    }
                    deletedAt
                    editedAt
                    diff
                    editor {
                      __typename
                      ... on User { databaseId id login name url }
                      ... on Bot { databaseId id login url }
                      ... on Mannequin { databaseId id login name url }
                      ... on Organization { databaseId id login name url }
                      ... on EnterpriseUserAccount { id login name url }
                    }
                  }
                }
              }
            }
            reviews(first: $perPage){
              totalCount
              pageInfo { hasNextPage endCursor }
              nodes {
                fullDatabaseId
                id
                url
                author {
                  __typename
                  ... on User { databaseId id login name url }
                  ... on Bot { databaseId id login url }
                  ... on Mannequin { databaseId id login name url }
                  ... on Organization { databaseId id login name url }
                  ... on EnterpriseUserAccount { id login name url }
                }
                bodyText
                state
                publishedAt
                reactionGroups { content reactors { totalCount } }
                reactions(first: $perPage){
                  totalCount
                  pageInfo { hasNextPage endCursor }
                  nodes{ databaseId id content createdAt user { databaseId id login name url } }
                }
                comments(first: $perPage){
                  totalCount
                  pageInfo { hasNextPage endCursor }
                  nodes {
                    fullDatabaseId
                    id
                    url
                    author {
                      __typename
                      ... on User { databaseId id login name url }
                      ... on Bot { databaseId id login url }
                      ... on Mannequin { databaseId id login name url }
                      ... on Organization { databaseId id login name url }
                      ... on EnterpriseUserAccount { id login name url }
                    }
                    bodyText
                    publishedAt
                    reactionGroups { content reactors { totalCount } }
                    reactions(first: $perPage){
                      totalCount
                      pageInfo { hasNextPage endCursor }
                      nodes{ databaseId id content createdAt user { databaseId id login name url } }
                    }
                  }
                }
              }
            }
            timelineItems(first: $perPage){
              totalCount
              pageInfo { hasNextPage endCursor }
              nodes {
                __typename
                ... on LabeledEvent { createdAt label { name } actor { login } }
                ... on UnlabeledEvent { createdAt label { name } actor { login } }
                ... on AssignedEvent { createdAt assignee { __typename ... on User { login id } } actor { login } }
                ... on UnassignedEvent { createdAt assignee { __typename ... on User { login id } } actor { login } }
                ... on ReviewRequestedEvent { createdAt requestedReviewer { __typename ... on User { login id } ... on Team { name id } } actor { login } }
                ... on ReadyForReviewEvent { createdAt actor { login } }
                ... on MergedEvent { createdAt mergeRefName }
                ... on ClosedEvent { createdAt }
                ... on HeadRefDeletedEvent { createdAt }
                ... on IssueComment { createdAt }
                ... on PullRequestCommit { createdAt }
                ... on PullRequestReview { createdAt }
                ... on PullRequestReviewComment { createdAt }
                ... on PullRequestReviewThread { createdAt }
                ... on PullRequestReviewThreadComment { createdAt }
                ... on PullRequestReviewThreadComment { createdAt }
              }
            }
          }
        }
      }
    }
  ' | jq '.' >"${OUTPUT_FILE}"
