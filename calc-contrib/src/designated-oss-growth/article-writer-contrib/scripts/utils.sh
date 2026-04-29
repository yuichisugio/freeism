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

  # 引数
  local INPUT_CONFIG_PATH="${PROJECT_DIR}/input-config.json"
  local QIITA_TOKEN=""

  # --- 引数パース。引数がある場合はデフォルト値を上書きする ---
  while [[ $# -gt 0 ]]; do
    case "$1" in
    -i | --input-config)
      INPUT_CONFIG_PATH="$2"
      shift 2
      ;;
    -h | --help)
      show_usage
      exit 1
      ;;
    -v | --version)
      show_version
      exit 1
      ;;
    --qiita-token)
      QIITA_TOKEN="$2"
      shift 2
      ;;
    *)
      printf '%s\n' "Unknown option: $1" >&2
      show_usage
      exit 1
      ;;
    esac
  done

  # 値を関数呼び出し元に返す
  printf '%s %s\n' \
    "$INPUT_CONFIG_PATH" \
    "$QIITA_TOKEN"

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
      $0 -i, --input-config <input-config.json>
      $0 --qiita-token <qiita-token>
      $0 -h
      $0 --help
      $0 -v
      $0 --version

    Description:
      記事を書くことによる、指定したOSSへの貢献度を算出します。

    Parameters:
      -i, --input-config <input-config.json>
      --qiita-token <qiita-token>
      -h, --help        ヘルプを表示
      -v, --version     バージョンを表示

    Output:
      zenn_contributor,qiita_contributor,note_contributor,hatena_contributor
EOF

  return 0
}
