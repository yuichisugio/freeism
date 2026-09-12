#!/bin/bash

# ----------------------------------------
# パッケージマネージャーのAPIを使用して、依存関係を取得する
# ----------------------------------------

set -euo pipefail

# ----------------------------------------
# npmのAPIを使用して、依存関係を取得する
# ----------------------------------------
get_npm() {
  printf '%s\n' "start: get_npm"
  # 未実装
  readonly RAW_PACKAGE_MANAGER_API_DIR="${RESULTS_DIR}/package-manager-api"
  mkdir -p "${RAW_PACKAGE_MANAGER_API_DIR}"
  printf '%s\n' "end: get_npm"
}

# ----------------------------------------
# パッケージマネージャーのAPIを使用して、依存関係を取得する
# ----------------------------------------
get_package_manager_api() {
  printf '%s\n' "start: package-manager-api"
  get_npm
  # get_jsr
  # get_maven
  # get_pypi
  # get_go
  # get_cargo
  # get_nuget
  # get_gem
  printf '%s\n' "end: package-manager-api"
}
