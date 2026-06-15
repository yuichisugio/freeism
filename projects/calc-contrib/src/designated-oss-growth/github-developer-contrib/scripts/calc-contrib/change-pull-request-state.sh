#!/bin/bash

#--------------------------------------
# change_pull_request_stateした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# change_pull_request_state関数を定義
#--------------------------------------
function calc_change_pull_request_state() {

  printf '%s\n' "begin:calc_change_pull_request_state()"

  calc_contrib_utils \
    --task-name "change_pull_request_state" \
    --repo-creation-to-task-period "true" \
    --response-speed "true" \
    --amount-of-work "true" \

  printf '%s\n' "end:calc_change_pull_request_state()"

  return 0
}
