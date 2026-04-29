#!/bin/bash

#--------------------------------------
# change_issue_stateした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# change_issue_state関数を定義
#--------------------------------------
function calc_change_issue_state() {

  printf '%s\n' "begin:calc_change_issue_state()"

  calc_contrib_utils \
    --task-name "change_issue_state" \
    --repo-creation-to-task-period "true" \
    --amount-of-work "true" \
    --response-speed "true"

  printf '%s\n' "end:calc_change_issue_state()"

  return 0
}
