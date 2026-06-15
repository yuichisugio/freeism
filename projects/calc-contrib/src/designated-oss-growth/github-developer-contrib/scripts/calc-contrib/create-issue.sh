#!/bin/bash

#--------------------------------------
# create_issueした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# create_issue関数を定義
#--------------------------------------
function calc_create_issue() {

  printf '%s\n' "begin:calc_create_issue()"

  calc_contrib_utils \
    --task-name "create_issue" \
    --repo-creation-to-task-period "true" \
    --amount-of-work "true" \
    --amount-of-reaction "true" \
    --state "true"

  printf '%s\n' "end:calc_create_issue()"

  return 0
}
