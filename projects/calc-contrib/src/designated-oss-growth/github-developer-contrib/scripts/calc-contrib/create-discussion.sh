#!/bin/bash

#--------------------------------------
# create_discussionした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# create_discussion関数を定義
#--------------------------------------
function calc_create_discussion() {

  printf '%s\n' "begin:calc_create_discussion()"

  calc_contrib_utils \
    --task-name "create_discussion" \
    --repo-creation-to-task-period "true" \
    --response-speed "true" \
    --amount-of-work "true" \
    --amount-of-reaction "true" \
    --state "true"

  printf '%s\n' "end:calc_create_discussion()"

  return 0
}
