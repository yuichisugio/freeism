#!/bin/bash

#--------------------------------------
# create_releaseした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# create_release関数を定義
#--------------------------------------
function calc_create_release() {

  printf '%s\n' "begin:calc_create_release()"

  calc_contrib_utils \
    --task-name "create_release" \
    --repo-creation-to-task-period "true" \
    --amount-of-work "true" \
    --amount-of-reaction "true"

  printf '%s\n' "end:calc_create_release()"

  return 0
}
