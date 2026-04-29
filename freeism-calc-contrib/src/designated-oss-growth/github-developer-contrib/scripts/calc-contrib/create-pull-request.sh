#!/bin/bash

#--------------------------------------
# create_pull_requestした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# create_pull_request関数を定義
#--------------------------------------
function calc_create_pull_request() {

  printf '%s\n' "begin:calc_create_pull_request()"

  calc_contrib_utils \
    --task-name "create_pull_request" \
    --repo-creation-to-task-period "true" \
    --amount-of-work "true" \
    --amount-of-reaction "true" \
    --state "true"

  printf '%s\n' "end:calc_create_pull_request()"

  return 0
}
