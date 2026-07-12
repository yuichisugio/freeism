# Markets Webアプリ v0.1 ドキュメント

## 位置づけ

この索引は、旧単一WebアプリからMarkets責務へ移したv0.1の実装観測を参照するためのものです。v0.1は履歴資料であり、v0.2の現行仕様ではありません。

## Markets固有のv0.1資料

| 分類         | ドキュメント                                                                               | 備考                                          |
| ------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Auction      | [auction.md](./details/auction.md)                                                         | 出品、入札、自動入札、落札、旧SSE・通知を含む |
| レビュー検索 | [review-search-and-github-conversion.md](./details/review-search-and-github-conversion.md) | AuctionReviewと未実装GitHub変換画面の旧記録   |
| 検索・DB拡張 | [search-indexes-and-db-extensions.md](./details/search-indexes-and-db-extensions.md)       | 旧PostgreSQL・PGroongaを含む                  |

## 旧モノリス共通資料

次の資料は、PointsとMarketsに分離する前の共通構成を保存したarchiveです。すべて非正規であり、現行要件には使用しません。

- [旧v0.1索引](../../../../docs/web-app/archive/v0.1/index.ja.md)
- [概要](../../../../docs/web-app/archive/v0.1/details/overview.md)
- [アーキテクチャ](../../../../docs/web-app/archive/v0.1/details/architecture.md)
- [認証](../../../../docs/web-app/archive/v0.1/details/auth.md)
- [データモデル](../../../../docs/web-app/archive/v0.1/details/data-model.md)
- [エラーハンドリング](../../../../docs/web-app/archive/v0.1/details/response.md)
- [通知](../../../../docs/web-app/archive/v0.1/details/notification.md)
- [その他の旧要件](../../../../docs/web-app/archive/v0.1/details/other.md)

旧Task、Group、評価、ポイント関連の履歴は、[Points Webアプリ v0.1](../../../points-web-app/docs/v0.1/index.ja.md)を参照してください。archive本文中の旧相対リンクより、この索引のリンクを優先します。
