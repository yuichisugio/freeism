#!/bin/bash

#--------------------------------------
# GitHub Dependency Graph の SBOM を取得して、purl形式で、依存ライブラリを出力する
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力ファイルの準備
#--------------------------------------
readonly RAW_GITHUB_SBOM_PATH="${RESULTS_DIR}/github-sbom/raw.json"
readonly RESULT_GITHUB_SBOM_PATH="${RESULTS_DIR}/github-sbom/result.json"
mkdir -p "$(dirname "${RAW_GITHUB_SBOM_PATH}")"

# ----------------------------------------
# GitHub Dependency Graph の SBOM を取得して、purl形式で、依存ライブラリを出力する関数
# ----------------------------------------
function get_github_sbom() {

  printf '%s\n' "start: github-sbom"

  #--------------------------------------
  # 1) SBOM の取得
  #--------------------------------------
  gh api \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/${OWNER}/${REPO}/dependency-graph/sbom" |
    jq '.' >"${RAW_GITHUB_SBOM_PATH}"

  #--------------------------------------
  # 2) purl 抽出 & 期待フォーマットで出力
  #--------------------------------------
  jq -n \
    --arg createdAt "$(date +%Y-%m-%d_%H:%M:%S)Z" \
    --arg owner "${OWNER}" \
    --arg repository "${REPO}" \
    --slurpfile sbom "${RAW_GITHUB_SBOM_PATH}" \
    '
    # $sbom[0] は取得した SBOM 全体
    # externalRefs[].referenceType == "purl" の referenceLocator を収集
    # パッケージ配列
    ($sbom[0].sbom.packages // [])
    | [
        .[]
        | (.externalRefs // [])[]?
        | select(.referenceType == "purl")
        | { purl: .referenceLocator
          , loc:  (.referenceLocator | sub("^pkg:"; "") | split("?")[0])
          }
      ]
    | map(
        . as $item
        | ($item.loc | split("/")) as $parts
        | ($parts[0])     as $host
        | ($parts[1:-1])  as $ns_parts
        | ($parts[-1])    as $namever
        | {
            host: $host,
            repo: (
              ( $ns_parts + [ ( $namever | (if test("@") then split("@")[0] else . end)) ] )
              | join("/")
              | gsub("%40"; "@")
            ),
            purl: $item.purl
          }
      )
    | unique_by(.host + ":" + .repo)

    # 期待フォーマットに整形
    | {
        meta: {
          createdAt: $createdAt,
          "specified-oss": { owner: $owner, Repository: $repository }
        },
        data: .
      }
' | jq '.' >"${RESULT_GITHUB_SBOM_PATH}"

  printf '%s\n' "end: github-sbom"
}
