#!/bin/bash

# OpenRankを取得する

# エラーが発生でスクリプトを終了。未定義でエラー。パイプ中エラーでも中断
set -euo pipefail

# 相対PATHを安定させる
cd "$(cd "$(dirname -- "$0")" && pwd -P)"

# OpenRankを取得する
get_open_rank() {
  local owner="yoshiko-pg"
  local repo="difit"
  local output_file="output/open-rank.json"

  curl -s "https://oss.open-digger.cn/github/$owner/$repo/community_openrank.json" | jq -r '.[]' | tee "$output_file"

  return 0
}

# メイン関数
main() {
  get_open_rank

  return 0
}

# スクリプトを実行。
main
