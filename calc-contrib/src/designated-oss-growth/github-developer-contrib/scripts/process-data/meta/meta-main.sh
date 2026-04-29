#!/bin/bash

#--------------------------------------
# リポジトリのメタデータを加工する
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のディレクトリを作成する
#--------------------------------------
readonly RESULT_PROCESSED_REPO_META_PATH="${OUTPUT_PROCESSED_DIR}/repo-meta/result-repo-meta.json"
mkdir -p "$(dirname "$RESULT_PROCESSED_REPO_META_PATH")"

#--------------------------------------
# リポジトリのメタデータを加工する関数
#--------------------------------------
function process_repo_meta() {

  printf '%s\n' "begin:process_repo_meta()"

  jq '{
        host:                 "github.com",
        ownerUsername:        .data.repository.owner.login,
        ownerUserId:          (.data.repository.owner.id|tostring),
        repositoryName:       .data.repository.name,
        repositoryId:         (.data.repository.id|tostring),
        repositoryUrl:        .data.repository.url,
        createdAt:            .data.repository.createdAt,
        defaultBranch:        .data.repository.defaultBranchRef.name
      }' "$RESULT_GET_REPO_META_PATH" >"$RESULT_PROCESSED_REPO_META_PATH"

  printf '%s\n' "end:process_repo_meta()"

  return 0
}
