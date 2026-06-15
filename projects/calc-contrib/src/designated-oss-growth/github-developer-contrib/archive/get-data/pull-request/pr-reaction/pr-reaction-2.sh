#!/bin/bash

set -euo pipefail

# shellcheck disable=SC2016
QUERY='
    query($node_id: ID!, $perPage: Int!, $endCursor: String) {
      node(id: $node_id) {
        ... on PullRequest{
          reactions(first: $perPage, after: $endCursor){
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes { databaseId id content createdAt user { databaseId id login name url } }
          }
        }
      }
    }
  '

RAW_PATH="./src/designated-oss-growth/github-developer-contrib/archive/pull-request/pr-reaction/raw-pr-reaction.jsonl"

RESULT_PATH="./src/designated-oss-growth/github-developer-contrib/archive/pull-request/pr-reaction/result-pr-reaction.json"

FIRST_CHECK_FIELD_NAME="reactions"

SECOND_CHECK_FIELD_NAME="createdAt"

RESULT_GET_PR_NODE_ID_PATH="./src/designated-oss-growth/github-developer-contrib/archive/pull-request/pr-reaction/result-pr-node-id.json"

HAS_NEXT_PAGE=""
END_CURSOR=""
LAST_DATE=""
RESPONSE=""
NODE_ID=""
FIELD_TOTAL_COUNT=""
SINCE="1970-01-01T00:00:00Z"
UNTIL="2025-09-15T23:59:59Z"

# 同じPATHに実行する場合に、前回の内容をファイルを空にする
: >"$RAW_PATH"
: >"$RESULT_PATH"

# node_idが0の場合は終了
if [[ "$(jq -r 'length' "$RESULT_GET_PR_NODE_ID_PATH")" == "0" ]]; then
  exit 0
fi

# RESULT_GET_PR_NODE_ID_PATHのすべてのnode_idに対して実行するよう繰り返す
for NODE_ID in $(jq -r '.[].id' "$RESULT_GET_PR_NODE_ID_PATH"); do

  FIELD_TOTAL_COUNT="$(
    jq -r \
      --arg NODE_ID "$NODE_ID" \
      --arg FIRST_CHECK_FIELD_NAME "$FIRST_CHECK_FIELD_NAME" \
      '(.[] | select(.id==$NODE_ID) | .[$FIRST_CHECK_FIELD_NAME].totalCount // 0) | tonumber' \
      "$RESULT_GET_PR_NODE_ID_PATH"
  )"

  # フィールドのtotalCountが0の場合は次のnode_idに進む
  if ((FIELD_TOTAL_COUNT == 0)); then
    continue
  fi

  # 各Nodeごとにカーソルを初期化
  END_CURSOR=""

  # 手動ページネーションで、SINCEからUNTILの期間で絞ってJSONLに追記
  while :; do

    # OWNERとREPOはmain.shでグローバル変数として定義されている
    RESPONSE="$(
      gh api graphql \
        --header X-Github-Next-Global-ID:1 \
        -f node_id="$NODE_ID" \
        -F endCursor="${END_CURSOR:-null}" \
        -F perPage=50 \
        -f query="$QUERY" |
        jq '.'
    )"

    printf '%s\n' "$RESPONSE" >>"$RAW_PATH"

    # 期間で絞ってJSONLに追記
    # SINCEとUNTILはmain.shでグローバル変数として定義されている
    jq -r \
      --arg SINCE "$SINCE" \
      --arg UNTIL "$UNTIL" \
      --arg FIRST_CHECK_FIELD_NAME "$FIRST_CHECK_FIELD_NAME" \
      --arg SECOND_CHECK_FIELD_NAME "$SECOND_CHECK_FIELD_NAME" \
      '.data.node[$FIRST_CHECK_FIELD_NAME].nodes[]
      | select(.[$SECOND_CHECK_FIELD_NAME] >= $SINCE and .[$SECOND_CHECK_FIELD_NAME] <= $UNTIL)
    ' <<<"$RESPONSE" >>"$RESULT_PATH"

    # 次ページの準備
    HAS_NEXT_PAGE="$(
      jq -r \
        --arg FIRST_CHECK_FIELD_NAME "$FIRST_CHECK_FIELD_NAME" \
        '.data.node[$FIRST_CHECK_FIELD_NAME].pageInfo.hasNextPage' <<<"$RESPONSE"
    )"
    END_CURSOR="$(
      jq -r \
        --arg FIRST_CHECK_FIELD_NAME "$FIRST_CHECK_FIELD_NAME" \
        '.data.node[$FIRST_CHECK_FIELD_NAME].pageInfo.endCursor' <<<"$RESPONSE"
    )"
    LAST_DATE="$(
      jq -r \
        --arg FIRST_CHECK_FIELD_NAME "$FIRST_CHECK_FIELD_NAME" \
        --arg SECOND_CHECK_FIELD_NAME "$SECOND_CHECK_FIELD_NAME" \
        '(.data.node[$FIRST_CHECK_FIELD_NAME].nodes | last | .[$SECOND_CHECK_FIELD_NAME])' <<<"$RESPONSE"
    )"

    # 続きがない、もしくは期間外の場合は終了
    if [[ "$HAS_NEXT_PAGE" != "true" || "$END_CURSOR" == "null" || -z "$END_CURSOR" || (-n "$LAST_DATE" && "$LAST_DATE" > "$UNTIL") ]]; then
      break
    fi

  done

done

# 最後に配列化して保存する。JSONL → 配列（安全な書き換え）
tmp="$(mktemp "${RESULT_PATH}.XXXX")"
trap 'rm -f "$tmp"' EXIT
jq -s '.' "$RESULT_PATH" >"$tmp" && mv -f "$tmp" "$RESULT_PATH"
