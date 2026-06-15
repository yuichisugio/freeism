#!/bin/bash

#--------------------------------------
# 貢献度の算出の共通関数を定義するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 貢献度の算出の共通関数を定義する
#--------------------------------------
function calc_contrib_utils() {

  # -------------------------------------
  # 引数
  # -------------------------------------
  # タスク名
  local TASK_NAME
  # 評価軸のoption
  local IS_RESPONSE_SPEED="false" \
    IS_AMOUNT_OF_WORK="false" \
    IS_AMOUNT_OF_REACTION="false" \
    IS_STATE="false" \
    IS_REPO_CREATION_TO_TASK_PERIOD="false"

  # -------------------------------------
  # 変数
  # -------------------------------------
  # 基礎となるjqクエリ
  local MAIN_QUERY
  # 置き換え後の実行するjqクエリ
  local JQ_PROGRAM
  # 重み付け値を記載した設定jsonのpath
  local WEIGHTING_JSON_PATH="${SCRIPT_DIR}/weighting.json"
  # 置き換え後の実行するjqクエリ
  local RESPONSE_SPEED_FIRST_MERGE \
    RESPONSE_SPEED_SECOND_MERGE \
    AMOUNT_OF_WORK_FIRST_MERGE \
    AMOUNT_OF_WORK_SECOND_MERGE \
    AMOUNT_OF_REACTION_FIRST_MERGE \
    AMOUNT_OF_REACTION_SECOND_MERGE \
    STATE_FIRST_MERGE \
    STATE_SECOND_MERGE \
    REPO_CREATION_TO_TASK_PERIOD_FIRST_MERGE \
    REPO_CREATION_TO_TASK_PERIOD_SECOND_MERGE

  # -------------------------------------
  # 引数を解析
  # -------------------------------------
  while [[ $# -gt 0 ]]; do
    case "$1" in
    --task-name)
      TASK_NAME="$2"
      shift 2
      ;;
    --response-speed)
      IS_RESPONSE_SPEED="$2"
      shift 2
      ;;
    --amount-of-work)
      IS_AMOUNT_OF_WORK="$2"
      shift 2
      ;;
    --amount-of-reaction)
      IS_AMOUNT_OF_REACTION="$2"
      shift 2
      ;;
    --state)
      IS_STATE="$2"
      shift 2
      ;;
    --repo-creation-to-task-period)
      IS_REPO_CREATION_TO_TASK_PERIOD="$2"
      shift 2
      ;;
    *)
      printf '%s\n' "Unknown option: $1" >&2
      exit 1
      ;;
    esac
  done

  # メインの jq フィルタ（__EXTRA_MERGE__ を後で置換する）
  # shellcheck disable=SC2016
  MAIN_QUERY='

    # 最大値から、期間が過ぎた機関だけ引き算した重み付け値を返す
    def clamp($max; $max_weight ;$unit; $days; $lower_limit):
        (($max - $unit * $days) * $max_weight) as $v
        | if $v < $lower_limit then $lower_limit else $v end;

    # 値×重み → 下限補正
    def metric_weight($src; $weight; $min):
      (($src // 0) * ($weight // 0)) as $raw
      | (if $raw < ($min // 0) then ($min // 0) else $raw end);

    # 重み付け値をオブジェクトとして構築して返す
    def build_row_fields($repo_ts; $w):
      . as $t

      # タスク日時を取得。watchの場合はnullなので0にする
      | (
          $t.task_date
          | if type == "string" then (try fromdateiso8601 catch 0) else 0 end
        ) as $epoch_task_date

      # タスクタイプの重み付け値を取得
      | (
          $w[$task_name].task_type // 0
        ) as $tt

      # リポジトリ作成からタスクまでの期間の重み付け値を取得
      __REPO_CREATION_TO_TASK_PERIOD_FIRST_QUERY__

      # 作業量の重み付け値を取得
      __AMOUNT_OF_WORK_FIRST_QUERY__

      # リアクションの重み付け値を取得
      __AMOUNT_OF_REACTION_FIRST_QUERY__

      # レスポンススピードの重み付け値を取得
      __RESPONSE_SPEED_FIRST_QUERY__

      # ステータスの重み付け値を取得
      __STATE_FIRST_QUERY__

      # 重み付け値をオブジェクトとして構築して返す
      | {
          "criterion_weight_for_task_type": $tt,
          __REPO_CREATION_TO_TASK_PERIOD_SECOND_QUERY__
          __AMOUNT_OF_WORK_SECOND_QUERY__
          __AMOUNT_OF_REACTION_SECOND_QUERY__
          __STATE_SECOND_QUERY__
          __RESPONSE_SPEED_SECOND_QUERY__
          "contribution_point": (($tt * $rcttp * $aow * $aor * $state * $rs) | round)
        };


    # 重み付け値を記載したjsonを読み込む
    $weighting[0] as $w
    | . as $root
    | ($root.meta.repository.created_at | fromdateiso8601) as $repo_ts

    # ユーザー配列を安全に更新（常に全体を返す）
    | .data.user = ((.data.user // []) | map(
        . as $u
        | ($u.task // []) as $tasks
        | $u + {
            task: ($tasks | map(
              if .task_name == $task_name then
                . + build_row_fields($repo_ts; $w)
              else .
              end
            ))
          }
      ))
  '

  #--------------------------------------
  # 各評価軸ごとのjqクエリ
  #--------------------------------------
  # RESPONSE_SPEED
  # shellcheck disable=SC2016
  local RESPONSE_SPEED_FIRST_QUERY='
    | (
        (
          $t.task_start
          | if type == "string" then (try fromdateiso8601 catch 0) else 0 end
        ) as $epoch_task_start
        | (((($epoch_task_date // 0) - ($epoch_task_start // 0)) / 86400) | floor) as $rs_days
        | clamp(
            $w[$task_name].response_speed.max_period;
            $w[$task_name].response_speed.max_weight;
            $w[$task_name].response_speed.minus_unit;
            $rs_days;
            $w[$task_name].response_speed.lower_limit
          )
      ) as $rs
  '
  # shellcheck disable=SC2016
  local RESPONSE_SPEED_SECOND_QUERY='
    "criterion_weight_for_response_speed": $rs,
  '

  # AMOUNT_OF_WORK
  # shellcheck disable=SC2016
  local AMOUNT_OF_WORK_FIRST_QUERY='
    | (
        metric_weight(
          $t.letter_count;
          $w[$task_name].amount_of_work.letter_count;
          $w[$task_name].amount_of_work.letter_count_lower_limit
        ) as $aow_word
        | metric_weight(
            $t.lines_of_code;
            $w[$task_name].amount_of_work.lines_of_code;
            $w[$task_name].amount_of_work.lines_of_code_lower_limit
          ) as $aow_code
        | ( $aow_word + $aow_code )
      ) as $aow
  '
  # shellcheck disable=SC2016
  local AMOUNT_OF_WORK_SECOND_QUERY='
    "criterion_weight_for_amount_of_work": $aow,
  '

  # AMOUNT_OF_REACTION
  # shellcheck disable=SC2016
  local AMOUNT_OF_REACTION_FIRST_QUERY='
    | (
        metric_weight(
          $t.good_reaction;
          $w[$task_name].amount_of_reaction.good_reaction_count;
          $w[$task_name].amount_of_reaction.good_reaction_count_lower_limit
        ) as $good_reaction_weigting
        | (
            ($t.bad_reaction // 0)
            * ($w[$task_name].amount_of_reaction.bad_reaction_count // 0)
          ) as $bad_reaction_weigting
        | ($good_reaction_weigting + $bad_reaction_weigting)
      ) as $aor
  '
  # shellcheck disable=SC2016
  local AMOUNT_OF_REACTION_SECOND_QUERY='
    "criterion_weight_for_amount_of_reaction": $aor,
  '

  # STATE
  # shellcheck disable=SC2016
  local STATE_FIRST_QUERY='
    | (
        $w[$task_name].state[$t.state] // 1
      ) as $state
  '
  # shellcheck disable=SC2016
  local STATE_SECOND_QUERY='
    "criterion_weight_for_state": $state,
  '

  # REPO_CREATION_TO_TASK_PERIOD
  # shellcheck disable=SC2016
  local REPO_CREATION_TO_TASK_PERIOD_FIRST_QUERY='
    | (
        (((($epoch_task_date // 0) - ($repo_ts // 0)) / 86400) | floor) as $rcttp_days
        | clamp(
            $w[$task_name].repo_creation_to_task_period.max_period;
            $w[$task_name].repo_creation_to_task_period.max_weight;
            $w[$task_name].repo_creation_to_task_period.minus_unit;
            $rcttp_days;
            $w[$task_name].repo_creation_to_task_period.lower_limit
          )
      ) as $rcttp
  '
  # shellcheck disable=SC2016
  local REPO_CREATION_TO_TASK_PERIOD_SECOND_QUERY='
    "criterion_weight_for_repo_creation_to_task_period":  $rcttp,
  '

  #--------------------------------------
  # オプションに応じて、jqクエリを実行
  #--------------------------------------
  # RESPONSE_SPEEDがtrueの場合
  if [[ "${IS_RESPONSE_SPEED}" == "true" ]]; then
    RESPONSE_SPEED_FIRST_MERGE="${RESPONSE_SPEED_FIRST_QUERY}"
    RESPONSE_SPEED_SECOND_MERGE="${RESPONSE_SPEED_SECOND_QUERY}"
  else
    # shellcheck disable=SC2016
    RESPONSE_SPEED_FIRST_MERGE='| (1) as $rs'
    RESPONSE_SPEED_SECOND_MERGE=''
  fi

  # AMOUNT_OF_WORKがtrueの場合
  if [[ "${IS_AMOUNT_OF_WORK}" == "true" ]]; then
    AMOUNT_OF_WORK_FIRST_MERGE="${AMOUNT_OF_WORK_FIRST_QUERY}"
    AMOUNT_OF_WORK_SECOND_MERGE="${AMOUNT_OF_WORK_SECOND_QUERY}"
  else
    # shellcheck disable=SC2016
    AMOUNT_OF_WORK_FIRST_MERGE='| (1) as $aow'
    AMOUNT_OF_WORK_SECOND_MERGE=''
  fi

  # AMOUNT_OF_REACTIONがtrueの場合
  if [[ "${IS_AMOUNT_OF_REACTION}" == "true" ]]; then
    AMOUNT_OF_REACTION_FIRST_MERGE="${AMOUNT_OF_REACTION_FIRST_QUERY}"
    AMOUNT_OF_REACTION_SECOND_MERGE="${AMOUNT_OF_REACTION_SECOND_QUERY}"
  else
    # shellcheck disable=SC2016
    AMOUNT_OF_REACTION_FIRST_MERGE='| (1) as $aor'
    AMOUNT_OF_REACTION_SECOND_MERGE=''
  fi

  # STATEがtrueの場合
  if [[ "${IS_STATE}" == "true" ]]; then
    STATE_FIRST_MERGE="${STATE_FIRST_QUERY}"
    STATE_SECOND_MERGE="${STATE_SECOND_QUERY}"
  else
    # shellcheck disable=SC2016
    STATE_FIRST_MERGE='| (1) as $state'
    STATE_SECOND_MERGE=''
  fi

  # REPO_CREATION_TO_TASK_PERIODがtrueの場合
  if [[ "${IS_REPO_CREATION_TO_TASK_PERIOD}" == "true" ]]; then
    REPO_CREATION_TO_TASK_PERIOD_FIRST_MERGE="${REPO_CREATION_TO_TASK_PERIOD_FIRST_QUERY}"
    REPO_CREATION_TO_TASK_PERIOD_SECOND_MERGE="${REPO_CREATION_TO_TASK_PERIOD_SECOND_QUERY}"
  else
    # shellcheck disable=SC2016
    REPO_CREATION_TO_TASK_PERIOD_FIRST_MERGE='| (1) as $rcttp'
    REPO_CREATION_TO_TASK_PERIOD_SECOND_MERGE=''
  fi

  #--------------------------------------
  # プレースホルダを差し替えて、JQ_PROGRAM を作成
  #--------------------------------------
  # first query
  JQ_PROGRAM="${MAIN_QUERY/__RESPONSE_SPEED_FIRST_QUERY__/${RESPONSE_SPEED_FIRST_MERGE}}"
  JQ_PROGRAM="${JQ_PROGRAM/__AMOUNT_OF_WORK_FIRST_QUERY__/${AMOUNT_OF_WORK_FIRST_MERGE}}"
  JQ_PROGRAM="${JQ_PROGRAM/__AMOUNT_OF_REACTION_FIRST_QUERY__/${AMOUNT_OF_REACTION_FIRST_MERGE}}"
  JQ_PROGRAM="${JQ_PROGRAM/__STATE_FIRST_QUERY__/${STATE_FIRST_MERGE}}"
  JQ_PROGRAM="${JQ_PROGRAM/__REPO_CREATION_TO_TASK_PERIOD_FIRST_QUERY__/${REPO_CREATION_TO_TASK_PERIOD_FIRST_MERGE}}"
  # second query
  JQ_PROGRAM="${JQ_PROGRAM/__RESPONSE_SPEED_SECOND_QUERY__/${RESPONSE_SPEED_SECOND_MERGE}}"
  JQ_PROGRAM="${JQ_PROGRAM/__AMOUNT_OF_WORK_SECOND_QUERY__/${AMOUNT_OF_WORK_SECOND_MERGE}}"
  JQ_PROGRAM="${JQ_PROGRAM/__AMOUNT_OF_REACTION_SECOND_QUERY__/${AMOUNT_OF_REACTION_SECOND_MERGE}}"
  JQ_PROGRAM="${JQ_PROGRAM/__STATE_SECOND_QUERY__/${STATE_SECOND_MERGE}}"
  JQ_PROGRAM="${JQ_PROGRAM/__REPO_CREATION_TO_TASK_PERIOD_SECOND_QUERY__/${REPO_CREATION_TO_TASK_PERIOD_SECOND_MERGE}}"

  #--------------------------------------
  # 実行して、OUTPUT_PATH に出力
  #--------------------------------------
  # 一時ファイルを作成。同じファイルをinputとoutputに使うため、tmpファイルを作成する。
  # EXITではなくRETURNを使うことで、処理全体ではなく関数が完了したら削除されるようにする。
  local tmp
  tmp="$(mktemp "${OUTPUT_CALC_CONTRIB_VERBOSE_JSON_PATH}.XXXX")"
  trap 'rm -f "${tmp:-}"' RETURN

  jq \
    --arg task_name "$TASK_NAME" \
    --slurpfile weighting "$WEIGHTING_JSON_PATH" \
    "$JQ_PROGRAM" \
    "$OUTPUT_CALC_CONTRIB_VERBOSE_JSON_PATH" \
    >"$tmp"

  # 一時ファイルを元のファイルに移動
  mv -f "$tmp" "$OUTPUT_CALC_CONTRIB_VERBOSE_JSON_PATH"
}

#--------------------------------------
# 算出した貢献度から、タスクを抜いたバージョンを作成する
#--------------------------------------
function exclude_task() {

  # 引数
  local OUTPUT_PATH INPUT_PATH

  # 引数を解析
  while [[ $# -gt 0 ]]; do
    case "$1" in
    --input-path)
      INPUT_PATH="$2"
      shift 2
      ;;
    --output-path)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    *)
      printf '%s\n' "Unknown option: $1" >&2
      exit 1
      ;;
    esac
  done

  # 実行して、OUTPUT_PATH に出力
  jq \
    '
      .data.user |= map(del(.task))
    ' \
    "$INPUT_PATH" \
    >"$OUTPUT_PATH"

}

#--------------------------------------
# 各ユーザーごとの貢献度を合算する
#--------------------------------------
function sum_contributions_by_user() {

  # 引数
  local OUTPUT_PATH INPUT_PATH

  # 引数を解析
  while [[ $# -gt 0 ]]; do
    case "$1" in
    --input-path)
      INPUT_PATH="$2"
      shift 2
      ;;
    --output-path)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    *)
      printf '%s\n' "Unknown option: $1" >&2
      exit 1
      ;;
    esac
  done

  # 一時ファイルを作成。同じファイルをinputとoutputに使うため、tmpファイルを作成する。
  # EXITではなくRETURNを使うことで、処理全体ではなく関数が完了したら削除されるようにする。
  local tmp
  tmp="$(mktemp "${OUTPUT_PATH}.XXXX")"
  trap 'rm -f "${tmp:-}"' RETURN

  # 実行して、OUTPUT_PATH に出力
  jq \
    '
      .data.user |= map(
      . as $u
      | ($u.task // [] | map(.contribution_point // 0) | add // 0) as $sum
      | { contribution_point: $sum } + $u
    )
    ' \
    "$INPUT_PATH" \
    >"$tmp"

  # 一時ファイルを元のファイルに移動
  mv -f "$tmp" "$OUTPUT_PATH"
}

#--------------------------------------
# 各ユーザーごとの貢献度のJSON形式をCSV形式に変換する
#--------------------------------------
function convert_to_csv() {

  # 引数
  local OUTPUT_PATH INPUT_PATH

  # 引数を解析
  while [[ $# -gt 0 ]]; do
    case "$1" in
    --input-path)
      INPUT_PATH="$2"
      shift 2
      ;;
    --output-path)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    *)
      printf '%s\n' "Unknown option: $1" >&2
      exit 1
      ;;
    esac
  done

  jq \
    -r \
    '
      def nn: if . == null then "" else tostring end;

      .data.user as $users
      | ([
            "contribution_point",
            "user_id",
            "user_database_id",
            "user_login","user_name",
            "user_url",
            "user_type",
            "task_total_count"
          ] | @csv),
        ($users[]? | [
          (.contribution_point | nn),
          (.user_id            | nn),
          (.user_database_id   | nn),
          (.user_login         | nn),
          (.user_name          | nn),
          (.user_url           | nn),
          (.user_type          | nn),
          (.task_total_count   | nn)
        ] | @csv)
  ' \
    "$INPUT_PATH" \
    >"$OUTPUT_PATH"
}
