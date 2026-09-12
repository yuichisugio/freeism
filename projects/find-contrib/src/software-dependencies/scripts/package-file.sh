#!/bin/bash

# ----------------------------------------
# パッケージファイルを使用して、依存関係を取得する
# package.json ファイルや import 文を見て、直接依存を探し出して依存ライブラリの一覧を表示する方法
# ----------------------------------------

set -euo pipefail

function get_package_file() {
  printf '%s\n' "start: package-file"

  readonly RAW_PACKAGE_FILE_DIR="${RESULTS_DIR}/package-file"
  mkdir -p "${RAW_PACKAGE_FILE_DIR}"

  # 未実装
  printf '%s\n' "end: package-file"
}
