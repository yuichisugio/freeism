#!/bin/bash

# resultsディレクトリのデータを削除する

set -euo pipefail

# どこから実行しても相対PATHを安定させる
cd "$(dirname "$0")"

# 引数がない場合のダミーを入れる。set -uのエラーを回避するため。
arg1=${1:-"all"}

# ヘルプを表示する関数
function show_usage() {
  cat <<EOF
  Usage:
    $0
    $0 [-i|-p|-m]
    $0 [-h|--help]

  Description:
    Delete the data in the results directory.

  Options:
    -i: Delete only the issue directory.
    -p: Delete only the pull-request directory.
    -m: Delete only the main directory.

  Examples:
    $0
    $0 -i
    $0 -p
    $0 -m
EOF

  return 0
}

# ヘルプを表示する
if [[ $arg1 == "-h" || $arg1 == "--help" ]]; then
  show_usage
  exit 0
fi

# resultsディレクトリが存在しない場合はエラーを表示する
if [[ ! -d results ]]; then
  echo "resultsディレクトリが存在しません"
  exit 1
fi

# 引数がない場合は、すべてのresultsディレクトリのデータを削除する
if [[ $# -eq 0 ]]; then
  rm -rf results/*
  exit 0
fi

# issueディレクトリのみ削除する
if [[ $arg1 == "-i" || $arg1 == "issue" ]]; then
  rm -rf results/issue
  exit 0
fi

# pull-requestディレクトリのみ削除する
if [[ $arg1 == "-p" || $arg1 == "pull-request" ]]; then
  rm -rf results/pull-request
  exit 0
fi

# mainディレクトリのみ削除する
if [[ $arg1 == "-m" || $arg1 == "main" ]]; then
  rm -rf results/main
  exit 0
fi

# 無効な引数です
echo "無効な引数です" 2>&1
show_usage
exit 1
