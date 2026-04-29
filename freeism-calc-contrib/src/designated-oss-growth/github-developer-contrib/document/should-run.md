# `should_run`関数

## ポイント

1. `—-task_word`は、カンマ区切りで複数ワードを指定できるので、一単語ごとに`—-task_word`オプションを別で用意する必要はない
2. 大文字小文字の正規化もできる
3. スペースで区切られた引数でも、スペースを区切り文字として使用できる
4. 最初に true(0)が返されれば 2 個目のチェックは走らず終了するので、`—-task_word`や`—-arg_word`で重複するタスクを指定しても、process_issue などの関数は、重複して実行されることはない
5. `arg_word`引数 null なら、all 判定でぜんぶを実行
6. 引数に all が入っていても全部を実行（成功ステータスの 0 を返す）

## 関数の全体的な目的と設計思想

この関数は、複数のタスクワードと引数を受け取り、正規化処理を行った後、指定された条件にマッチするかどうかを判定します。戻り値として、実行すべき場合は`0`（成功）、実行すべきでない場合は`1`（失敗）を返すという、Unix ライクシステムの標準的な終了ステータス規約に従っています。

## 初期化部分の詳細解説

```bash
function should_run() {
  local -a task_words=()
  local -a arg_words=()
  local mode="keywords"
```

関数の冒頭では、三つの重要な変数を初期化しています。`local -a task_words=()`は、タスクに関連するキーワードを格納するための動的配列を宣言しています。`-a`オプションは配列タイプを明示的に指定し、`local`キーワードによってこの変数のスコープを関数内に限定しています。

同様に`local -a arg_words=()`は、引数として渡された単語群を格納する配列です。`local mode="keywords"`は、現在の解析モードを追跡する文字列変数で、初期値として`"keywords"`が設定されています。この変数は後続の引数解析ロジックで、現在どのような種類の引数を処理しているかを判定するために使用されます。

## 引数解析ループの詳細構造

```bash
while [[ $# -gt 0 ]]; do
    case "$1" in
```

ここから始まるのは、関数に渡されたすべての引数を順次処理するメインループです。`$#`は引数の総数を表す特殊変数で、`-gt 0`で引数が残っている限りループを継続します。`case "$1" in`構文は、現在処理中の第一引数（`$1`）の値に基づいて分岐処理を行います。

### --task_word オプションの処理

```bash
--task_word)
  if [[ $# -lt 2 ]]; then
    printf '%s\n' "should_run: missing value for --task_word" >&2
    return 1
  fi
  task_words+=("$2")
  shift 2
  ;;
```

この分岐では、`--task_word`オプションを処理しています。まず`if [[ $# -lt 2 ]]`で、現在の引数を含めて少なくとも 2 つの引数が残っているかを確認します。これは`--task_word`の後に値が必要だからです。

引数が不足している場合、`printf '%s\n' "should_run: missing value for --task_word" >&2`でエラーメッセージを標準エラー出力（`>&2`）に出力し、`return 1`で関数を異常終了させます。

正常な場合は、`task_words+=("$2")`で第二引数の値を`task_words`配列に追加し、`shift 2`で引数ポインタを 2 つ進めます。これにより、処理済みのオプションとその値をスキップします。

### --arg_word オプションの処理

```bash
--arg_word)
  if [[ $# -lt 2 ]]; then
    printf '%s\n' "should_run: missing value for --arg_word" >&2
    return 1
  fi
  arg_words+=("$2")
  shift 2
  ;;
```

この部分は`--task_word`と同様の構造ですが、取得した値を`arg_words`配列に格納します。このオプションは、後でマッチング対象となる引数ワードを指定するために使用されます。

### 区切り文字（--）の処理

```bash
--)
  mode="args"
  shift
  continue
  ;;
```

ダブルハイフン（`--`）は、多くの Unix コマンドで「ここから先はすべて引数として扱う」という意味を持つ標準的な区切り文字です。この分岐に入ると、`mode`変数を`"args"`に変更し、`shift`で区切り文字自体をスキップして、`continue`でループの次の反復に進みます。

### 一般的な引数の処理

```bash
*)
  if [[ "$mode" == "keywords" ]]; then
    task_words+=("$1")
    mode="args"
  else
    arg_words+=("$1")
  fi
  shift
  ;;
```

この`*)`パターンは、上記のどのパターンにもマッチしない全ての引数をキャッチします。現在のモードが`"keywords"`の場合、この引数を`task_words`に追加し、モードを`"args"`に変更します。これにより、最初の非オプション引数以降はすべて`arg_words`に格納されるという動作を実現しています。

## タスクワードの正規化処理

```bash
local -a normalized_names=()
local task_entry
for task_entry in "${task_words[@]}"; do
```

ここから始まるのは、収集したタスクワードを正規化する重要なセクションです。`normalized_names`配列を新たに作成し、各タスクエントリを統一的な形式に変換していきます。

### 空要素のスキップと基本正規化

```bash
if [[ -z "$task_entry" ]]; then
  continue
fi

local normalized_input="$task_entry"
normalized_input="${normalized_input//,/ }"
normalized_input="${normalized_input//|/ }"
```

空の要素は`continue`でスキップし、非空の要素については正規化処理を開始します。`"${normalized_input//,/ }"`は、Bash の文字列置換機能を使用して、すべてのカンマをスペースに置換しています。同様に、パイプ文字（`|`）もスペースに置換します。これにより、異なる区切り文字で記述されたキーワードを統一的に処理できます。

### キーワード分割と更なる正規化

```bash
local -a keyword_parts=()
read -r -a keyword_parts <<<"$normalized_input" || true

local keyword_part
for keyword_part in "${keyword_parts[@]}"; do
  if [[ -z "$keyword_part" ]]; then
    continue
  fi
  keyword_part="$(printf '%s' "$keyword_part" | tr '[:upper:]' '[:lower:]')"
  keyword_part="${keyword_part//_/-}"
  normalized_names+=("$keyword_part")
done
```

`read -r -a keyword_parts <<<"$normalized_input"`は、Here String 構文を使用してスペース区切りの文字列を配列に分割しています。`|| true`は、`read`コマンドが失敗した場合でもスクリプトの実行を継続させるためのイディオムです。

各キーワード部分について、まず`tr '[:upper:]' '[:lower:]'`で大文字小文字を正規化し、続いて`"${keyword_part//_/-}"`でアンダースコアをハイフンに置換します。これにより、`My_Task`、`my-task`、`MY_TASK`などの異なる記述方式が`my-task`という統一形式に正規化されます。

## 選択されたタスクの処理

```bash
local -a selected_tasks=()
if ((${#arg_words[@]} > 0)); then
```

この条件文は、`arg_words`配列に要素が存在するかを確認しています。`${#arg_words[@]}`は配列の要素数を取得する構文で、`(( ))`は算術評価コンテキストを表します。

### 引数の再正規化

```bash
local arg part
for arg in "${arg_words[@]}"; do
  arg="${arg// /,}"

  local -a parts=()
  IFS=, read -r -a parts <<<"$arg" || true
```

ここでは、引数内のスペースをカンマに置換した後、`IFS=,`（Internal Field Separator）を一時的にカンマに設定して文字列を分割しています。この処理により、スペースで区切られた引数もカンマで区切られた引数も統一的に処理できます。

### 選択タスクの正規化と格納

```bash
if ((${#parts[@]} > 0)); then
  for part in "${parts[@]}"; do
    if [[ -n "$part" ]]; then
      selected_tasks+=("$(printf '%s' "$part" | tr '[:upper:]' '[:lower:]')")
    fi
  done
fi
```

分割された各部分について、空でない場合のみ小文字に変換して`selected_tasks`配列に追加します。この処理により、大文字小文字を区別しない柔軟なマッチングが可能になります。

## マッチング判定の実行

```bash
if ((${#selected_tasks[@]} == 0)); then
  return 0
fi
```

選択されたタスクが存在しない場合、すべてのタスクが実行対象とみなされ、`return 0`で成功を返します。これは「フィルターが指定されていない場合はすべて実行する」という寛容な設計思想を反映しています。

### 実際のマッチング処理

```bash
local sel normalized_name
for sel in "${selected_tasks[@]}"; do
  sel="${sel//_/-}"
  if [[ "$sel" == "all" ]]; then
    return 0
  fi

  for normalized_name in "${normalized_names[@]}"; do
    if [[ "$sel" == "$normalized_name" ]]; then
      return 0
    fi
  done
done

return 1
```

最終的なマッチング処理では、まず各選択タスクのアンダースコアをハイフンに正規化します。特別なキーワード`"all"`が指定されている場合は無条件で実行を許可します。

その後、二重ループで選択された各タスクと正規化されたタスク名を比較し、一つでもマッチすれば`return 0`で成功を返します。すべての比較が失敗した場合、`return 1`で不一致を示します。
