# オークション出品一覧実装仕様書

## 1. 概要

オークション出品一覧画面は、ユーザーが様々な出品商品を閲覧できる機能です。この画面では以下の機能を提供します：

- カテゴリ別フィルタリング
- ステータス別フィルタリング
- キーワード検索
- ソート機能
- ページネーション
- ウォッチリスト登録/解除

本仕様書では、実装における重要なポイントと最適化手法を解説します。

## 2. アーキテクチャ

### 2.1 ファイル構成

```
src/
├── components/
│   └── auction/
│       └── listing/
│           ├── auction-listings.tsx  # メインコンポーネント
│           ├── auction-card.tsx      # 個別商品表示コンポーネント
│           ├── auction-filters.tsx   # フィルター操作コンポーネント
│           └── auction-pagination.tsx # ページネーションコンポーネント
├── hooks/
│   └── auction/
│       └── listing/
│           └── use-auction-listings.ts # メインロジック
└── lib/
    └── auction/
        ├── action/
        │   ├── auction-listing.ts    # データ取得処理
        │   └── watchlist.ts          # ウォッチリスト操作
        └── type/
            └── types.ts              # 型定義
```

### 2.2 コンポーネント設計方針

- **UI（View）とロジックの分離**

  - コンポーネントは表示のみを担当
  - ビジネスロジックはカスタムフックに分離
  - データ取得とデータ操作のロジックも分離

- **責務の明確化**
  - 各コンポーネントは単一の責務を持つ
  - データフェッチングはサーバーアクションで実装
  - 状態管理はカスタムフック内でカプセル化

## 3. 実装ステップ

### ステップ1: 基本構造の設計

```tsx
// auction-listings.tsx
"use client";

import React, { memo } from "react";
import { useAuctionListings } from "@/hooks/auction/listing/use-auction-listings";
import { AuctionCard } from "./auction-card";
import { AuctionFilters } from "./auction-filters";
import { AuctionPagination } from "./auction-pagination";

export const AuctionListings = memo(function AuctionListings() {
  // カスタムフックからロジックと状態を取得
  const {
    // 状態
    categories,
    pageSize,
    auctions,
    totalCount,
    totalPages,
    searchQuery,
    filters,
    sortOption,
    page,
    isPending,

    // アクション
    setSearchQuery,
    handlePageChange,
    handleFilterChange,
    handleSortChange,
    handleResetFilters,
    handleToggleWatchlist,
  } = useAuctionListings();

  // レンダリング
  return (
    // UIコンポーネント
  );
});
```

### ステップ2: カスタムフックの基本設計

```tsx
// use-auction-listings.ts
export function useAuctionListings(): UseAuctionListingsReturn {
  // 状態管理
  const [categories, setCategories] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AuctionFilterParams>({...});
  const [sortOption, setSortOption] = useState<AuctionSortOption>("newest");
  const [isPending, setIsPending] = useState(false);

  // 各種アクションハンドラ

  // 戻り値（コンポーネントで利用可能な状態とアクション）
  return {
    categories,
    pageSize,
    auctions,
    totalCount,
    totalPages,
    searchQuery,
    filters,
    sortOption,
    page,
    isPending,
    setSearchQuery,
    handlePageChange,
    handleFilterChange,
    handleSortChange,
    handleResetFilters,
    handleToggleWatchlist,
  };
}
```

## 4. 重要な実装ポイント

### 4.1 無限ループの防止策

無限ループは、URL更新とデータ取得が相互に依存し合う場合に発生します。以下の対策を実装しました：

1. **URLパラメータ更新と状態更新の分離**

   ```tsx
   // 避けるべき実装
   useEffect(() => {
     router.push(`/auction?page=${page}`);
     fetchData();
   }, [page]);

   // 推奨実装
   const handlePageChange = useCallback((newPage) => {
     setPage(newPage);
     router.push(`/auction?page=${newPage}`);
     fetchData();
   }, []);
   ```

2. **適切な依存関係の設定**

   - URL更新の関数を依存配列から除外
   - 複数のuseEffectを適切に分離
   - 初期化処理は一度だけ実行

3. **共通処理の抽出**
   ```tsx
   const fetchDataAndUpdateUrl = useCallback(async () => {
     try {
       setIsPending(true);
       // URL更新（無限ループを防ぐためにここで実行）
       updateUrlParams();
       // データ取得
       await fetchListings();
     } finally {
       setIsPending(false);
     }
   }, [fetchListings, updateUrlParams, page, filters, sortOption]);
   ```

### 4.2 効率的なデータ取得

1. **不要なデータ取得の防止**

   - 状態変更時のみデータを取得
   - デバウンス処理による過剰なAPIコールの防止

2. **インジケーターの表示**

   - データ取得中はロード状態を表示
   - エラー時は適切なメッセージを表示

3. **初期データの並行取得**

   ```tsx
   const loadInitialData = useCallback(async () => {
     try {
       // 並行して複数のデータを取得
       const [categoriesData, pageSizeData] = await Promise.all([getAuctionCategories(), getAuctionPageSize()]);

       // 各データの設定
       setCategories(categoriesData);
       setPageSize(pageSizeData);
     } catch (error) {
       console.error("データ取得エラー", error);
     }
   }, []);
   ```

### 4.3 状態管理の最適化

1. **状態の適切な分割**

   - 関連する状態をグループ化
   - 不必要に細かく分割しない

2. **状態更新の最適化**

   - バッチ更新の活用
   - 不要な状態更新の防止

3. **ハンドラ関数の最適化**
   ```tsx
   const handleFilterChange = useCallback(
     (newFilters) => {
       setFilters((prev) => ({ ...prev, ...newFilters }));
       setPage(1); // フィルター変更時は1ページ目に戻す
       void fetchDataAndUpdateUrl();
     },
     [fetchDataAndUpdateUrl],
   );
   ```

## 5. パフォーマンス最適化

### 5.1 メモ化

1. **コンポーネントのメモ化**

   ```tsx
   export const AuctionListings = memo(function AuctionListings() {
     // ...
   });
   ```

2. **関数のメモ化**
   ```tsx
   const fetchListings = useCallback(async () => {
     // ...
   }, [page, pageSize, filters, sortOption]);
   ```

### 5.2 データ取得の最適化

1. **ページサイズの最適化**

   - 適切なページサイズの設定
   - ページネーションによるデータ量の制限

2. **デバウンス処理**

   ```tsx
   const debouncedSearchQuery = useDebounce(searchQuery, 300);

   useEffect(() => {
     if (debouncedSearchQuery !== filters.searchQuery) {
       setFilters((prev) => ({ ...prev, searchQuery: debouncedSearchQuery }));
       setPage(1);
       void fetchDataAndUpdateUrl();
     }
   }, [debouncedSearchQuery, filters.searchQuery, fetchDataAndUpdateUrl]);
   ```

3. **キャッシュの活用**
   - サーバーアクションでのキャッシュ設定
   - 重複リクエストの防止

### 5.3 レンダリングの最適化

1. **条件付きレンダリング**

   ```tsx
   {
     isPending ? (
       <LoadingIndicator />
     ) : auctions.length > 0 ? (
       <AuctionGrid items={auctions} />
     ) : (
       <EmptyState onReset={handleResetFilters} />
     );
   }
   ```

2. **仮想スクロール**
   - 大量のアイテム表示時は仮想スクロールの検討

## 6. エラーハンドリング

### 6.1 エラー境界の設定

- コンポーネントレベルでのエラー境界の設定
- エラー時の適切なフォールバックUI

### 6.2 非同期処理のエラーハンドリング

```tsx
try {
  const result = await getAuctionListings(params);
  // 成功時の処理
} catch (error) {
  console.error("データ取得エラー", error);
  // エラー表示
} finally {
  setIsPending(false);
}
```

### 6.3 ユーザーへのフィードバック

- エラーメッセージの適切な表示
- リトライ機能の提供
- オフライン状態の検出と対応

## 7. アクセシビリティ

- キーボードナビゲーションのサポート
- スクリーンリーダー対応
- 十分なコントラスト比の確保
- レスポンシブ設計

## 8. テスト方針

- コンポーネントの単体テスト
- カスタムフックのテスト
- インテグレーションテスト
- エンドツーエンドテスト

## 9. デバッグのベストプラクティス

1. **効果的なロギング**

   ```tsx
   console.log("use-auction-listings_fetchDataAndUpdateUrl_start", {
     page,
     category: filters.category,
     status: filters.status,
     sort: sortOption,
     searchQuery: filters.searchQuery,
   });
   ```

2. **パフォーマンスチェック**

   - React DevTools Profilerの活用
   - レンダリング回数の監視

3. **状態変化の追跡**
   - useEffectの依存関係の確認
   - 状態更新のタイミングの確認

## 10. まとめ

オークション出品一覧の実装では、以下のポイントに注意しました：

1. **UI/ロジック分離**: コンポーネントとカスタムフックで責務を分離
2. **無限ループ防止**: URL更新と状態更新の適切な分離
3. **パフォーマンス最適化**: メモ化、デバウンス、効率的なデータ取得
4. **エラーハンドリング**: すべての非同期処理でのエラー対応
5. **共通処理の抽出**: 重複コードの削減とメンテナンス性の向上
6. **適切なデバッグ**: 効果的なロギングと状態監視

これらの原則に従うことで、メンテナンス性が高く、パフォーマンスの良いオークション出品一覧を実装できます。

## updateUrlParamsの重要性

- getAuctionListingsData だけでもデータ取得は可能です。しかし、updateUrlParams にはいくつかの重要な役割があります：
  - URL共有の有効化
    - フィルター条件やカテゴリなどをURLに反映することで、特定の検索結果を他のユーザーと共有できます
    - ブックマークすることで、同じ検索条件にいつでも戻れます
  - ブラウザ履歴の活用
    - ブラウザの「戻る」ボタンで前の検索条件に戻れるようになります
    - 複数の検索条件を行き来するナビゲーションが可能になります
  - ページリロード時の状態保持
    - ページをリロードしても、URLからフィルター条件を復元できます
    - F5キーを押した場合でもユーザー体験が維持されます
- 状態だけでデータを取得する場合、これらのメリットがすべて失われ、ユーザビリティが低下します。
  - 特にオークション一覧のような検索/フィルタリングの多い画面では、URLパラメータによる状態管理は一般的な設計パターンとして重要です。
- つまり、機能としては getAuctionListingsData だけでも動作しますが、UXの観点からは updateUrlParams も必要と言えます。
