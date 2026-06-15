#!/bin/bash

#--------------------------------------
# answer_discussionした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# answer_discussion関数を定義
#--------------------------------------
function calc_answer_discussion() {

  printf '%s\n' "begin:calc_answer_discussion()"

  calc_contrib_utils \
    --task-name "answer_discussion" \
    --repo-creation-to-task-period "true" \
    --amount-of-work "true" \
    --amount-of-reaction "true" \
    --response-speed "true"

  printf '%s\n' "end:calc_answer_discussion()"

  return 0
}
