#!/bin/bash

#--------------------------------------
# sponsorした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# sponsor関数を定義
#--------------------------------------
function calc_sponsor() {

  printf '%s\n' "begin:calc_sponsor()"

  calc_contrib_utils \
    --task-name "sponsor" \
    --repo-creation-to-task-period "true"

  printf '%s\n' "end:calc_sponsor()"

  return 0
}
