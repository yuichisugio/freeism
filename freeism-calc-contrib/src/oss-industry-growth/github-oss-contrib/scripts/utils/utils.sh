#!/bin/bash

#--------------------------------------
# 共通関数を定義するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# Require tools
#--------------------------------------
function require_tools() {
  # 依存コマンドの確認
  for cmd in gh jq curl; do
    if ! command -v "$cmd" >/dev/null; then
      printf '%s\n' "ERROR: $cmd not found" >&2
      exit 1
    fi
  done

  # gh 認証確認
  if ! gh auth status >/dev/null; then
    printf '%s\n' "ERROR: gh not authenticated" >&2
    exit 1
  fi

  return 0
}

#--------------------------------------
# Parse inpu-config.json
#--------------------------------------
function parse_args() {

  # --- 引数パース。引数がある場合はデフォルト値を上書きする ---
  while [[ $# -gt 0 ]]; do
    case "$1" in
    -h | --help)
      show_usage
      exit 1
      ;;
    -v | --version)
      show_version
      exit 1
      ;;
    *)
      printf '%s\n' "Unknown option: $1" >&2
      show_usage
      exit 1
      ;;
    esac
  done

  # 設定ファイルからリポジトリ情報を取得
  local GITHUB_OWNER GITHUB_REPO NPM_NAME
  GITHUB_OWNER="$(jq -r '.search_names.github.owner' "$INPUT_CONFIG_PATH")"
  GITHUB_REPO="$(jq -r '.search_names.github.repo' "$INPUT_CONFIG_PATH")"
  NPM_NAME="$(jq -r '.search_names.npm.name' "$INPUT_CONFIG_PATH")"

  # リポジトリのオーナー名とリポジトリ名を返す（情報ログ）
  printf '%s %s %s の貢献度を算出します。\n' \
    "$GITHUB_OWNER" "$GITHUB_REPO" "$NPM_NAME" >&2

  # 値を関数呼び出し元に返す
  printf '%s %s %s\n' \
    "$GITHUB_OWNER" "$GITHUB_REPO" "$NPM_NAME"

  # 正常終了
  return 0
}

#--------------------------------------
# バージョンの表示
#--------------------------------------
function show_version() {
  printf '%s\n' "0.0.1" >&2
}

#--------------------------------------
# 使い方の表示
#--------------------------------------
function show_usage() {
  cat <<EOF >&2
    Usage:
      $0
      $0 -h
      $0 --help
      $0 -v
      $0 --version

    Description:
      指定したリポジトリのOSS業界への貢献度を算出します。

    Parameters:
      -h, --help        ヘルプを表示
      -v, --version     バージョンを表示

    Output:
      npm_download_count,github_star_count
EOF

  return 0
}
