#!/bin/bash

#--------------------------------------
# リリースのデータ加工を統合するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RESULT_PROCESSED_RELEASE_DIR="${OUTPUT_PROCESSED_DIR}/release"
mkdir -p "$RESULT_PROCESSED_RELEASE_DIR"

#--------------------------------------
# 使用するファイルを読み込む
#--------------------------------------
readonly PROCESS_RELEASE_DIR="${PROCESS_DIR}/release"
source "${PROCESS_RELEASE_DIR}/release-node-id.sh"
source "${PROCESS_RELEASE_DIR}/release-reaction.sh"

#--------------------------------------
# リリースのデータを取得する関数
#--------------------------------------
function process_release() {

  printf '%s\n' "begin:process-release()"

  # release作成者のデータ加工
  process_release_node_id

  # releaseにリアクションした人のデータ加工
  process_release_reaction

  printf '%s\n' "end:process-release()"

  return 0
}
