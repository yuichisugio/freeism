#!/bin/bash

# --------------------------------------
# 評価軸「指定OSSへの貢献」で、記事を書くことによる貢献度を分析するシェルスクリプトのメインファイル
# --------------------------------------

#--------------------------------------
# 準備（エラー対応、相対PATH安定）
#--------------------------------------
set -euo pipefail

# カレントディレクトリをスクリプトのディレクトリに固定
# shellcheck disable=SC2155
readonly PROJECT_DIR="$(cd "$(dirname -- "$0")" && pwd -P)"
cd "$PROJECT_DIR"

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
# shellcheck disable=SC2155
readonly OUTPUT_DIR="${PROJECT_DIR}/results/$(date +%Y-%m-%d-%H:%M:%S)"
mkdir -p "$OUTPUT_DIR"

#--------------------------------------
# 共通関数/使用する関数を読み込む
#--------------------------------------
source "${PROJECT_DIR}/scripts/utils.sh"
source "${PROJECT_DIR}/scripts/zenn.sh"
source "${PROJECT_DIR}/scripts/qiita.sh"
source "${PROJECT_DIR}/scripts/note.sh"
source "${PROJECT_DIR}/scripts/hatena.sh"

#--------------------------------------
# 引数のパース＆取得
#--------------------------------------
if ! parsed="$(parse_args "$@")"; then
  exit 0
fi
read -r INPUT_CONFIG_PATH QIITA_TOKEN <<<"$parsed"

#--------------------------------------
# メイン関数
#--------------------------------------
function main() {

  printf '%s\n' "begin:main()"

  # 依存コマンドの確認
  require_tools

  # zenn
  get_zenn

  # qiita
  # get_qiita

  # note
  # get_note

  # hatena
  # get_hatena

  printf '%s\n' "end:main()"

  return 0
}

# スクリプトを実行。
main "$@"
