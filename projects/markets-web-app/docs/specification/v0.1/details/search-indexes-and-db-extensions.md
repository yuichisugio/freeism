# 検索インデックス・DB拡張仕様

## 既存仕様書との乖離・注意点

既存の `request-full-text-search.md`
は全文検索の要求仕様として PGroonga の利用を広く述べています。現行実装で PGroonga を使っていることが確認できるのは、主にオークション一覧の Task 検索です。レビュー検索では PGroonga
index の利用は確認できません。

初期 migration だけを見ると `Task.task || ' ' || detail` 向け index に見えますが、後続 migration で
`public.normalize_japanese(task || ' ' || coalesce(detail, ''))`
を対象にした index へ作り直されます。現行の検索式に近いのは後続 migration の正規化 index です。

## 実装場所

- `supabase/migrations/20250430064851_create_pgroonga_index.sql`
- `supabase/migrations/20250430145255_create_normalize_function.sql`
- `supabase/migrations/20250430145458_create_normalized_pgroonga_indexes.sql`
- `supabase/migrations/20250501035828_add_search_path_to_normalize_japanese.sql`
- `src/actions/auction/cache/cache-auction-listing.ts`
- `src/actions/auction/cache/cache-auction-suggestion.ts`
- `src/actions/review-search/cache-get-all-review.ts`
- `src/actions/review-search/cache-get-user-reviews.ts`
- `src/actions/review-search/cache-get-my-review.ts`
- `src/actions/review-search/cache-get-search-suggestion.ts`
- `prisma/schema.prisma`

## DB拡張

Migration で以下が作成されます。

- `pgroonga` extension
- `normalize_japanese()` 関数
- Task の `task/detail` 向け PGroonga index

Token:

- TokenMecab
- TokenBigram

PGroonga は Prisma schema ではなく Supabase migration で管理されます。Prisma schema の `datasource.extensions` には
`uuid_ossp` があり、`pgroonga` は migration 側で作成されます。

初期 migration:

- `CREATE EXTENSION IF NOT EXISTS pgroonga with schema extensions`
- `pgroonga_task_text_mecab_idx`
- `pgroonga_task_text_bigram_idx`
- 対象式: `task || ' ' || detail`
- tokenizer: `TokenMecab` / `TokenBigram`
- normalizer: `NormalizerAuto`

後続 migration:

1. 既存の `pgroonga_task_text_mecab_idx` と `pgroonga_task_text_bigram_idx` を drop します。
2. `public.normalize_japanese(task || ' ' || coalesce(detail, ''))` を対象に index を作り直します。
3. tokenizer は `TokenMecab` と `TokenBigram` の2系統です。
4. normalizer はどちらも `NormalizerAuto` です。

`normalize_japanese(text)`:

- `lower` と `NFKC` 正規化を行います。
- `IMMUTABLE` です。
- `STRICT` なので、引数が `NULL` の場合は `NULL` を返します。
- 後続 migration で `search_path = public, pg_temp` が固定されています。

## オークション一覧検索

`cachedGetAuctionListings` は raw SQL で検索条件を組み立てます。

対象:

- `Task.task`
- `Task.detail`

処理:

- `public.normalize_japanese(t.task || ' ' || COALESCE(t.detail,''))`
- `&@~` による検索
- whitespace 区切り keywords
- `pgroonga_score`
- `pgroonga_highlight_html`

検索時の sort は relevance/score を使えます。

`cachedGetAuctionListingsAndCount` は Prisma の raw SQL で `Auction` と `Task`
を join し、参加グループ内のオークションだけを検索します。基本スコープは `a."group_id" = ANY(userGroupIds)` です。条件で
`groupIds` が指定された場合は、`userGroupIds` との交差だけを許可し、交差がない場合は0件を返します。

入力条件:

- `userGroupIds` が空の場合は `{ listings: [], count: 0 }`
- `page` は1以上
- `categories` は `AUCTION_CONSTANTS.AUCTION_CATEGORIES` 内の値
- `status` は auction filter の許可値
- `minBid` / `maxBid` / `minRemainingTime` / `maxRemainingTime` は0以上
- `sort[0].field` と `sort[0].direction` は許可配列内の値
- `searchQuery` は string で、5000文字以内

検索語がある場合、`searchQuery.trim().replace(/\s+/g, " OR ")`
で空白区切り語を OR 検索文字列に変換し、以下の条件を WHERE に追加します。

```sql
public.normalize_japanese(t.task || ' ' || COALESCE(t.detail, '')) &@~ :normalizedQuery
```

検索時だけ以下を取得します。

- `pgroonga_score(t.tableoid, t.ctid) as score`
- `pgroonga_query_extract_keywords(...)`
- `pgroonga_highlight_html(t.task, keywords) as task_highlighted`
- `pgroonga_highlight_html(t.detail, keywords) as detail_highlighted`

取得処理は CTE で段階化されています。先に検索・filter・sort・paging を適用し、`LIMIT/OFFSET`
後に入札数、ウォッチ状態、実行者情報を別 CTE で付与します。

デフォルト sort:

- 検索あり: `score DESC NULLS LAST`
- 検索なし: `a."created_at" DESC NULLS LAST`
- `relevance` sort は検索時だけ score sort になり、検索条件がない場合は通常のデフォルト sort に戻ります。

## オークションサジェスト

オークション検索サジェストも PGroonga raw SQL を使います。

- 参加グループ内に限定します。
- `query.trim().replace(/\s+/g, " OR ")` を使います。
- 実 SQL は `&@~` を使います。
- `score DESC` で並べます。
- デフォルト上限は10件です。

旧要求にあった前方一致サジェストは、コメントとして残っている箇所がありますが、現行SQLで確認できるのは `&@~` です。

## レビュー検索

レビュー検索 action は Prisma の `contains` と `mode: "insensitive"`、ID完全一致を使います。

確認できないもの:

- Review 用 PGroonga index
- `pgroonga_score`
- `pgroonga_highlight_html`
- 前方一致サジェスト10件

レビュー検索のページサイズは5件で、`createdAt desc` で取得します。`q`
が空文字の場合は検索条件を追加せず、対象スコープ内のレビュー一覧を返します。`q` が `undefined` / `null`
の場合はエラーです。

検索対象:

- 全体検索:
  - 受信者 username
  - comment
  - group name
  - task name
  - reviewerId
  - revieweeId
  - auctionId
  - taskId
  - groupId
- 受信レビュー:
  - `revieweeId = userId` を固定
  - 送信者 username
  - comment
  - group name
  - task name
  - reviewerId
  - auctionId
  - taskId
  - groupId
- 自分のレビュー:
  - `reviewerId = userId` を固定
  - 受信者 username
  - comment
  - group name
  - task name
  - revieweeId
  - auctionId
  - taskId
  - groupId

全体検索では送信者情報を返さず、受信レビューでは送信者情報を返し、自分のレビューでは受信者情報を返します。

## サジェスト

レビュー検索サジェストは DB index ではなく、`AuctionReview` 最大50件を取得してアプリ側で候補を作り、最大20件に絞ります。

処理:

1. query が空文字、または trim 後2文字未満なら空配列を返します。
2. `AuctionReview.findMany({ take: 50 })` で関連情報を取得します。
3. 受信者 username、group name、task name、comment を抽出します。
4. 各値が query を含む場合だけ Set に追加します。
5. label は `受信者:` / `グループ:` / `タスク:` / `コメント:` の prefix を付けます。
6. label 表示は30文字を超える場合に省略します。
7. value 重複を除去し、最大20件に制限します。

## 注意点

- `request-full-text-search.md` の対象が Task/出品検索だけなのか、レビュー検索も含むのかは文書上明確ではありません。
- 現行実装では「Task/出品検索」と「レビュー検索」で検索方式が異なります。
- レビュー検索の `contains`
  が PostgreSQL 上でどの index を使うかは未確認です。少なくとも PGroonga の利用は確認できません。
- `AuctionReview.comment` 向け PGroonga index は確認できません。

## 旧要求メモとの差分

旧要求メモには、`&@` 指定、サジェスト10件、RPC不使用、ハイライト、`use cache`
などの方針が含まれていました。現行実装では、オークション一覧検索では PGroonga と highlight を使いますが、レビュー検索では Prisma
`contains` とID完全一致を使います。サジェストもレビュー検索では最大20件です。
