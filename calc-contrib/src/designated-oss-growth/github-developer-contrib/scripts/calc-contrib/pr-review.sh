#!/bin/bash

#--------------------------------------
# pr_reviewした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# pr_review関数を定義
#--------------------------------------
function calc_pr_review() {

  printf '%s\n' "begin:calc_pr_review()"

  calc_contrib_utils \
    --task-name "pr_review" \
    --repo-creation-to-task-period "true" \
    --response-speed "true" \
    --amount-of-work "true" \
    --amount-of-reaction "true"

  printf '%s\n' "end:calc_pr_review()"

  return 0
}
