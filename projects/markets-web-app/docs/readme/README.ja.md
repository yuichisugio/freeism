# Markets Webアプリ

`markets.freeism.app` のフロントエンドとバックエンドを管理するWebアプリです。

## 責務

- 商材の出品
- Auctionの作成、入札、落札、落札証明
- Auction単位のDurable ObjectとHibernation WebSocket
- Settlement WorkflowによるPoints予約、確定、解放の連携
- Markets自身の独立アカウントとPointsアカウントの明示連携

Marketsはポイント残高、評価軸、FIX、ポイント台帳を所有しません。Taskとグループ機能はv0.2では実装しません。

## 技術方針

- Cloudflare Workers、Workers Static Assets、D1
- Auction単位のDurable Objects、Hibernation WebSocket、Workflows
- Hono、Drizzle、Better Auth
- TanStack Start、Vite+
- SPAとSSGを使用し、runtime SSRとServer Functionsは使用しない

## ドキュメント

- [Webアプリ横断仕様](../../../../docs/web-app/README.md)
- [v0.1履歴](../v0.1/index.ja.md)
- [v0.2仕様](../v0.2/index.ja.md)
- [v0.3候補](../v0.3/main.md)
- [v0.2実装plan](../../plan/v0.2-implementation.md)
- [旧資料の移設manifest](../../../../docs/web-app/doc-migration-manifest.md)

## 開発環境

旧 `projects/web-app` のREADMEに記載されていたmiseコマンドはarchive上の履歴であり、このアプリの現行コマンドではありません。初期化、開発、テスト、デプロイのコマンドは、実装計画に従ってこのプロジェクトのpackage scriptsへ定義します。
