# レビュー検索・GitHub API変換仕様

## 既存仕様書との乖離・注意点

既存の `request-full-text-search.md` は PGroonga、`$queryRaw`, `pgroonga_score`,
`pgroonga_highlight_html`、前方一致サジェスト10件を要求しています。現行レビュー検索は Prisma `contains` /
`mode: "insensitive"` と ID 完全一致が中心で、ハイライトはありません。GitHub
API 変換画面はルートと sidebar 導線がありますが、現行ページは `準備中` 表示のみです。

## 実装場所

- `src/actions/review-search/review-search.ts`
- `src/actions/review-search/cache-get-all-review.ts`
- `src/actions/review-search/cache-get-my-review.ts`
- `src/actions/review-search/cache-get-user-reviews.ts`
- `src/actions/review-search/cache-get-search-suggestion.ts`
- `src/components/review-search/review-search.tsx`
- `src/hooks/review-search/use-review-search.ts`
- `src/app/dashboard/review-search/page.tsx`
- `src/app/dashboard/github-api-conversion/page.tsx`
- `prisma/schema.prisma`

## レビュー検索画面

URL:

- `/dashboard/review-search`

URL params:

- `q`
- `page`
- `tab`

tab:

- `search`: 全レビュー検索
- `edit`: 自分が書いたレビュー
- `received`: 自分が受け取ったレビュー

1ページ件数:

- 5件

## `search` タブ

`getAllReviews(searchParams)` が全レビューを返します。

特徴:

- 認可なしの action として実装されています。
- 返却データ上 `reviewer` は null になり、送信者を伏せます。
- 検索は reviewee名、group名、task名、comment、ID系などを対象にします。
- PGroonga ではなく Prisma `contains` と ID 完全一致です。

## `edit` タブ

`getMyReviews(searchParams)` が、ログインユーザーが書いたレビューを返します。

条件:

- `reviewerId = userId`

機能:

- 自分のレビューを編集できます。
- 更新後は `revalidateTag` します。

`updateReview(reviewId, rating, comment, searchParams)`:

- 認証必須
- reviewId 必須
- rating は 0-5 許容
- `id + reviewerId` で自分が書いたレビューか確認
- 権限がない場合は `レビューが見つからないか、編集権限がありません`

## `received` タブ

`getUserReviews(searchParams)` が、ログインユーザーが受け取ったレビューを返します。

条件:

- `revieweeId = userId`

返却:

- reviewer 情報を含みます。

## サジェスト

`getSearchSuggestions(query)`:

- 2文字未満は `{ success: false, data: [] }`
- `AuctionReview` を最大50件取得
- reviewee名、group名、task名、comment から候補を作成
- 重複排除
- 最大20件返却

## エラー処理

- `tab` 不正
- `page < 1`
- `q` が undefined/null
- DB error

上記は throw される経路があります。

## GitHub API変換画面

URL:

- `/dashboard/github-api-conversion`

現行ページ:

- `準備中` と表示するのみです。

読んだ範囲では、以下は確認できません。

- GitHub API呼び出し
- 入力フォーム
- 変換処理
- DB保存
- Server Action

## 注意点

- DB migration には Task 検索用 PGroonga index がありますが、レビュー検索はそれを使っていません。
- `request-reference-detection-method.md` はプレースホルダー状態で、参照検知の現行実装は確認できません。
