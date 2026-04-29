#!/bin/bash

# 使用したOSSの必要性（貢献度）を分析

#--------------------------------------
# 準備（エラー対応、相対PATH安定、依存コマンドの確認、gh 認証確認）
#--------------------------------------
set -euo pipefail

# 相対PATHを安定させる
PROJECT_DIR=$(cd "$(dirname -- "$0")" && pwd -P)
cd "$PROJECT_DIR"

# 依存コマンドの確認
if ! command -v jq >/dev/null; then
  echo "ERROR: jq が必要です。" >&2
  exit 1
fi

# デフォルト値
dependencies_json=${1:-$PROJECT_DIR/dependencies.json}
config_json=${2:-$PROJECT_DIR/config.json}

#--------------------------------------
# 使い方の表示
#--------------------------------------
function show_usage() {
  cat <<EOF >&2
Usage:
  $0 -d dependencies.json -c config.json
  $0 --dependencies dependencies.json --config config.json

Description:
  dependencies.json と config.json を読み込み、所定のJSON形式で出力します。

Options:
  -d, --dependencies :  <dependencies.json> 依存OSSの一覧
  -c, --config       :  <config.json> 評価基準
  -h, --help         : ヘルプを表示
EOF
  return 0
}

#--------------------------------------
# 引数の取得
#--------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
  -d | --dependencies)
    dependencies_json="$2"
    shift 2
    ;;
  -c | --config)
    config_json="$2"
    shift 2
    ;;
  -h | --help)
    show_usage
    exit 1
    ;;
  *)
    printf '%s\n' "Unknown option: $1" >&2
    show_usage
    exit 1
    ;;
  esac
done

#--------------------------------------
# 引数のバリデーション
#--------------------------------------
# ファイルが存在するか確認
for file in "${dependencies_json}" "${config_json}"; do
  if [[ ! -f ${file} ]]; then
    echo "ERROR: file ${file} is not a file" >&2
    exit 1
  fi
done

# ファイルが空でないか確認
for file in "${dependencies_json}" "${config_json}"; do
  if [[ ! -s ${file} ]]; then
    echo "ERROR: file ${file} is empty" >&2
    exit 1
  fi
done

# ファイルが有効なJSONか確認
for file in "${dependencies_json}" "${config_json}"; do
  if ! jq '.' "${file}" >/dev/null; then
    echo "Error: file ${file} is not a valid JSON file" >&2
    exit 1
  fi
done

#--------------------------------------
# メイン処理
#--------------------------------------
function process_dependencies_json() {
  local OUTPUT_JSON_DIR
  OUTPUT_JSON_DIR=${1:-}
  local TODAY
  TODAY=$(date +%Y%m%d_%H:%M:%S)

  jq -n \
    --slurpfile deps "${dependencies_json}" \
    --slurpfile cfg "${config_json}" \
    '
      # 有効な評価基準（enabled==true）の集合とデフォルト値マップ
      def enabledCrit: ($cfg[0].evaluationCriteria // [] | map(select(.enabled == true)));

      # 有効な評価基準のキーの集合
      def allowedKeys: (enabledCrit | map(.key));

      # デフォルト値マップ
      def defaults: (enabledCrit | map({(.key): .value}) | add // {});

      # 数値化（number型 or 数値文字列のみ採用）
      def to_num:
        if type=="number" then .
        elif type=="string" then (try (tonumber) catch empty)
        else empty
        end;

      {
        meta: ($deps[0].meta),
        data: (($deps[0].data // []) | map(
          . as $item
          |
          # 既存評価基準（なければ空オブジェクト）
          (($item.evaluation.evaluationCriteria) // {}) as $crit0
          |
          # 無効キーの削除（allowedKeysに無いキーを落とす）
          ($crit0 | with_entries(select(.key as $k | (allowedKeys | index($k))))) as $crit1
          |
          # 未設定キーの補完（defaults + 既存で既存値を優先）
          (defaults + $crit1) as $crit
          |
          # 平均値の算出（数値/数値文字列のみ対象）
          ([ $crit[] | to_num ]) as $vals
          | ($vals | length) as $cnt
          | (if $cnt > 0 then (($vals | add) / $cnt) else null end) as $avg
          |
          # 出力組み立て（元要素を維持しつつevaluationを更新）
          $item
          | .evaluation = { result: $avg, evaluationCriteria: $crit }
        ))
      }
    ' >"${OUTPUT_JSON_DIR}/result-${TODAY}.json"
}

#--------------------------------------
# 出力ファイルの準備
#--------------------------------------
function prepare_output_file() {
  local name
  name=$(
    jq -r '
      # meta.specified-oss から安全に owner/repo を組み立て
      def from_meta:
        (.meta["specified-oss"]? // {}) as $m
        | ($m.owner // empty)      as $o
        | ($m.Repository // $m.repository // empty) as $r
        | select(($o|type)=="string" and ($o|length)>0 and ($r|type)=="string" and ($r|length)>0)
        | "\($o)_\($r)";

      # data[].repo ("owner/name") からのフォールバック
      def from_data:
        (.data // [])
        | map(.repo? | select(type=="string"))
        | map(capture("(?<owner>[^/]+)/(?<name>[^/]+)"))
        | (if length>0 then "\(.[0].owner)_\(.[0].name)" else empty end);

      from_meta // from_data // "unknown"
    ' "${dependencies_json}"
  )

  local dir="./results/${name}"
  mkdir -p "$dir"
  echo "$dir"
  echo "SUCCESS! $dir" >&2
}

#--------------------------------------
# メイン関数
#--------------------------------------
function main() {
  local OUTPUT_JSON_DIR
  OUTPUT_JSON_DIR=$(prepare_output_file)
  process_dependencies_json "${OUTPUT_JSON_DIR}"
}

#--------------------------------------
# メイン関数の実行
#--------------------------------------
main "$@"
