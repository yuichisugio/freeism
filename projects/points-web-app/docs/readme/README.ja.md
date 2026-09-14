# Points Webアプリ

`points.freeism.app` のフロントエンドとバックエンドを管理するWebアプリです。

## 責務

- 評価軸とパッケージの管理
- 不変のFIXリビジョンと差分台帳
- ポイント付与、残高、`evaluationTotal`、予約、確定、解放の管理
- 未受領FIXとAccountsの照合結果に基づく貢献者の特定
- Points独自の認証・sessionとMarketsへのOAuth Provider/API提供

外部アカウントの管理・所有権証明・公開・照合は、[Accounts v0.1仕様](../../../accounts-web-app/docs/specification/v0.1/main.md)に集約します。PointsはAccountsを別サービスの情報連携先として利用します。

商材情報を含むAuctionの作成・入札・落札はMarketsの責務です。Marketsは独立したListing resourceを持ちません。Taskとグループ機能はv0.2では実装しません。

## 技術方針

- Cloudflare Workers、Workers Static Assets、D1
- Hono、Drizzle、Better Auth
- TanStack Start、Vite+
- SPAとSSGを使用し、runtime SSRとServer Functionsは使用しない

## ドキュメント

- [Webアプリ横断仕様](../../../../docs/web-app/README.md)
- [v0.1履歴](../v0.1/index.ja.md)
- [v0.2仕様](../v0.2/index.ja.md)
- [v0.3検討](../v0.3/main.md)
- [v0.2実装plan](../../plan/v0.2-implementation.md)
- [旧資料の移設manifest](../../../../docs/web-app/doc-migration-manifest.md)

## 開発環境

旧 `projects/web-app` のREADMEに記載されていたmiseコマンドはarchive上の履歴であり、このアプリの現行コマンドではありません。初期化、開発、テスト、デプロイのコマンドは、実装計画に従ってこのプロジェクトのpackage scriptsへ定義します。
