#!/bin/bash

#--------------------------------------
# discussionのデータ加工を統合するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RESULT_PROCESSED_DISCUSSION_DIR="${OUTPUT_PROCESSED_DIR}/discussion"
mkdir -p "$RESULT_PROCESSED_DISCUSSION_DIR"

#--------------------------------------
# 使用するファイルを読み込む
#--------------------------------------
readonly PROCESS_DISCUSSION_DIR="${PROCESS_DIR}/discussion"
source "${PROCESS_DISCUSSION_DIR}/discus-create.sh"
source "${PROCESS_DISCUSSION_DIR}/discus-comment.sh"
source "${PROCESS_DISCUSSION_DIR}/discus-comment-reaction.sh"
source "${PROCESS_DISCUSSION_DIR}/discus-reaction.sh"
source "${PROCESS_DISCUSSION_DIR}/discus-comment-reply.sh"
source "${PROCESS_DISCUSSION_DIR}/discus-comment-reply-reaction.sh"
source "${PROCESS_DISCUSSION_DIR}/discus-answer-reaction.sh"
source "${PROCESS_DISCUSSION_DIR}/discus-answer-reply.sh"
source "${PROCESS_DISCUSSION_DIR}/discus-answer-reply-reaction.sh"
source "${PROCESS_DISCUSSION_DIR}/discus-answer.sh"

#--------------------------------------
# answer_discussionのタスク名
# 別ファイルで使用するので、変更の際忘れないように記載
#--------------------------------------
readonly ANSWER_TASK_NAME="answer_discussion"

#--------------------------------------
# discussionのデータを加工する関数
#--------------------------------------
function process_discussion() {

  printf '%s\n' "begin:process-discussion()"

  # discussionの作成者を評価
  process_discussion_create

  # discussionのコメントした人を評価
  process_discussion_comment

  # discussionのコメントにリアクションした人を評価
  process_discussion_comment_reaction

  # discussionのリアクションを評価
  process_discussion_reaction

  # discussionへのコメントにリプライした人を評価
  process_discussion_comment_reply

  # discussionへのコメントにリプライにリアクションした人を評価
  process_discussion_comment_reply_reaction

  # discussionの回答にリアクションした人を評価
  process_discussion_answer_reaction

  # discussionの回答にリプライした人を評価
  process_discussion_answer_reply

  # discussionの回答にリプライにリアクションした人を評価
  process_discussion_answer_reply_reaction

  # discussionの回答を評価
  process_discussion_answer

  printf '%s\n' "end:process-discussion()"

  return 0
}
