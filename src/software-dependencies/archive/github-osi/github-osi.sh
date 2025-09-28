#!/bin/bash

#--------------------------------------
# GitHub Dependency Graph の SBOM を取得して、依存（パッケージ）単位で
# --------------------------------------

set -euo pipefail

printf '%s\n' "start: github-osi"

# タイムスタンプ
# shellcheck disable=SC2155
readonly TODAY="$(date +%F)"

# 出力ファイル
readonly RAW_GITHUB_DEPENDENCIES_PATH="${RESULTS_DIR}/github-osi/raw-github-dependencies.json"
readonly PROCESSED_GITHUB_DEPENDENCIES_PATH="${RESULTS_DIR}/github-osi/processed-github-dependencies.json"
readonly RESULT_GITHUB_OSI_PATH="${RESULTS_DIR}/github-osi/result.json"
mkdir -p "$(dirname "${RAW_GITHUB_DEPENDENCIES_PATH}")"

readonly LIBS_JSON="${RESULTS_DIR}/github-osi/libs.json"
readonly OUTPUT_JSON="${RESULTS_DIR}/github-osi/result.json"

########################################
# URL 正規化（404対策）
# - git+https:// → https://
# - git://       → https://
# - git+ssh://git@github.com/OWNER/REPO → https://github.com/OWNER/REPO
# - 末尾 .git / #fragment を除去
########################################
normalize_repo_url() {
  local u="${1:-}"
  u="${u%% }"
  u="${u## }"
  u="${u#git+}"              # git+https:// → https://
  u="${u/git:\/\//https://}" # git:// → https://
  u="$(printf '%s' "$u" | sed -E 's|^git\+ssh://git@github\.com/|https://github.com/|I')"
  u="$(printf '%s' "$u" | sed -E 's|\.git(#.*)?$||I')" # .git, .git#frag
  u="$(printf '%s' "$u" | sed -E 's|#.*$||')"          # #fragment
  printf '%s' "$u"
}

########################################
# JSR リゾルバ（@jsr/scope__name → GitHub）
# https://jsr.io/@scope/name を読んで github.com/owner/repo を抽出
########################################
resolve_jsr_to_github() {
  local pkg="$1"               # 例: @jsr/std__async
  local scoped="${pkg#@jsr/}"  # @jsr/std__async -> std__async
  local scope="${scoped%%__*}" # std__async -> std
  local name="${scoped#*__}"   # std__async -> async
  local url="https://jsr.io/@${scope}/${name}"

  # 失敗しても空で返す（パイプラインを止めない）
  local html
  html="$(curl -fsSL "$url" 2>/dev/null || true)"
  # github.com/owner/repo を最初の1つだけ拾う
  local ghpath
  ghpath="$(printf '%s' "$html" | grep -Eo 'github\.com/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+' | head -n1)"
  if [[ -n "$ghpath" ]]; then
    printf '%s\n' "$ghpath"
  fi
}

# ----------------------------------------
# SBOMをGitHub APIで取得
# ----------------------------------------
get_github_sbom() {

  # 1) SBOM 取得
  # shellcheck disable=SC2153
  gh api -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/${OWNER}/${REPO}/dependency-graph/sbom" |
    jq '.' >"${RAW_GITHUB_DEPENDENCIES_PATH}"
}

# ----------------------------------------
# GitHub SBOMのデータを加工
# ----------------------------------------
process_github_sbom() {
  # 直接依存のソフトウェアのみ抽出し、purl 等を整形
  jq --indent 2 '
    .sbom as $s

    # root を抽出
    | (
        $s.relationships[] 
        | select(.relationshipType=="DESCRIBES" and .spdxElementId=="SPDXRef-DOCUMENT") 
        | .relatedSpdxElement
      ) as $root

    # 必要な情報を抽出
    | (
        $s.packages
        | map({
            key: .SPDXID, 
            value: {
              name: .name,
              spdxid: .SPDXID,
              version: (.versionInfo // ""),
              purl: ((.externalRefs[]? | select(.referenceType=="purl") | .referenceLocator) // "")
            }
          })
        | from_entries # SPDXIDをキーにして、valueに必要な情報を抽出
      ) as $pkg

    # 直接依存のソフトウェアを抽出
    | [ 
        $s.relationships[]
        | select(.relationshipType=="DEPENDS_ON" and .spdxElementId==$root)
        | .relatedSpdxElement
        | $pkg[.]
        | select(.purl != "") 
      ] as $deps

    # purl 等を整形
    | ($deps
        | map(

        # バージョンの範囲を除去
        def strip_range:
          gsub("^%5[Ee]";"") | gsub("^\\^";"") |
          gsub("^%7[Ee]";"") | gsub("^~";"")   |
          gsub("^%3[Ee]%3[Dd]";"") | gsub("^%3[Cc]%3[Dd]";"") |
          gsub("^%3[Ee]";"") | gsub("^%3[Cc]";"");

        # purl から type, path, ver を抽出
        (
          try (
            .purl 
            | capture("^pkg:(?<type>[^/]+)/(?<path>[^@?#]+)(?:@(?<ver>[^?#]+))?")
          ) catch null
        ) as $p
        | select($p != null)

        | .version_exact =
            ( 
              if ($p.ver // "" | length) > 0 then ($p.ver|strip_range)
              elif ((.version // "" ) | length) > 0 then ((.version|strip_range))
              else (
                .spdxid // "" 
                | sub("-[0-9a-f]{4,}$"; "") 
                | match("[0-9][0-9A-Za-z\\.-]*[0-9A-Za-z]")? 
                | if .==null then "" else .string end
              )
              end 
            )

        # system を抽出
        | .system = ({ npm:"NPM", maven:"MAVEN", pypi:"PYPI", golang:"GO", cargo:"CARGO", nuget:"NUGET", gem:"RUBYGEMS" }[$p.type] // null)
        | .system_supported = (.system != null)

        # name_sys を抽出
        | .name_sys =
            (if .system=="MAVEN" then ($p.path | split("/") | [.[0], (.[1] // "")] | join(":"))
            elif .system=="NPM" then ( if ($p.path | startswith("%40")) then ($p.path | sub("^%40"; "@")) else .name end )
            else $p.path end)

        # name_enc を抽出
        | .name_enc = (if (.name_sys|type)=="string" then (.name_sys|@uri) else null end)
        | .system_lc = (if .system != null then (.system|ascii_downcase) else null end)

        # purl_type を抽出
        | .purl_type = ($p.type|ascii_downcase)
        | .purl_path = $p.path
      )
      ) as $processed
    | {
        meta: { createdAt: "'"${TODAY}"'", "specified-oss": { owner: "'"${OWNER}"'", Repository: "'"${REPO}"'" } },
        data: $processed
      }
  ' "${RAW_GITHUB_DEPENDENCIES_PATH}" >"${PROCESSED_GITHUB_DEPENDENCIES_PATH}"
}

# ----------------------------------------
# 依存 → リポジトリ解決
# ----------------------------------------
process_dependency_record() {
  local dep_json="$1"
  local out_path="$2"

  local fields name version_exact purl_type purl_path system_supported system_lc name_enc
  fields="$(jq -r '[.name, .version_exact, .purl_type, .purl_path, (.system_supported|tostring), (.system_lc // ""), (.name_enc // "")] | @tsv' <<<"$dep_json")"
  IFS=$'\t' read -r name version_exact purl_type purl_path system_supported system_lc name_enc <<<"$fields"

  local host=""
  local owner=""
  local repo=""
  local homepage=""
  local repo_url=""

  if [[ "$purl_type" == "github" || "$purl_type" == "githubactions" ]]; then
    owner="$(printf '%s' "$purl_path" | awk -F/ '{print $1}')"
    repo="$(printf '%s' "$purl_path" | awk -F/ '{print $2}')"
    if [[ -n "$owner" && -n "$repo" ]]; then
      host="github.com"
      homepage="https://github.com/${owner}/${repo}"
      repo_url="$homepage"
    fi
  fi

  if [[ -z "$host" && "$system_supported" == "true" && -n "$system_lc" && -n "$name_enc" && -n "$version_exact" ]]; then
    local api_url="https://api.deps.dev/v3/systems/${system_lc}/packages/${name_enc}/versions/${version_exact}"
    local resp
    resp="$(curl -fsSL "$api_url" 2>/dev/null || echo '{}')"

    local -a cand=()
    readarray -t cand < <(printf '%s' "$resp" | jq -r '
      def link_map:
        reduce (.links // [])[] as $l ({}; . as $acc
          | ((($l.label // "") | ascii_downcase)) as $lab
          | if ($lab|test("home")) then $acc + {homepage: $l.url}
            elif ($lab|test("repo|source")) then $acc + {repository_url: $l.url}
            elif ($lab|test("npm|package|registry")) then $acc + {package_manager_url: $l.url}
            else $acc end);

      def proj_list:
        [ (.relatedProjects // [])[] | select(.relationType=="SOURCE_REPO") | .projectKey.id ];

      (link_map) as $links
      | (proj_list) as $ids
      | if ($ids|length) > 0 then
          $ids | map( split("/") | {host: .[0], owner: .[1], repo: (.[2] // "")} )
              | map(.repo |= sub("\\.git$"; "")) | .[]
        else
          ( $links.repository_url // empty ) as $ru
          | if $ru != "" and ($ru|test("^https?://(github\\.com|gitlab\\.com|bitbucket\\.org)/")) then
              ($ru | sub("^https?://"; "") | split("/") ) as $s
              | { host: $s[0], owner: $s[1], repo: ($s[2] // "") | sub("\\.git$"; "") }
            else empty end
        end
        | @json
    ')

    for c in "${cand[@]}"; do
      local hh="$(jq -r '.host' <<<"$c")"
      if [[ "$hh" == "github.com" ]]; then
        host="$hh"
        owner="$(jq -r '.owner' <<<"$c")"
        repo="$(jq -r '.repo' <<<"$c")"
        homepage="$(printf '%s' "$resp" | jq -r '[.links[]? | select((.label|ascii_downcase)|test("home")) | .url][0] // empty')"
        repo_url="$(printf '%s' "$resp" | jq -r '[.links[]? | select((.label|ascii_downcase)|test("repo|source")) | .url][0] // empty')"
        break
      fi
    done

    if [[ -z "$host" && ${#cand[@]} -gt 0 ]]; then
      local c="${cand[0]}"
      host="$(jq -r '.host' <<<"$c")"
      owner="$(jq -r '.owner' <<<"$c")"
      repo="$(jq -r '.repo' <<<"$c")"
      homepage="$(printf '%s' "$resp" | jq -r '[.links[]? | select((.label|ascii_downcase)|test("home")) | .url][0] // empty')"
      repo_url="$(printf '%s' "$resp" | jq -r '[.links[]? | select((.label|ascii_downcase)|test("repo|source")) | .url][0] // empty')"
    fi
  fi

  if [[ -z "$host" && "$system_lc" == "npm" && -n "$name_enc" ]]; then
    local reg_json
    reg_json="$(curl -fsSL "https://registry.npmjs.org/${name_enc}" 2>/dev/null || echo '{}')"
    repo_url="$(printf '%s' "$reg_json" | jq -r '.repository.url // empty')"
    homepage="$(printf '%s' "$reg_json" | jq -r '.homepage // empty')"
    repo_url="$(normalize_repo_url "$repo_url")"
    homepage="$(normalize_repo_url "$homepage")"
    if [[ "$repo_url" =~ ^https?://github\.com/([^/]+)/([^/?#]+) ]]; then
      host="github.com"
      owner="${BASH_REMATCH[1]}"
      repo="${BASH_REMATCH[2]}"
    fi
  fi

  if [[ -z "$host" && "$system_lc" == "npm" && "$name" == @jsr/* ]]; then
    local ghpath
    ghpath="$(resolve_jsr_to_github "$name" || true)"
    if [[ -n "$ghpath" && "$ghpath" =~ github\.com/([^/]+)/([^/?#]+) ]]; then
      host="github.com"
      owner="${BASH_REMATCH[1]}"
      repo="${BASH_REMATCH[2]}"
      homepage="https://github.com/${owner}/${repo}"
      repo_url="$homepage"
    fi
  fi

  homepage="$(normalize_repo_url "$homepage")"
  repo_url="$(normalize_repo_url "$repo_url")"

  jq -n --arg host "$host" --arg owner "$owner" --arg repo "$repo" \
    --arg homepage "$homepage" --arg repository_url "$repo_url" \
    --arg pkg "$name" --arg ver "$version_exact" '
    {
      package: { name: $pkg, version_exact: $ver },
      host: $host, owner: $owner, repo: $repo,
      homepage: $homepage, repository_url: $repository_url
    }
  ' >"$out_path"
}

# ----------------------------------------
# 依存 → リポジトリ解決
# ----------------------------------------
resolve_repos_per_dep() {
  local max_workers tmpdir idx=0
  max_workers="${GITHUB_OSI_MAX_WORKERS:-6}"
  if ! [[ "$max_workers" =~ ^[0-9]+$ ]] || ((max_workers <= 0)); then
    max_workers=1
  fi

  tmpdir="$(mktemp -d 2>/dev/null || mktemp -d -t github-osi)"

  local -a pids=()

  while IFS= read -r dep; do
    ((idx += 1))
    local out_path="${tmpdir}/dep-$(printf '%06d' "$idx").json"
    process_dependency_record "$dep" "$out_path" &
    pids+=("$!")

    if ((${#pids[@]} >= max_workers)); then
      local pid="${pids[0]}"
      if ! wait "$pid"; then
        rm -rf "$tmpdir"
        return 1
      fi
      pids=("${pids[@]:1}")
    fi
  done <"${PROCESSED_GITHUB_DEPENDENCIES_PATH}"

  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      rm -rf "$tmpdir"
      return 1
    fi
  done

  if ((idx == 0)); then
    : >"${LIBS_JSON}.tmp"
    printf '[]' >"${LIBS_JSON}"
    rm -rf "$tmpdir"
    return 0
  fi

  cat "${tmpdir}"/dep-*.json >"${LIBS_JSON}.tmp"
  jq -s '.' "${LIBS_JSON}.tmp" >"${LIBS_JSON}"
  rm -rf "$tmpdir"
}

# ----------------------------------------
# 最終出力
# ----------------------------------------
emit_output() {
  jq --arg createdAt "${TODAY}" \
    --arg owner "${OWNER}" \
    --arg repo "${REPO}" \
    --slurpfile libs "${LIBS_JSON}" \
    -n '
      {
        meta: { createdAt: $createdAt, "specified-oss": { owner: $owner, Repository: $repo } },
        data: $libs[0]  # ← 依存（パッケージ）単位：重複除去なし
      }' >"${OUTPUT_JSON}"

  printf 'Wrote %s\n' "${OUTPUT_JSON}" >&2
}

main() {
  get_github_sbom
  process_github_sbom
  resolve_repos_per_dep
  emit_output
}

main
