#!/bin/bash

#--------------------------------------
# reactionした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# reaction関数を定義
#--------------------------------------
function calc_reaction() {

  printf '%s\n' "begin:calc_reaction()"

  calc_contrib_utils \
    --task-name "reaction" \
    --repo-creation-to-task-period "true" \
    --response-speed "true"

  printf '%s\n' "end:calc_reaction()"

  return 0
}
