#!/bin/bash

# --------------------------------------
# npmのダウンロード数のデータを加工するファイル
# --------------------------------------

set -euo pipefail

# --------------------------------------
# 出力先のファイルを定義
# --------------------------------------
readonly OUTPUT_PROCESSED_NPM_DOWNLOADS_PATH="${OUTPUT_PROCESSED_DIR}/npm-downloads.json"

#--------------------------------------
# npmのダウンロード数のデータを加工する関数
#--------------------------------------
function process_npm_downloads() {

  printf '%s\n' "begin:process_npm_downloads()"

  jq \
    '
      [ .[]?.downloads[]? ]            # 全チャンクの日次データをフラット化
      | map(.downloads)                # ダウンロード数だけを配列化
      | (add // 0)                     # 配列の数値を合計
      | { npm_download_count: . }      # 期待するキー名で1オブジェクトに整形
    ' \
    "$OUTPUT_GET_NPM_DOWNLOADS_PATH" >"$OUTPUT_PROCESSED_NPM_DOWNLOADS_PATH"

  printf '%s\n' "end:process_npm_downloads()"
}
