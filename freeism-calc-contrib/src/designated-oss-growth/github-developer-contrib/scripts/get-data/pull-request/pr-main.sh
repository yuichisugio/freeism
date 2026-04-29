#!/bin/bash

#--------------------------------------
# pull requestのデータ取得を統合するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RESULT_GET_PR_DIR="${OUTPUT_GET_DIR}/pull-request"
mkdir -p "$RESULT_GET_PR_DIR"
# プルリクエストのnode_idを取得するファイル
readonly RESULT_GET_PR_NODE_ID_PATH="${RESULT_GET_PR_DIR}/result-pr-node-id.json"
# プルリクエストのコメントのnode_idを取得するファイル
readonly RESULT_GET_PR_COMMENT_NODE_ID_PATH="${RESULT_GET_PR_DIR}/result-pr-comment.json"
# プルリクエストのレビューのnode_idを取得するファイル
readonly RESULT_GET_PR_REVIEW_NODE_ID_PATH="${RESULT_GET_PR_DIR}/result-pr-review.json"
# プルリクエストのレビューのコメントのnode_idを取得するファイル
readonly RESULT_GET_PR_REVIEW_COMMENT_NODE_ID_PATH="${RESULT_GET_PR_DIR}/result-pr-review-comment.json"

#--------------------------------------
# 使用するファイルを読み込む
#--------------------------------------
readonly GET_PR_DIR="${GET_DIR}/pull-request"
source "${GET_PR_DIR}/pr-node-id.sh"
source "${GET_PR_DIR}/pr-reaction.sh"
source "${GET_PR_DIR}/pr-now-assigned-actors.sh"
source "${GET_PR_DIR}/pr-now-label.sh"
source "${GET_PR_DIR}/pr-comment.sh"
source "${GET_PR_DIR}/pr-comment-reaction.sh"
source "${GET_PR_DIR}/pr-review.sh"
source "${GET_PR_DIR}/pr-review-reaction.sh"
source "${GET_PR_DIR}/pr-review-comment.sh"
source "${GET_PR_DIR}/pr-review-comment-reaction.sh"
source "${GET_PR_DIR}/pr-timeline.sh"

#--------------------------------------
# プルリクエストのデータを取得する
#--------------------------------------
function get_pull_request() {

  local before_remaining_ratelimit

  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-pull-request()")"

  # プルリクエストのnode_idと各種フィールドのtotalCountを取得
  get_pull_request_node_id

  # プルリクエストのリアクションを取得
  get_pull_request_reaction

  # プルリクエストの現在の担当者を取得
  get_pull_request_now_assigned_actors

  # プルリクエストの現在のラベルを取得
  get_pull_request_now_label

  # プルリクエストのコメントを取得
  get_pull_request_comment

  # プルリクエストのコメントのリアクションを取得
  get_pull_request_comment_reaction

  # # プルリクエストのレビューを取得
  get_pull_request_review

  # プルリクエストのレビューのリアクションを取得
  get_pull_request_review_reaction

  # # プルリクエストのレビューコメントを取得
  get_pull_request_review_comment

  # # プルリクエストのレビューコメントのリアクションを取得
  get_pull_request_review_comment_reaction

  # プルリクエストのクローズorマージした人のタイムラインを取得
  get_pull_request_timeline

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-pull-request()" \
    "$before_remaining_ratelimit" \
    "false"
}
