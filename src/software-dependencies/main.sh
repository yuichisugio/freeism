#!/bin/bash

# ----------------------------------------
# ソフトウェア依存関係の調査を各種スクリプトで実行し、結果を統合する
# ----------------------------------------

set -euo pipefail

#--------------------------------------
# 準備（相対 PATH 安定化）
#--------------------------------------
# shellcheck disable=SC2155
readonly PROJECT_DIR="$(cd "$(dirname -- "$0")" && pwd -P)"
cd "$PROJECT_DIR"

#--------------------------------------
# 出力ディレクトリを用意
#--------------------------------------
# shellcheck disable=SC2155
readonly RESULTS_DIR="${PROJECT_DIR}/results/$(date +%Y-%m-%dT%H:%M:%S)"
mkdir -p "$RESULTS_DIR"

#--------------------------------------
# 共通ユーティリティ
#--------------------------------------
source "${PROJECT_DIR}/scripts/utils.sh"

#--------------------------------------
# 引数パース
#--------------------------------------
if ! parsed="$(parse_args "$@")"; then
  exit 0
fi
read -r OWNER REPO LIBRARIES_TOKEN <<<"$parsed"

# 必要コマンドの確認
require_tools

#--------------------------------------
# スクリプト実行ラッパー
#--------------------------------------
run_github_sbom() {
  env OWNER="$OWNER" REPO="$REPO" RESULTS_DIR="$RESULTS_DIR" \
    bash -lc 'source "'"${PROJECT_DIR}/scripts/github-sbom.sh"'"; get_github_sbom'
}

run_package_file() {
  env OWNER="$OWNER" REPO="$REPO" RESULTS_DIR="$RESULTS_DIR" \
    bash -lc 'source "'"${PROJECT_DIR}/scripts/package-file.sh"'"; get_package_file'
}

run_package_manager_api() {
  env OWNER="$OWNER" REPO="$REPO" RESULTS_DIR="$RESULTS_DIR" \
    bash -lc 'source "'"${PROJECT_DIR}/scripts/package-manager-api.sh"'"; get_package_manager_api'
}

#--------------------------------------
# 実行と集約
#--------------------------------------
run_all() {
  printf '%s\n' "start: run_all"

  set +e

  run_github_sbom
  status=$?
  if ((status != 0)); then
    printf '%s\n' "WARN: github-sbom failed" >&2
  fi

  run_package_file
  status=$?
  if ((status != 0)); then
    printf '%s\n' "WARN: package-file failed" >&2
  fi

  run_package_manager_api
  status=$?
  if ((status != 0)); then
    printf '%s\n' "WARN: package-manager-api failed" >&2
  fi

  set -e

  # 集約対象を収集
  local -a result_files=()
  while IFS= read -r path; do
    result_files+=("$path")
  done < <(find "$RESULTS_DIR" -type f -name 'result.json' -print)

  if ((${#result_files[@]} > 0)); then
    printf '%s\n' "結果を統合: ${#result_files[@]} files"
    jq -s 'map(.data // []) | add | unique_by(.host + ":" + .repo)' "${result_files[@]}" |
      jq \
        '
          { 
            meta: {
              createdAt: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
              source_count: length
            },
            data: . 
          }
        ' \
        >"${RESULTS_DIR}/result.json"

    printf '%s\n' "結果を出力: ${RESULTS_DIR}/result.json"
  else
    printf '%s\n' "WARN: 統合対象の result.json が見つかりませんでした" >&2
  fi

  printf '%s\n' "end: run_all"
}

run_all
