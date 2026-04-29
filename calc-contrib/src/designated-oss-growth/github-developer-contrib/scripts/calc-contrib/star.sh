#!/bin/bash

#--------------------------------------
# starを押した人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# star関数を定義
#--------------------------------------
function calc_star() {

  printf '%s\n' "begin:calc_star()"

  calc_contrib_utils \
    --task-name "star" \
    --repo-creation-to-task-period "true"

  printf '%s\n' "end:calc_star()"

  return 0
}
