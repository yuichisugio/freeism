#!/bin/bash

#--------------------------------------
# watchした人の貢献度を算出するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# watchした人の貢献度を算出する関数
#--------------------------------------
function calc_watch() {

  printf '%s\n' "begin:calc_watch()"

  calc_contrib_utils \
    --task-name "watch"

  printf '%s\n' "end:calc_watch()"

  return 0
}
