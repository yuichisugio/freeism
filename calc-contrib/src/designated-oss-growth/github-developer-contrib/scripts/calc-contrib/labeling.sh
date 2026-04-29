#!/bin/bash

#--------------------------------------
# labelingした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# labeling関数を定義
#--------------------------------------
function calc_labeling() {

  printf '%s\n' "begin:calc_labeling()"

  calc_contrib_utils \
    --task-name "labeling" \
    --repo-creation-to-task-period "true" \
    --response-speed "true"

  printf '%s\n' "end:calc_labeling()"

  return 0
}
