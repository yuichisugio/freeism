#!/bin/bash

#--------------------------------------
# discussionのデータ取得を統合するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RESULT_GET_DISCUSSION_DIR="${OUTPUT_GET_DIR}/discussion"
mkdir -p "$RESULT_GET_DISCUSSION_DIR"
# discussionのnode_idを取得するファイル
readonly RESULT_GET_DISCUSSION_NODE_ID_PATH="${RESULT_GET_DISCUSSION_DIR}/result-discus-node-id.json"
# discussionのコメントのnode_idを取得するファイル
readonly RESULT_GET_DISCUSSION_COMMENT_NODE_ID_PATH="${RESULT_GET_DISCUSSION_DIR}/result-discus-comment.json"
# discussionのコメントのリプライのnode_idを取得するファイル
readonly RESULT_GET_DISCUSSION_COMMENT_REPLY_NODE_ID_PATH="${RESULT_GET_DISCUSSION_DIR}/result-discus-comment-reply.json"
readonly RESULT_GET_DISCUSSION_ANSWER_REPLY_NODE_ID_PATH="${RESULT_GET_DISCUSSION_DIR}/result-discus-answer-reply.json"
# discussionのanswerのnode_idを取得するファイル
readonly RESULT_GET_DISCUSSION_ANSWER_NODE_ID_PATH="${RESULT_GET_DISCUSSION_DIR}/result-discus-answer-node-id.json"

#--------------------------------------
# 使用するファイルを読み込む
#--------------------------------------
readonly GET_DISCUSSION_DIR="${GET_DIR}/discussion"
source "${GET_DISCUSSION_DIR}/discus-node-id.sh"
source "${GET_DISCUSSION_DIR}/discus-comment.sh"
source "${GET_DISCUSSION_DIR}/discus-comment-reaction.sh"
source "${GET_DISCUSSION_DIR}/discus-comment-reply.sh"
source "${GET_DISCUSSION_DIR}/discus-comment-reply-reaction.sh"
source "${GET_DISCUSSION_DIR}/discus-reaction.sh"
source "${GET_DISCUSSION_DIR}/discus-answer-reaction.sh"
source "${GET_DISCUSSION_DIR}/discus-answer-reply.sh"
source "${GET_DISCUSSION_DIR}/discus-answer-reply-reaction.sh"
source "${GET_DISCUSSION_DIR}/discus-answer-node-id.sh"

#--------------------------------------
# データ取得を統合する関数
#--------------------------------------
function get_discussion() {

  local before_remaining_ratelimit

  # データ取得前のRateLimitを取得
  before_remaining_ratelimit="$(get_ratelimit "before:get-discussion()")"

  # discussionのnode_idを取得
  get_discussion_node_id

  # discussionのanswerのnode_idを取得
  get_discussion_answer_node_id

  # discussionのリアクションを取得
  get_discussion_reaction

  # discussionのコメントを取得
  get_discussion_comment

  # discussionのコメントのリアクションを取得
  get_discussion_comment_reaction

  # discussionのコメントのリプライを取得
  get_discussion_comment_reply

  # discussionのコメントのリプライのリアクションを取得
  get_discussion_comment_reply_reaction

  # discussionの回答のリアクションを取得
  get_discussion_answer_reaction

  # discussionの回答のリプライを取得
  get_discussion_answer_reply

  # discussionの回答のリプライのリアクションを取得
  get_discussion_answer_reply_reaction

  # データ取得後のRateLimitを出力
  get_ratelimit \
    "after:get-discussion()" \
    "$before_remaining_ratelimit" \
    "false"
}
