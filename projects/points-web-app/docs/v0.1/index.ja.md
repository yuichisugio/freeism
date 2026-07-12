# Points Webアプリ v0.1 ドキュメント

## 位置づけ

この索引は、旧単一WebアプリからPoints責務へ移したv0.1の実装観測を参照するためのものです。v0.1は履歴資料であり、v0.2の現行仕様ではありません。

## Points固有のv0.1資料

| 分類             | ドキュメント                                                                       | 備考                                  |
| ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| 貢献評価・FIX    | [contribution-evaluation-and-fix.md](./details/contribution-evaluation-and-fix.md) | 旧Analytics、Task固定評価、GroupPoint |
| CSV出力          | [csv-export.md](./details/csv-export.md)                                           | 旧Task・Analytics CSV                 |
| CSV取込          | [csv-upload.md](./details/csv-upload.md)                                           | 旧Task・評価CSV                       |
| グループ         | [group-management.md](./details/group-management.md)                               | v0.2で廃止                            |
| 画像アップロード | [image-upload-cloudflare-r2.md](./details/image-upload-cloudflare-r2.md)           | v0.2で廃止                            |
| 権限             | [permission.md](./details/permission.md)                                           | 旧Group・Task・CSV認可                |
| タスク           | [task-management.md](./details/task-management.md)                                 | v0.2で完全廃止                        |
| ユーザー設定     | [user-settings.md](./details/user-settings.md)                                     | 旧通知設定を含む                      |

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

Auction関連の履歴は、[Markets Webアプリ v0.1](../../../markets-web-app/docs/v0.1/index.ja.md)を参照してください。本文中の旧 `auction.md` 相対リンクより、この索引のリンクを優先します。
