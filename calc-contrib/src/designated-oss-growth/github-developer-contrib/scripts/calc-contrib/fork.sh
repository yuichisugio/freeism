#!/bin/bash

#--------------------------------------
# forkした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# fork関数を定義
#--------------------------------------
function calc_fork() {

  printf '%s\n' "begin:calc_fork()"

  calc_contrib_utils \
    --task-name "fork" \
    --repo-creation-to-task-period "true"

  printf '%s\n' "end:calc_fork()"

  return 0
}
