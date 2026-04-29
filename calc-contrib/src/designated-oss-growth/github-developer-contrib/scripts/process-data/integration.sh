#!/bin/bash

#--------------------------------------
# データ加工を統合するファイル
#--------------------------------------

set -euo pipefail

# --------------------------------------
# 出力先のディレクトリ/ファイルを作成する
# --------------------------------------
# 加工したデータを入れるディレクトリ
readonly OUTPUT_PROCESSED_DIR="${OUTPUT_DIR}/processed-data"
mkdir -p "$OUTPUT_PROCESSED_DIR"
# 統合したデータのパス
readonly RESULT_PROCESSED_INTEGRATED_DATA_PATH="${OUTPUT_PROCESSED_DIR}/integrated-processed-data.json"

#--------------------------------------
# 使用するファイルを読み込む
#--------------------------------------
readonly PROCESS_DIR="${SCRIPT_DIR}/scripts/process-data"
source "${PROCESS_DIR}/process-data-utils.sh"
source "${PROCESS_DIR}/issue/issue-main.sh"
source "${PROCESS_DIR}/discussion/discus-main.sh"
source "${PROCESS_DIR}/commit/commit-main.sh"
source "${PROCESS_DIR}/pull-request/pr-main.sh"
source "${PROCESS_DIR}/release/release-main.sh"
source "${PROCESS_DIR}/star.sh"
source "${PROCESS_DIR}/fork.sh"
source "${PROCESS_DIR}/watch.sh"
source "${PROCESS_DIR}/sponsor.sh"
source "${PROCESS_DIR}/repo-meta.sh"

#--------------------------------------
# データ加工を統合する関数
#--------------------------------------
function process_data() {
  printf '%s\n' "begin:process_data()"

  # どんなタスクが選ばれても必須で、リポジトリのメタデータを加工する。
  process_repo_meta

  # 実行するファイルを選択
  if should_run --task_word "star" --arg_word "$@"; then process_star; fi
  if should_run --task_word "fork" --arg_word "$@"; then process_fork; fi
  if should_run --task_word "sponsor" --arg_word "$@"; then process_sponsor; fi
  if should_run --task_word "watch" --arg_word "$@"; then process_watch; fi

  if should_run \
    --task_word "issue,create_issue,change_issue_state,assigning,labeling,comment,reaction" \
    --arg_word "$@"; then
    process_issue
  fi

  if should_run \
    --task_word "pull-request,create_pull_request,change_pull_request_state,assigning,labeling,pr_review,comment,reaction" \
    --arg_word "$@"; then
    process_pull_request
  fi

  if should_run \
    --task_word "release,create_release,reaction" \
    --arg_word "$@"; then
    process_release
  fi

  if should_run \
    --task_word "commit,create_commit_with_pr,commit_with_pr,comment,reaction" \
    --arg_word "$@"; then
    process_commit
  fi

  if should_run \
    --task_word "discussion,create_discussion,answer_discussion,comment,reaction" \
    --arg_word "$@"; then
    process_discussion
  fi

  # データ加工した、それぞれのファイルを一つのファイルに統合する
  integrate_processed_files "$RESULT_PROCESSED_INTEGRATED_DATA_PATH"

  printf '%s\n' "end:process_data()"
}
