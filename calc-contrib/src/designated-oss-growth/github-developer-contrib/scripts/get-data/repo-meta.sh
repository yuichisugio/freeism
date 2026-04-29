#!/bin/bash

#--------------------------------------
# リポジトリのメタデータを取得する
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを作成する
#--------------------------------------
readonly RESULT_GET_REPO_META_PATH="${OUTPUT_GET_DIR}/repo-meta/result-repo-meta.json"
mkdir -p "$(dirname "$RESULT_GET_REPO_META_PATH")"

#--------------------------------------
# リポジトリのメタデータを取得する
#--------------------------------------
function get_repo_meta() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-repo-meta()")"

  local QUERY

  # クエリを定義
  # shellcheck disable=SC2016
  QUERY='
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        id
        databaseId
        name
        description
        createdAt
        url
        homepageUrl
        owner {
          __typename
          ... on Organization { databaseId id login name url }
          ... on User { databaseId id login name url }
        }
        defaultBranchRef {
          name
        }
      }
    }
  '

  # クエリを実行。jq '.' で、JSONを整形して指定ファイルに出力。
  gh api graphql \
    --header X-Github-Next-Global-ID:1 \
    -f owner="$OWNER" \
    -f repo="$REPO" \
    -f query="$QUERY" \
    | jq '.' >"$RESULT_GET_REPO_META_PATH"

  # データ取得後のRateLimitを出力
  get_ratelimit "after:get-repo-meta()" "$before_remaining_ratelimit" "false"
}
