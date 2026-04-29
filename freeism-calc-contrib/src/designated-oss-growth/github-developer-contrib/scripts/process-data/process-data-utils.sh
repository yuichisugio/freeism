#!/bin/bash

#--------------------------------------
# データ加工の共通関数を定義するファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# データ加工の共通関数を定義する
#--------------------------------------
function process_data_utils() {

  # 引数
  local INPUT_PATH OUTPUT_PATH TASK_NAME TASK_DATE AUTHOR_FIELD
  # 未設定参照を防ぐため空で初期化
  local FIRST_OTHER_QUERY="" SECOND_OTHER_QUERY=""

  # 変数
  local MAIN_QUERY JQ_PROGRAM
  local FIRST_EXTRA_MERGE SECOND_EXTRA_MERGE

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
    --task-name)
      TASK_NAME="$2"
      shift 2
      ;;
    --task-date)
      TASK_DATE="$2"
      shift 2
      ;;
    --author-field)
      AUTHOR_FIELD="$2"
      shift 2
      ;;
    --first-other-query)
      FIRST_OTHER_QUERY="$2"
      shift 2
      ;;
    --second-other-query)
      SECOND_OTHER_QUERY="$2"
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
            __FIRST_EXTRA_MERGE__
            | {
                user_type:        ($author.__typename // $author_field),
                user_id:          $author.id,
                user_database_id: $author.databaseId,
                user_login:       $author.login,
                user_name:        $author.name,
                user_url:         $author.url,
                task: [
                  (
                    {
                      task_id:               $obj.id,
                      task_database_id:      $obj.databaseId,
                      task_full_database_id: $obj.fullDatabaseId,
                      task_url:              $obj.url,
                      task_name:             $task_name,
                      task_date:             $obj[$task_date],
                      reference_task_date_field: $task_date
                    } __SECOND_EXTRA_MERGE__
                  )
                ]
              }
          ]
          | group_by(.user_id)
          | map(
              (
                .[0]
                | {
                    user_id,
                    user_database_id,
                    user_login,
                    user_name,
                    user_url,
                    user_type
                  }
              )
              + { task: (map(.task) | add) }
            )
        )
      }
    }
  '

  # OTHER_QUERY が空でない場合は、EXTRA_MERGE に追加
  # ${変数名//パターン/置換文字}の形式で、変数の中の空白を削除しても変数内にデータがあるか確認
  if [[ -n "${FIRST_OTHER_QUERY//[$'\t\r\n ']/}" ]]; then
    # OTHER_QUERY が空でない場合は、EXTRA_MERGE に追加
    FIRST_EXTRA_MERGE="${FIRST_OTHER_QUERY}"
  else
    # OTHER_QUERY が空の場合は、デフォのフィルターを追加
    # shellcheck disable=SC2016
    FIRST_EXTRA_MERGE='
      {
        data: {
          user: (
            [ .[]?
              | . as $obj
              | .[$author_field] as $author
    '

  fi

  # 2か所目。オブジェクトをマージしたいので、+ ({}) でマージする
  if [[ -n "${SECOND_OTHER_QUERY//[$'\t\r\n ']/}" ]]; then
    SECOND_EXTRA_MERGE="| . + { ${SECOND_OTHER_QUERY} }"
  else
    SECOND_EXTRA_MERGE=''
  fi

  # プレースホルダを差し替えて、JQ_PROGRAM を作成
  JQ_PROGRAM="${MAIN_QUERY/__FIRST_EXTRA_MERGE__/${FIRST_EXTRA_MERGE}}"
  JQ_PROGRAM="${JQ_PROGRAM/__SECOND_EXTRA_MERGE__/${SECOND_EXTRA_MERGE}}"

  # 実行して、OUTPUT_PATH に出力
  jq \
    --arg task_name "$TASK_NAME" \
    --arg task_date "$TASK_DATE" \
    --arg author_field "$AUTHOR_FIELD" \
    "$JQ_PROGRAM" \
    "$INPUT_PATH" >"$OUTPUT_PATH"
}

#--------------------------------------
# データ加工の共通関数を定義する
#--------------------------------------
function process_data_utils_by_two_files() {

  # 引数
  local INPUT_NOW_PATH INPUT_TIMELINE_PATH OUTPUT_PATH TASK_NAME TASK_DATE EVENT_TYPE NEST_EVENT_FIELD

  # 変数
  local MAIN_QUERY

  # 引数を解析
  while [[ $# -gt 0 ]]; do
    case "$1" in
    --input-now-path)
      INPUT_NOW_PATH="$2"
      shift 2
      ;;
    --input-timeline-path)
      INPUT_TIMELINE_PATH="$2"
      shift 2
      ;;
    --output-path)
      OUTPUT_PATH="$2"
      shift 2
      ;;
    --event-type)
      EVENT_TYPE="$2"
      shift 2
      ;;
    --nest-event-field)
      NEST_EVENT_FIELD="$2"
      shift 2
      ;;
    --task-name)
      TASK_NAME="$2"
      shift 2
      ;;
    --task-date)
      TASK_DATE="$2"
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
    # 現在の一覧
    ($now[0] // []) as $now_objects
    | (
        $now_objects
        | group_by(.node_id)
        | map({ (.[0].node_id): (map(.id) | unique) })
        | add
      ) as $by_object

    # タイムライン配列を処理
    |
    {
      data: {
        user: (
          [
            (
              # まず「オブジェクトのみ」を対象にする（配列等を除外）
              [ .[]? | select((.__typename? // "") == $event_type) ]

              # $event_type のみ残す
              | map(
                  . as $e
                  | select(
                      ($e.node_id? and $e[$nest_event_field]?.id?)
                      and (
                        ($by_object[$e.node_id] // [])
                        | index($e[$nest_event_field].id) != null
                      )
                  )
                )

              # issue × $nest_event_field ごとに「最後の設定イベント」だけ残す
              | sort_by([.node_id, .[$nest_event_field].id, (.createdAt | fromdateiso8601)])
              | group_by([.node_id, .[$nest_event_field].id])
              | map( max_by(.createdAt | fromdateiso8601) )
              | .[]
            )
            | . as $obj
            | .actor as $author
            | {
                user_type:                                $author.__typename,
                user_id:                                  $author.id,
                user_database_id:                         $author.databaseId,
                user_login:                               $author.login,
                user_name:                                $author.name,
                user_url:                                 $author.url,
                task: [
                  {
                    task_id:                              $obj.id,
                    task_database_id:                     ($obj.databaseId // null),
                    task_full_database_id:                ($obj.fullDatabaseId // null),
                    task_url:                             ($obj.url // null),
                    task_name:                            $task_name,
                    task_date:                            $obj[$task_date],
                    reference_task_date_field:            $task_date,
                    node_url:                             $obj.node_url,
                    ($nest_event_field + "_id"):          $obj[$nest_event_field].id,
                    ($nest_event_field + "_database_id"): $obj[$nest_event_field].databaseId,
                    ($nest_event_field + "___typename"):  $obj[$nest_event_field].__typename,
                    ($nest_event_field + "_name"):        $obj[$nest_event_field].name,
                    ($nest_event_field + "_login"):       $obj[$nest_event_field].login,
                    ($nest_event_field + "_url"):         ($obj[$nest_event_field].url // null),
                    task_start:                           $obj.node_publishedAt
                  }
                ]
              }
          ]
          # 同一ユーザーの task を結合
          | sort_by(.user_id)
          | group_by(.user_id)
          | map(
              (
                .[0]
                | {
                    user_id,
                    user_database_id,
                    user_login,
                    user_name,
                    user_url,
                    user_type
                  }
              )
              + { task: (map(.task) | add) }
            )
        )
      }
    }
  '

  # 実行して、OUTPUT_PATH に出力
  jq \
    --slurpfile now "$INPUT_NOW_PATH" \
    --arg event_type "$EVENT_TYPE" \
    --arg nest_event_field "$NEST_EVENT_FIELD" \
    --arg task_name "$TASK_NAME" \
    --arg task_date "$TASK_DATE" \
    "$MAIN_QUERY" \
    "$INPUT_TIMELINE_PATH" \
    >"$OUTPUT_PATH"
}

#--------------------------------------
# データ加工した、それぞれのファイルを一つのファイルに統合する
#--------------------------------------
function integrate_processed_files() {

  # 引数
  local OUTPUT_PATH="${1}"

  # 統合したいファイルが入ったフォルダのPATH
  local FIND_DIR="${OUTPUT_PROCESSED_DIR}"

  # 再帰的に *.json / *.jsonl を収集（名前は不問）
  local -a FILES=()
  while IFS= read -r -d '' f; do
    FILES+=("$f")
  done < <(find "$FIND_DIR" -type f \( -name '*.json' -o -name '*.jsonl' \) -print0)

  # 対象ファイルがなければ空の雛形を出力して return
  if ((${#FILES[@]} == 0)); then
    printf '{"meta":{"createdAt":"%s"},"data":{"user":[]}}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$OUTPUT_PATH"
    return 0
  fi

  # すべてのファイルを slurp (-s) で一括読み込みし、user_id で group_by → task を結合
  # - ISO8601 文字列前提で task_date 昇順に整列
  # argv 上限回避のため cat で連結 → jq にパイプで渡す
  {
    for f in "${FILES[@]}"; do
      cat "$f"
      printf '\n'
    done
  } | jq \
    --slurpfile repo_meta "$RESULT_PROCESSED_REPO_META_PATH" \
    --arg answer_task_name "$ANSWER_TASK_NAME" \
    --arg since "$SINCE" \
    --arg until "$UNTIL" \
    --slurp \
    '
      # リポジトリのメタデータを取得
      $repo_meta[0] as $repo_meta

      |

      # 全入力（ファイル/行）から user 配列だけを集約
      [ .[]? | (.data.user? // [])[] ] as $all_users

      # user_id ごとにグループ化
      | ( $all_users
      | group_by(.user_id)
      | map(
          . as $g
          | ($g[0] | del(.task)) as $base                  # 代表のユーザ情報（task 以外）
          | ($g | map(.task // []) | add) as $tasks        # すべての task を結合

          # task_date 昇順に整列してから、baseとタスクを結合
          | (
                # 重複判定キーと優先度を関数化。
                # $answer_task_name と comment は全く同じタスクが重複するため、answerを残す処理が必要。
                def dedup_key:
                  ( .task_id // (
                      ( .task_name // "" )
                      + "|" + ( .task_date // "" )
                      + "|" + ( .task_database_id // "" )
                      + "|" + ( .task_full_database_id // "" )
                    )
                  );

                # 同一 task_id の重複では $answer_task_name を最優先、comment を次点、
                # それ以外は現行どおり（優先度=2で無影響）
                # unique_by は「最初に現れた要素」を残すため、task_name が $answer_task_name と comment の両方ある場合は $answer_task_name を優先的に残す。
                def pref:
                  if (.task_id != null) and ((.task_name // "") == $answer_task_name) then 0
                  elif (.task_id != null) and ((.task_name // "") == "comment") then 1
                  else 2
                  end;

                $tasks

                # 重複キー（=dedup_key）→優先度(pref) の順で整列
                # こうしておくと unique_by は「$answer_task_name を先頭に見る」ため残る
                # この場合は $answer_task_name が 0、comment が 1、それ以外が 2 となる
                | group_by(dedup_key)
                | map( sort_by(pref) | .[0] )

                # 出力整形は従来どおり task_date 昇順
                | sort_by(.task_date // "")
                ) as $tasks_dedup

              # 出力オブジェクト（各ユーザー）
              | $base + {
                  task_total_count: ($tasks_dedup | length),
                  task: $tasks_dedup
                }
            )
        ) as $users

      # 出力のトップレベルを組み立て
      | {
          meta: {
            analytics:{
              createdAt: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
              "analysisPeriod": {
                "since": $since,
                "until": $until
              },
            },
            repository:{
              host:              $repo_meta.host,
              owner_username:    $repo_meta.ownerUsername,
              owner_user_id:     $repo_meta.ownerUserId,
              repository_name:   $repo_meta.repositoryName,
              repository_id:     $repo_meta.repositoryId,
              repository_url:    $repo_meta.repositoryUrl,
              created_at:        $repo_meta.createdAt,
              default_branch:    $repo_meta.defaultBranch
            }
          },
          data: {
            user_total_count: ($users | length),
            user: $users
          }
        }
    ' \
    >"$OUTPUT_PATH"
}
