#!/bin/bash

# -------------------------------------
# zenn関連のデータ取得を行うファイル
#--------------------------------------

set -euo pipefail

#--------------------------------------
# 出力先のファイルを定義
#--------------------------------------
readonly RESULT_ZENN_DIR="${OUTPUT_DIR}/zenn"
mkdir -p "$RESULT_ZENN_DIR"
readonly RESULT_JSON_ZENN="${RESULT_ZENN_DIR}/result-zenn.json"
readonly RAW_ZENN="${RESULT_ZENN_DIR}/raw-zenn.json"
readonly PROCESSED_ZENN="${RESULT_ZENN_DIR}/processed-zenn.json"
readonly RESULT_CSV_ZENN="${RESULT_ZENN_DIR}/result-zenn.csv"

#--------------------------------------
# データ取得
#--------------------------------------
function get_zenn() {

  printf '%s\n' "begin:get_zenn()"

  local created_at_utc analysis_until_default
  created_at_utc="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  analysis_until_default="$(date -u +"%Y-%m-%dT23:59:59Z")"

  # -------------------------------------
  # 生データを取得
  # -------------------------------------

  # 変数
  local -a topicnames=()

  # 設定ファイルからtopicnameを取得
  mapfile -t topicnames < <(jq -r '.search_names[]' "$INPUT_CONFIG_PATH")

  # temp
  local tmp_response tmp_json
  tmp_response="$(mktemp)"
  tmp_json="$(mktemp)"
  trap 'rm -f "${tmp_response:-}" "${tmp_json:-}"' RETURN

  # topicnameに対して、APIを叩いてデータを取得
  for topicname in "${topicnames[@]}"; do

    local page=1

    while :; do
      # APIを叩いてデータを取得
      curl -fsS "https://zenn.dev/api/articles?topicname=${topicname}&order=latest&count=48&page=${page}" >"$tmp_response"

      # データを追加
      jq -c '.articles[]' "$tmp_response" >>"$tmp_json"

      # 続きがない、もしくは期間外の場合は終了
      if [[ "$(jq -r '.next_page' "$tmp_response")" == "null" ]]; then
        break
      fi

      # 次のページに進む
      page=$((page + 1))

    done

  done

  # 一時ファイルを元のファイルに移動
  jq -s '.' "$tmp_json" >"$RAW_ZENN"

  # -------------------------------------
  # データを加工
  # -------------------------------------

  jq '
    def to_utc:
      if . == null or . == "" then
        ""
      else
        try (
          gsub("Z$"; "+00:00")
          | sub("\\.[0-9]+"; "")
          | sub(":(?=[0-9]{2}$)"; "")
          | strptime("%Y-%m-%dT%H:%M:%S%z")
          | mktime
          | strftime("%Y-%m-%dT%H:%M:%SZ")
        ) catch .
      end;

    unique_by(.id)
    | map({
        article_id:      (.id // 0),
        post_type:       (.post_type // ""),
        title:           (.title // ""),
        path:            (.path // ""),
        task_date:       ((.published_at // "") | to_utc),
        letter_count:    ((.body_letters_count // 0) + ((.title // "") | length)),
        liked_count:     (.liked_count // 0),
        bookmarked_count:(.bookmarked_count // 0),
        user: {
          id:       (.user.id // 0),
          username: (.user.username // ""),
          name:     (.user.name // "")
        }
      })
  ' "$RAW_ZENN" >"$PROCESSED_ZENN"

  # -------------------------------------
  # 貢献度の算出
  # -------------------------------------
  jq \
    --slurpfile input_config "$INPUT_CONFIG_PATH" \
    --arg created_at "$created_at_utc" \
    --arg analysis_until_default "$analysis_until_default" \
    '
      def clamp($max; $max_weight ;$unit; $days; $lower_limit):
        (($max - $unit * $days) * $max_weight) as $v
        | if $v < $lower_limit then $lower_limit else $v end;

      def metric_weight($src; $weight; $min):
      (($src // 0) * ($weight // 0)) as $raw
      | (if $raw < ($min // 0) then ($min // 0) else $raw end);

      def try_to_epoch:
        try (
          gsub("Z$"; "+00:00")
          | sub("\\.[0-9]+"; "")
          | sub(":(?=[0-9]{2}$)"; "")
          | strptime("%Y-%m-%dT%H:%M:%S%z")
          | mktime
        ) catch 0;

      ($input_config[0] // {}) as $config
      | ($config.search_names // []) as $search_names
      | ($config.weighting.zenn // {}) as $weighting
      | ($config.repository_created_at // "1970-01-01T00:00:00Z") as $repo_created_at
      | ($weighting.task_type // 0) as $weight_task_type
      | ($weighting.liked_count // 0) as $weight_liked
      | ($weighting.liked_count.weight // 0) as $weight_liked_weight
      | ($weighting.liked_count.lower_limit // 0) as $weight_liked_lower_limit
      | ($weighting.bookmarked_count // 0) as $weight_bookmarked
      | ($weighting.bookmarked_count.weight // 0) as $weight_bookmarked_weight
      | ($weighting.bookmarked_count.lower_limit // 0) as $weight_bookmarked_lower_limit
      | ($weighting.letter_count // 0) as $weight_letter
      | ($weighting.letter_count.weight // 0) as $weight_letter_weight
      | ($weighting.letter_count.lower_limit // 0) as $weight_letter_lower_limit
      | ($weighting.task_date // {}) as $weight_task_date

      | sort_by(.user.id)
      | group_by(.user.id)
      | map(
          . as $group
          | ($group[0].user) as $user
          | $group
          | (map(
              (
                . as $article
                | ($weight_task_type // 0) as $task_type_contrib
                | (metric_weight(
                    $article.liked_count // 0;
                    $weight_liked_weight;
                    $weight_liked_lower_limit
                  )
                ) as $liked_count_contrib
                | (metric_weight(
                    $article.bookmarked_count // 0;
                    $weight_bookmarked_weight;
                    $weight_bookmarked_lower_limit
                  )
                ) as $bookmarked_count_contrib
                | (metric_weight(
                    $article.letter_count // 0;
                    $weight_letter_weight;
                    $weight_letter_lower_limit
                  )
                ) as $letter_count_contrib
                | (
                    ($article.task_date | try_to_epoch) as $epoch_task_date
                    | ($repo_created_at | try_to_epoch) as $epoch_repo_created_at
                    | (((($epoch_task_date // 0) - ($epoch_repo_created_at // 0)) / 86400) | floor) as $rcttp_days
                    | clamp(
                        ($weight_task_date.max_period // 0);
                        ($weight_task_date.period_weight // 0);
                        ($weight_task_date.minus_unit // 0);
                        $rcttp_days;
                        ($weight_task_date.lower_limit // 0)
                      )
                  ) as $task_date_contrib
                | {
                    id: ($article.article_id // 0),
                    post_type: ($article.post_type // ""),
                    title: ($article.title // ""),
                    task_url: ("https://zenn.dev" + ($article.path // "")),
                    task_name: "article_writing",
                    task_date: ($article.task_date // ""),
                    reference_task_date_field: "publishedAt",
                    task_start: $repo_created_at,
                    letter_count: ($article.letter_count // 0),
                    liked_count: ($article.liked_count // 0),
                    bookmarked_count: ($article.bookmarked_count // 0),
                    "criterion_weight_for_task_type": $task_type_contrib,
                    "criterion_weight_for_liked_count": $liked_count_contrib,
                    "criterion_weight_for_bookmarked_count": $bookmarked_count_contrib,
                    "criterion_weight_for_letter_count": $letter_count_contrib,
                    "criterion_weight_for_task_date": $task_date_contrib,
                    contribution_point: (
                      $task_type_contrib
                      * $liked_count_contrib
                      * $bookmarked_count_contrib
                      * $letter_count_contrib
                      * $task_date_contrib
                    )
                  }
              )
            )
            | sort_by(.task_date // "")) as $tasks
          | {
              contribution_point: ($tasks | map(.contribution_point) | add // 0),
              id: ($user.id // 0),
              username: ($user.username // ""),
              name: ($user.name // ""),
              task_total_count: ($tasks | length),
              task: $tasks
            }
        ) as $users
      | {
          meta: {
            createdAt: $created_at,
            analysisPeriod: {
              since: "1970-01-01T00:00:00Z",
              until: $analysis_until_default
            },
            search_names: $search_names,
            weighting: $weighting
          },
          data: {
            user_total_count: ($users | length),
            user: $users
          }
        }
    ' \
    "$PROCESSED_ZENN" \
    >"$RESULT_JSON_ZENN"


  # -------------------------------------
  # CSVデータも出力
  # -------------------------------------
  # userごとの集計結果をCSV化（task配列は除外）
  jq -r '
    def unique_preserve:
      reduce .[] as $x ([]; if index($x) then . else . + [$x] end);

    .data.user as $users
    | if ($users | length) == 0 then
        (["contribution_point", "id", "username", "name", "task_total_count"] | @csv)
      else
        ($users
          | reduce .[] as $u (
              [];
              . + ($u | del(.task) | to_entries | map(.key))
            )
          | unique_preserve) as $keys
        | ($keys | @csv),
          ($users[]
            | del(.task)
            | [ $keys[] as $k | (.[$k] // "") ]
            | @csv)
      end
  ' "$RESULT_JSON_ZENN" >"$RESULT_CSV_ZENN"


  printf '%s\n' "end:get_zenn()"

  return 0
}
