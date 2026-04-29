#!/bin/bash

#--------------------------------------
# データ加工を統合するファイル
#--------------------------------------

set -euo pipefail

# --------------------------------------
# 出力先のディレクトリ/ファイルを作成する
# --------------------------------------
# 加工したデータを入れるディレクトリ
readonly OUTPUT_PROCESSED_DIR="${OUTPUT_DIR}/processed-data"
mkdir -p "$OUTPUT_PROCESSED_DIR"
# 統合したデータのパス
readonly OUTPUT_PROCESSED_INTEGRATED_DATA_PATH="${OUTPUT_PROCESSED_DIR}/integrated-processed-data.json"

#--------------------------------------
# 使用するファイルを読み込む
#--------------------------------------
readonly PROCESS_DIR="${SCRIPT_DIR}/scripts/process-data"
source "${PROCESS_DIR}/npm-downloads.sh"
source "${PROCESS_DIR}/github-star.sh"

#--------------------------------------
# データ加工を統合する関数
#--------------------------------------
function process_data() {

  printf '%s\n' "begin:process_data()"

  process_npm_downloads
  process_github_star

  # 統合したデータを出力
  jq \
    -n \
    --slurpfile input_config "$INPUT_CONFIG_PATH" \
    --slurpfile npm "$OUTPUT_PROCESSED_NPM_DOWNLOADS_PATH" \
    --slurpfile ghstar "$OUTPUT_PROCESSED_GITHUB_STAR_PATH" \
    --arg createdAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg since "1970-01-01T00:00:00Z" \
    --arg until "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '
      {
        meta: {
          createdAt: $createdAt,
          analysisPeriod: {
            since: $since,
            until: $until
          },
          search_names: $input_config[0].search_names,
          weighting: $input_config[0].weighting
        },
        data: {
          npm_download_count: {
            value: $npm[0].npm_download_count
          },
          github_star_count: {
            value: $ghstar[0].github_star_count
          }
        }
      }
    ' >"$OUTPUT_PROCESSED_INTEGRATED_DATA_PATH"

  printf '%s\n' "end:process_data()"
}
