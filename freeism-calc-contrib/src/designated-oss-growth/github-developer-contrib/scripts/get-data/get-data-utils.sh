#!/bin/bash

#--------------------------------------
# pull requestの共通関数を定義するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 手動ページネーションで、SINCEからUNTILの期間で絞ってJSONLに追記
#--------------------------------------
function get_paginated_repository_data() {

  # 引数
  local QUERY="$1"
  local RAW_PATH="$2"
  local RESULT_PATH="$3"
  local FIRST_FIELD="$4"
  local SECOND_FIELD="$5"

  # 変数
  local HAS_NEXT_PAGE END_CURSOR LAST_DATE RESPONSE

  # 同じPATHに実行する場合に、前回の内容をファイルを空にする
  : >"$RAW_PATH"
  : >"$RESULT_PATH"

  # 手動ページネーションで、SINCEからUNTILの期間で絞ってJSONLに追記
  while :; do

    # OWNERとREPOはmain.shでグローバル変数として定義されている
    RESPONSE="$(gh api graphql \
      --header X-Github-Next-Global-ID:1 \
      -f owner="$OWNER" \
      -f name="$REPO" \
      -F endCursor="${END_CURSOR:-null}" \
      -F perPage=50 \
      -f query="$QUERY" | jq '.')"

    printf '%s\n' "$RESPONSE" >>"$RAW_PATH"

    # 期間で絞ってJSONLに追記
    # SINCEとUNTILはmain.shでグローバル変数として定義されている
    jq -r \
      --arg SINCE "$SINCE" \
      --arg UNTIL "$UNTIL" \
      --arg FIRST_FIELD "$FIRST_FIELD" \
      --arg SECOND_FIELD "$SECOND_FIELD" \
      '.data.repository[$FIRST_FIELD].nodes[]
        | select(.[$SECOND_FIELD] >= $SINCE and .[$SECOND_FIELD] <= $UNTIL)
      ' <<<"$RESPONSE" >>"$RESULT_PATH"

    # 次ページの準備
    HAS_NEXT_PAGE="$(
      jq -r \
        --arg FIRST_FIELD "$FIRST_FIELD" \
        '.data.repository[$FIRST_FIELD].pageInfo.hasNextPage' <<<"$RESPONSE"
    )"
    END_CURSOR="$(
      jq -r \
        --arg FIRST_FIELD "$FIRST_FIELD" \
        '.data.repository[$FIRST_FIELD].pageInfo.endCursor' <<<"$RESPONSE"
    )"
    LAST_DATE="$(
      jq -r \
        --arg FIRST_FIELD "$FIRST_FIELD" \
        --arg SECOND_FIELD "$SECOND_FIELD" \
        '(.data.repository[$FIRST_FIELD].nodes | last | .[$SECOND_FIELD])' <<<"$RESPONSE"
    )"

    # 続きがない、もしくは期間外の場合は終了
    if [[ 
      "$HAS_NEXT_PAGE" != "true" ||
      "$END_CURSOR" == "null" ||
      -z "$END_CURSOR" ||
      (-n "$LAST_DATE" && "$LAST_DATE" > "$UNTIL") ]] \
      ; then
      break
    fi

  done

  # 最後に配列化して保存する。JSONL → 配列（安全な書き換え）
  tmp="$(mktemp "${RESULT_PATH}.XXXX")"
  trap 'rm -f "$tmp"' EXIT
  jq -s '.' "$RESULT_PATH" >"$tmp" && mv -f "$tmp" "$RESULT_PATH"
}

#--------------------------------------
# starのデータ構造専用
# 手動ページネーションで、SINCEからUNTILの期間で絞って出力
# starのstarredAtはnodes内ではなく、edges内にある
#--------------------------------------
function get_paginated_star_data() {

  # 引数
  local QUERY="$1"
  local RAW_PATH="$2"
  local RESULT_PATH="$3"

  # 変数
  local HAS_NEXT_PAGE END_CURSOR LAST_DATE RESPONSE

  # 同じPATHに実行する場合に、前回の内容をファイルを空にする
  : >"$RAW_PATH"
  : >"$RESULT_PATH"

  # 手動ページネーションで、SINCEからUNTILの期間で絞ってJSONLに追記
  while :; do

    # OWNERとREPOはmain.shでグローバル変数として定義されている
    RESPONSE="$(gh api graphql \
      --header X-Github-Next-Global-ID:1 \
      -f owner="$OWNER" \
      -f name="$REPO" \
      -F endCursor="${END_CURSOR:-null}" \
      -F perPage=50 \
      -f query="$QUERY" | jq '.')"

    printf '%s\n' "$RESPONSE" >>"$RAW_PATH"

    # 期間で絞ってJSONLに追記
    # SINCEとUNTILはmain.shでグローバル変数として定義されている
    jq -c \
      --arg SINCE "$SINCE" \
      --arg UNTIL "$UNTIL" \
      '.data.repository.stargazers.edges[]
        | select(.starredAt >= $SINCE and .starredAt <= $UNTIL)
      ' <<<"$RESPONSE" >>"$RESULT_PATH"

    # 次ページの準備
    HAS_NEXT_PAGE="$(jq -r '.data.repository.stargazers.pageInfo.hasNextPage' <<<"$RESPONSE")"
    END_CURSOR="$(jq -r '.data.repository.stargazers.pageInfo.endCursor' <<<"$RESPONSE")"
    LAST_DATE="$(jq -r 'try .data.repository.stargazers.edges[-1].starredAt // empty' <<<"$RESPONSE")"

    # 続きがない、もしくは期間外の場合は終了
    if [[ 
      "$HAS_NEXT_PAGE" != "true" ||
      "$END_CURSOR" == "null" ||
      -z "$END_CURSOR" ||
      (-n "$LAST_DATE" && "$LAST_DATE" > "$UNTIL") ]] \
      ; then
      break
    fi

  done

  # 最後に配列化して保存する。JSONL → 配列（安全な書き換え）
  tmp="$(mktemp "${RESULT_PATH}.XXXX")"
  trap 'rm -f "$tmp"' EXIT
  jq -s '.' "$RESULT_PATH" >"$tmp" && mv -f "$tmp" "$RESULT_PATH"
}

#--------------------------------------
# nodeクエリ指定で、手動ページネーションで、SINCEからUNTILの期間に絞って出力
# SECOND_CHECK_FIELD_NAMEが空の場合は、期間で絞り込まない
# RAWには取得したままのデータが入り、RESULTには期間で絞り、多少データ加工したデータが入る
# nodeクエリ直下のフィールドには、node_プレフィックスを設定して、各オブジェクトのキーと衝突しないようにする
# すべてのノードでtotalCountが0の場合は、空のファイルになる
# timelineItemsは、labelが空でも、assignedのイベントがあればtotalCountがあるので、nodeクエリは実行されるがnodesは空になる
#--------------------------------------
function get_paginated_data_by_node_id() {

  # raw_pathは取得したままのデータ。resultはlocal側で、期間で絞ったデータ
  local QUERY="$1"
  local RAW_PATH="$2"
  local RESULT_PATH="$3"
  local FIRST_CHECK_FIELD_NAME="$4"
  local NODE_ID_PATH="${5}"
  local SECOND_CHECK_FIELD_NAME="${6:-}"
  local HAS_NEXT_PAGE END_CURSOR LAST_DATE RESPONSE
  local NODE_ID FIELD_TOTAL_COUNT

  # 同じPATHに実行する場合に、前回の内容をファイルを空にする
  : >"$RAW_PATH"
  : >"$RESULT_PATH"

  # node_idが0の場合は終了
  if [[ "$(jq -r 'length' "$NODE_ID_PATH")" == "0" ]]; then
    return 0
  fi

  # RESULT_GET_PR_NODE_ID_PATHのすべてのnode_idに対して実行するよう繰り返す
  for NODE_ID in $(jq -r '.[].id' "$NODE_ID_PATH"); do

    # フィールドのtotalCountを取得。.[$FIRST_CHECK_FIELD_NAME].totalCountで、FIRST自身がnullの可能性もあるため、// 0で0を返すようにする。
    FIELD_TOTAL_COUNT="$(
      jq -r \
        --arg NODE_ID "$NODE_ID" \
        --arg FIRST_CHECK_FIELD_NAME "$FIRST_CHECK_FIELD_NAME" \
        '(.[] | select(.id==$NODE_ID) | .[$FIRST_CHECK_FIELD_NAME].totalCount // 0) | tonumber' \
        "$NODE_ID_PATH"
    )"

    # フィールドのtotalCountが0の場合は次のnode_idに進む
    if ((FIELD_TOTAL_COUNT == 0)); then
      continue
    fi

    # 各Nodeごとにカーソルを初期化
    END_CURSOR=""

    # 手動ページネーションで、SINCEからUNTILの期間で絞ってJSONLに追記
    while :; do

      # timelineItemsはSINCEを指定できるので、サーバー側でもフィルターで絞る
      if [[ "$FIRST_CHECK_FIELD_NAME" == "timelineItems" ]]; then

        # OWNERとREPOはmain.shでグローバル変数として定義されている
        RESPONSE="$(
          gh api graphql \
            --header X-Github-Next-Global-ID:1 \
            -f node_id="$NODE_ID" \
            -F endCursor="${END_CURSOR:-null}" \
            -F perPage=50 \
            -f since="$SINCE" \
            -f query="$QUERY" |
            jq '.'
        )"

      else

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

      fi

      printf '%s\n' "$RESPONSE" >>"$RAW_PATH"

      # 期間で絞ってJSONLに追記
      # SINCEとUNTILはmain.shでグローバル変数として定義されている
      # assignedActorsはSECOND_CHECK_FIELD_NAMEがないため、空文字で絞り込まない
      # nodeクエリ直下のフィールドには、node_プレフィックスを設定して、各オブジェクトのキーと衝突しないようにする。
      # 例: node.id → node_id
      jq -c \
        --arg SINCE "$SINCE" \
        --arg UNTIL "$UNTIL" \
        --arg FIRST "$FIRST_CHECK_FIELD_NAME" \
        --arg SECOND "${SECOND_CHECK_FIELD_NAME:-}" \
        --arg meta_prefix "node_" \
        '
        # node直下の情報を取得
        .data.node as $node
        # node直下の情報から connection部(.[$field])だけ除外 すべてのキーにprefix付与
        | ($node
          | del(.[$FIRST])
          | with_entries(.key |= ($meta_prefix + .))
          ) as $meta
        # 各ノードを取り出し、必要なら期間でフィルタ
        | $node[$FIRST].nodes[]
        | (if $SECOND == "" then .
            else select(.[$SECOND] >= $SINCE and .[$SECOND] <= $UNTIL)
            end)
        # 衝突しない形で結合（右側ノード側を優先、prefix付き$metaは衝突しない）
        | $meta + .
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
          --arg SECOND_CHECK_FIELD_NAME "${SECOND_CHECK_FIELD_NAME:-}" \
          '(.data.node[$FIRST_CHECK_FIELD_NAME].nodes | last | if $SECOND_CHECK_FIELD_NAME == "" then . else .[$SECOND_CHECK_FIELD_NAME] end)' <<<"$RESPONSE"
      )"

      # 続きがない、もしくは期間外の場合は終了
      if [[ "$HAS_NEXT_PAGE" != "true" || "$END_CURSOR" == "null" || -z "$END_CURSOR" || (-n "$LAST_DATE" && "$LAST_DATE" > "$UNTIL") ]]; then
        break
      fi

    done

  done

  # RESULT_PATHを配列化して保存する
  tmp="$(mktemp "${RESULT_PATH}.XXXX")"
  trap 'rm -f "$tmp"' EXIT
  jq -s '.' "$RESULT_PATH" >"$tmp" && mv -f "$tmp" "$RESULT_PATH"
}
