#!/bin/bash

#--------------------------------------
# sponsorのデータを加工するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_SPONSOR_PATH="${OUTPUT_PROCESSED_DIR}/sponsor/result-sponsor.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_SPONSOR_PATH")"

#--------------------------------------
# sponsorのデータを加工する関数
#--------------------------------------
function process_sponsor() {

  printf '%s\n' "begin:process_sponsor()"

  process_data_utils \
    --input-path "$RESULT_GET_SPONSOR_SUPPORTERS_PATH" \
    --output-path "$RESULT_PROCESSED_SPONSOR_PATH" \
    --task-name "sponsor" \
    --task-date "createdAt" \
    --author-field "sponsorEntity"

  printf '%s\n' "end:process_sponsor()"

  return 0
}
