#!/bin/bash

# --------------------------------------
# npmのダウンロード数を取得するファイル
# --------------------------------------

set -euo pipefail

# --------------------------------------
# 出力先のパス
# --------------------------------------
readonly OUTPUT_GET_NPM_DOWNLOADS_PATH="${OUTPUT_GET_DIR}/npm-downloads.json"

# --------------------------------------
# npmのダウンロード数を取得する関数
# npm apiの最古公開日が2015-01-10で、
# npm apiは1回のクエリで18ヶ月のデータを取得できるので、
# 漏れないように17ヶ月ごとに日付をイテレートして取得する。
# --------------------------------------
function get_npm_downloads() {

  echo "begin:get_npm_downloads()"

  local pkg="${1:-${NPM_NAME:-}}"
  [[ -z "$pkg" ]] && {
    echo "package name required (arg or \$NPM_NAME)" >&2
    return 1
  }

  # 開始日
  local start="2015-01-10"
  # 開始月
  local end_month="05"
  local end_year="2016"
  # 終了日
  local end="${end_year}-${end_month}-10"
  # 今日の日付
  local today
  today="$(date -u +%Y-%m-%d)"

  # temp
  local tmp_data tmp_json
  tmp_data="$(mktemp)"
  tmp_json="$(mktemp)"
  trap 'rm -f "${tmp_data:-}" "${tmp_json:-}"' RETURN

  while :; do
    # 文字列日付を整数 YYYYMMDD に変換して比較（数値比較）
    local _s="${start//-/}"
    local _t="${today//-/}"
    local _e="${end//-/}"

    # ループ開始条件（start > today なら終了）
    if ((_s > _t)); then
      break
    fi

    # チャンク終端：end が今日を超えたら今日に丸める
    if ((_e > _t)); then
      end="$today"
      _e="${end//-/}"
    fi

    local url="https://api.npmjs.org/downloads/range/${start}:${end}/${pkg}"
    echo "GET $url" >&2

    curl -fsS "$url" -o "$tmp_json"
    cat "$tmp_json" >>"$tmp_data"

    # 今日まで取得し終えたらここで終了（次反復で同じ範囲を再取得しない）
    if [[ "$end" == "$today" ]]; then
      break
    fi

    # 次チャンク開始は直前の end
    start="$end"

    # 17ヶ月加算は現在の end を基準に計算（10#で八進数誤解釈を回避）
    end_year="${end:0:4}"
    end_month="${end:5:2}"
    local _ey=$((10#$end_year))
    local _em=$((10#$end_month))
    local _total=$((_ey * 12 + _em + 17))
    end_year=$(((_total - 1) / 12))
    end_month=$(((_total - 1) % 12 + 1))
    printf -v end_month '%02d' "$end_month"
    end="${end_year}-${end_month}-10"
  done

  # 境界重複を解消しつつ合計
  jq -s '.' "$tmp_data" >"${OUTPUT_GET_NPM_DOWNLOADS_PATH}"

  echo "end:get_npm_downloads()"
}
