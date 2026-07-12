# Webアプリ横断ドキュメント

このディレクトリは、`points.freeism.app` と `markets.freeism.app` にまたがる仕様、規約、移設履歴の入口です。

## 正本の範囲

- Points固有の仕様は、[Points Webアプリのドキュメント](../../projects/points-web-app/docs/readme/README.ja.md)を正本とします。
- Markets固有の仕様は、[Markets Webアプリのドキュメント](../../projects/markets-web-app/docs/readme/README.ja.md)を正本とします。
- 認証連携、命名規則、レスポンス形式など、両アプリにまたがる仕様は本ディレクトリの `v0.2/` を正本とします。
- `archive/` は旧モノリスの仕様や検討過程を失わずに残すための保管場所です。現行仕様の根拠には使用しません。

仕様が競合する場合は、現行のv0.2仕様、各appのv0.2仕様、v0.1・archiveの順で優先します。実行手順は仕様書へ複製せず、各planから正本の仕様を参照します。

## サービス境界

| サービス | ドメイン              | 責務                                                              |
| -------- | --------------------- | ----------------------------------------------------------------- |
| Points   | `points.freeism.app`  | 評価軸、パッケージ、FIX評価、ポイント付与、残高・台帳・予約の管理 |
| Markets  | `markets.freeism.app` | 商材の出品、Auctionの作成・入札・落札、Pointsとの決済連携         |

Taskとグループ機能はv0.2では廃止済みです。MarketsはPointsの残高や台帳を所有せず、Pointsは商材やAuctionを所有しません。

## 現行の横断仕様

- [横断アーキテクチャ](./v0.2/architecture.md)
- [認証・外部ID](./v0.2/authentication.md)
- [Points–Markets連携契約](./v0.2/points-markets-contract.md)
- [セキュリティ・テスト・デリバリー](./v0.2/security-and-delivery.md)
- [設計判断台帳](./v0.2/decision-register.md)
- [命名規則](./v0.2/naming-convention.md)
- [バックエンドレスポンス形式](./v0.2/response-format.md)
- [固定公開ページ本文](./v0.2/static-pages/README.md)

## app別ドキュメント

- [Points Webアプリ](../../projects/points-web-app/docs/readme/README.ja.md)
  - [v0.1履歴](../../projects/points-web-app/docs/v0.1/index.ja.md)
  - [v0.2仕様](../../projects/points-web-app/docs/v0.2/index.ja.md)
  - [v0.3検討](../../projects/points-web-app/docs/v0.3/main.md)
- [Markets Webアプリ](../../projects/markets-web-app/docs/readme/README.ja.md)
  - [v0.1履歴](../../projects/markets-web-app/docs/v0.1/index.ja.md)
  - [v0.2仕様](../../projects/markets-web-app/docs/v0.2/index.ja.md)
  - [v0.3候補](../../projects/markets-web-app/docs/v0.3/main.md)

## 実装計画

- [横断migration plan](../../plan/web-app/v0.2-migration.md)
- [Points実装plan](../../projects/points-web-app/plan/v0.2-implementation.md)
- [Markets実装plan](../../projects/markets-web-app/plan/v0.2-implementation.md)

## 移設履歴

- [旧39 Markdownの移設manifest](./doc-migration-manifest.md)
- [archiveの位置づけ](./archive/README.md)
