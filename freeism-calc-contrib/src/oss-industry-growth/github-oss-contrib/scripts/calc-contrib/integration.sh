#!/bin/bash

#--------------------------------------
# 貢献度の算出を統合するファイル
#--------------------------------------

set -euo pipefail

# --------------------------------------
# 出力先のディレクトリ/ファイルを作成する
# --------------------------------------
# 加工したデータを入れるディレクトリ
readonly OUTPUT_CALC_CONTRIB_DIR="${OUTPUT_DIR}/calc-contrib"
mkdir -p "$OUTPUT_CALC_CONTRIB_DIR"
# 統合したデータのパス
readonly OUTPUT_CALC_CONTRIB_JSON_PATH="${OUTPUT_CALC_CONTRIB_DIR}/result.json"
readonly OUTPUT_CALC_CONTRIB_CSV_PATH="${OUTPUT_CALC_CONTRIB_DIR}/result.csv"

#--------------------------------------
# データ加工を統合する関数
#--------------------------------------
function calc_contrib() {

  printf '%s\n' "begin:calc_contrib()"

  # 統合したデータをjson形式で出力
  jq \
    '
		# 入力（加工済み統合データ）から重みと値を取得
		.meta as $meta
		| $meta.weighting.npm_download_count.per_install as $npm_w
		| $meta.weighting.github_star_count.per_star as $star_w
		| .data.npm_download_count.value as $npm_v
		| .data.github_star_count.value as $star_v

		# 出力（calced.json と同構造）
		| {
			meta: $meta,
			data: {
				contribution_point: ($npm_v * $npm_w + $star_v * $star_w),
				npm_download_count: {
					value: $npm_v,
					contribution_point: ($npm_v * $npm_w)
				},
				github_star_count: {
					value: $star_v,
					contribution_point: ($star_v * $star_w)
				}
			}
		}
		' \
    "$OUTPUT_PROCESSED_INTEGRATED_DATA_PATH" \
    >"$OUTPUT_CALC_CONTRIB_JSON_PATH"

  # 統合したデータをcsv形式で出力

  # データ行
  jq \
    -r \
    '
      def nn: if . == null then "" else tostring end;

      .data as $data
      | ([
          "contribution_point",
          "npm_download_value",
          "npm_download_point",
          "github_star_value",
          "github_star_point"
        ] | @csv),

      ([
				($data.contribution_point | nn),
				($data.npm_download_count.value | nn),
				($data.npm_download_count.contribution_point | nn),
				($data.github_star_count.value | nn),
				($data.github_star_count.contribution_point | nn)
			] | @csv)
		' \
    "$OUTPUT_CALC_CONTRIB_JSON_PATH" \
    >"$OUTPUT_CALC_CONTRIB_CSV_PATH"

  printf '%s\n' "end:calc_contrib()"
}
