#!/bin/bash

#--------------------------------------
# commit関連のデータ取得を行うファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RAW_COMMIT_WITH_PR_PATH="${RESULT_GET_COMMIT_DIR}/raw-commit-with-pr.jsonl"

#--------------------------------------
# ブランチ存在チェック関数
#--------------------------------------
function branch_exists() {
  local BRANCH="$1" IS_BRANCH_EXISTS QUERY

  # shellcheck disable=SC2016
  QUERY='
    query($owner: String!, $name: String!, $qualified: String!){
      repository(owner: $owner, name: $name) {
        ref(qualifiedName: $qualified) {
          name
        }
      }
    }
  '

  # ブランチが存在するかどうかをチェック。
  IS_BRANCH_EXISTS="$(
    gh api graphql \
      --header X-Github-Next-Global-ID:1 \
      -f owner="$OWNER" \
      -f name="$REPO" \
      -f qualified="refs/heads/$BRANCH" \
      -f query="$QUERY" \
      --jq 'if .data.repository.ref == null then false else true end'
  )"

  # ブランチが存在するかどうかを返す
  [[ "$IS_BRANCH_EXISTS" == "true" ]]
}

#--------------------------------------
# コミットのデータを取得する
#--------------------------------------
function get_commit_node_id_with_pr() {

  # データ取得前のRateLimit変数
  local before_remaining_ratelimit
  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-commit-node-id-with-pr()")"

  local FOUND=() QUERY QUALIFIED

  # main/master それぞれのブランチが存在するかのコミットを取得する
  for b in main master; do
    if branch_exists "$b"; then
      FOUND+=("$b")
    fi
  done

  # ブランチが存在しない場合はエラーを出力
  if [[ ${#FOUND[@]} -eq 0 ]]; then
    printf '%s\n' "master/main branch does not exist" >&2
    exit 1
  fi

  # 同じPATHに実行する場合に、前回の内容をファイルを空にする
  : >"$RAW_COMMIT_WITH_PR_PATH"
  : >"$RESULT_GET_COMMIT_NODE_ID_WITH_PR_PATH"

  # shellcheck disable=SC2016
  QUERY='
    query(
      $owner: String!,
      $name: String!,
      $endCursor: String,
      $qualified: String!,
      $prsPerCommit: Int!,
      $perPage: Int!,
      $since: GitTimestamp!,
      $until: GitTimestamp!
    ) {
      repository(owner:$owner, name:$name) {
        ref(qualifiedName:$qualified) {
          id
          name
          target {
            id
            oid
            abbreviatedOid
            commitUrl
            ... on Commit {
              history(first: $perPage, after:$endCursor, since:$since, until:$until) {
                totalCount
                pageInfo { hasNextPage endCursor }
                nodes {
                  id
                  oid
                  abbreviatedOid
                  url
                  commitUrl
                  authoredDate  # git commitした日
                  committedDate # リポジトリにコミットを適応した日。rebaseなどでズレる
                  messageHeadline
                  messageBody
                  message
                  authoredByCommitter
                  committer {
                    name
                    date
                    user { __typename databaseId id login name url }
                  }
                  authors(first: 5) {
                    totalCount
                    pageInfo { hasNextPage endCursor }
                    nodes{
                      __typename
                      name
                      date
                      user { __typename databaseId id login name url }
                    }
                  }
                  status{
                    id
                    state
                  }
                  additions
                  deletions
                  comments(first:1) {
                    totalCount
                    pageInfo { hasNextPage endCursor }
                  }
                  associatedPullRequests(first: $prsPerCommit) {
                    totalCount
                    pageInfo { hasNextPage endCursor }
                    nodes {
                      fullDatabaseId
                      id
                      number
                      url
                      permalink
                      checksUrl
                      revertUrl
                      reviewDecision
                      state
                      author {
                        __typename
                        ... on Bot { databaseId id login url }
                        ... on EnterpriseUserAccount { id login name url }
                        ... on Mannequin { databaseId id login name url }
                        ... on Organization { databaseId id login name url }
                        ... on User { databaseId id login name url }
                      }
                      title
                      bodyText
                      publishedAt
                      reactionGroups { content reactors { totalCount } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  '

  # main/master それぞれのブランチのコミットを取得
  for b in "${FOUND[@]}"; do
    QUALIFIED="refs/heads/$b"

    gh api graphql \
      --header X-Github-Next-Global-ID:1 \
      --paginate --slurp \
      -F owner="$OWNER" \
      -F name="$REPO" \
      -F qualified="$QUALIFIED" \
      -F prsPerCommit=3 \
      -F since="$SINCE" \
      -F until="$UNTIL" \
      -F perPage=30 \
      -f query="$QUERY" |
      jq '.' >>"$RAW_COMMIT_WITH_PR_PATH"

  done

  # raw-data を結合
  jq '[ .[] | .data.repository.ref.target.history.nodes[] ]' "${RAW_COMMIT_WITH_PR_PATH}" >"$RESULT_GET_COMMIT_NODE_ID_WITH_PR_PATH"

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-commit-node-id-with-pr()" \
    "$before_remaining_ratelimit" \
    "false"
}
