#!/bin/bash

#--------------------------------------
# create_commit_with_prした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# create_commit_with_pr関数を定義
#--------------------------------------
function calc_create_commit_with_pr() {

  printf '%s\n' "begin:calc_create_commit_with_pr()"

  calc_contrib_utils \
    --task-name "create_commit_with_pr" \
    --repo-creation-to-task-period "true" \
    --amount-of-work "true"

  printf '%s\n' "end:calc_create_commit_with_pr()"

  return 0
}
