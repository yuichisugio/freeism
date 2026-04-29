#!/bin/bash

#--------------------------------------
# commentした人の貢献度の算出のファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# comment関数を定義
#--------------------------------------
function calc_comment() {

  printf '%s\n' "begin:calc_comment()"

  calc_contrib_utils \
    --task-name "comment" \
    --repo-creation-to-task-period "true" \
    --amount-of-work "true" \
    --amount-of-reaction "true" \
    --response-speed "true"

  printf '%s\n' "end:calc_comment()"

  return 0
}
