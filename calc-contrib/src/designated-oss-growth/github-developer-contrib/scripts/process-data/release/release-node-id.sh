#!/bin/bash

#--------------------------------------
# release作成者のデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_RELEASE_NODE_ID_PATH="${RESULT_PROCESSED_RELEASE_DIR}/result-release-node-id.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_RELEASE_NODE_ID_PATH")"

#--------------------------------------
# release作成者のデータを加工する関数
#--------------------------------------
function process_release_node_id() {

  printf '%s\n' "begin:process_release_node_id()"

  # shellcheck disable=SC2016
  local SECOND_OTHER_QUERY='
    letter_count: ((($obj.name // "") | length) + (($obj.description // "") | length)),
    good_reaction: ($obj.reactions.totalCount // 0)
  '

  process_data_utils \
    --input-path "$RESULT_GET_RELEASE_NODE_ID_PATH" \
    --output-path "$RESULT_PROCESSED_RELEASE_NODE_ID_PATH" \
    --task-name "create_release" \
    --task-date "publishedAt" \
    --author-field "author" \
    --second-other-query "$SECOND_OTHER_QUERY"

  printf '%s\n' "end:process_release_node_id()"

  return 0
}
