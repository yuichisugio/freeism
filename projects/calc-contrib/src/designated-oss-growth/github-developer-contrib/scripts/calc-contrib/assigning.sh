#!/bin/bash

#--------------------------------------
# assigningした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# assigning関数を定義
#--------------------------------------
function calc_assigning() {

  printf '%s\n' "begin:calc_assigning()"

  calc_contrib_utils \
    --task-name "assigning" \
    --repo-creation-to-task-period "true" \
    --response-speed "true"

  printf '%s\n' "end:calc_assigning()"

  return 0
}
