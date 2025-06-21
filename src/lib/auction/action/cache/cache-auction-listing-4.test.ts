/**
 * 効率的なパラメータ組み合わせを生成する関数
 * 重要なパターンに絞った組み合わせを生成（メモリ効率を考慮）
 */
export const combinations = {
  // 基本的なカテゴリーパターン
  categoriesOptions: [null, [], ["すべて"], ["デザイン"], ["食品", "デザイン"]],

  // 主要なステータスパターン
  statusOptions: [
    null,
    [],
    ["all"],
    ["watchlist"],
    ["not_bidded"],
    ["bidded"],
    ["ended"],
    ["not_ended"],
    ["watchlist", "bidded"],
  ],

  joinTypeOptions: ["OR", "AND"],

  // 境界値とnull
  minBidOptions: [null, 0, 500],
  maxBidOptions: [null, 0, 1500],

  // 時間設定
  minRemainingTimeOptions: [null, 0, 24],
  maxRemainingTimeOptions: [null, 0, 50],

  // グループIDパターン
  groupIdsOptions: [null, ["group1"], ["group1", "group2"]],

  // 検索クエリパターン
  searchQueryOptions: [
    null,
    "",
    "検索",
    "複数 キーワード",
    "'; DROP TABLE test; --", // SQLインジェクション対策テスト
  ],

  // ソートパターン
  sortOptions: [
    null,
    [{ field: "relevance" as const, direction: "asc" as const }],
    [{ field: "newest" as const, direction: "desc" as const }],
    [{ field: "bids" as const, direction: "asc" as const }],
    [{ field: "price" as const, direction: "desc" as const }],
  ],

  pageOptions: [1, 2],
  userIdOptions: ["user1"],
};
