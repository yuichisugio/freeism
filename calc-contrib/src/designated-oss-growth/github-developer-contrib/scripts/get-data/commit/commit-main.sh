#!/bin/bash

#--------------------------------------
# コミットのデータ取得を統合するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RESULT_GET_COMMIT_DIR="${OUTPUT_GET_DIR}/commit"
mkdir -p "$RESULT_GET_COMMIT_DIR"
# コミットのデータ&node_idを取得するファイル
readonly RESULT_GET_COMMIT_NODE_ID_WITH_PR_PATH="${RESULT_GET_COMMIT_DIR}/result-commit-node-id-with-pr.json"
# コミットのコメントのデータ&node_idを取得するファイル
readonly RESULT_GET_COMMIT_COMMENT_PATH="${RESULT_GET_COMMIT_DIR}/result-commit-comment.json"

#--------------------------------------
# 使用するファイルを読み込む
#--------------------------------------
readonly GET_COMMIT_DIR="${GET_DIR}/commit"
source "${GET_COMMIT_DIR}/commit-node-id-with-pr.sh"
source "${GET_COMMIT_DIR}/commit-comment.sh"
source "${GET_COMMIT_DIR}/commit-comment-reaction.sh"

#--------------------------------------
# コミットのデータを取得する
#--------------------------------------
function get_commit() {

  local before_remaining_ratelimit

  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-commit()")"

  # コミットのnode_idと各種フィールドのtotalCountを取得
  get_commit_node_id_with_pr

  # コミットのコメントを取得
  get_commit_comment

  # コミットのコメントのリアクションを取得
  get_commit_comment_reaction

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-commit()" \
    "$before_remaining_ratelimit" \
    "false"
}
