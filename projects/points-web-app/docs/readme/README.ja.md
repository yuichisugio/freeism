# Points Webアプリ

`points.freeism.app` のフロントエンドとバックエンドを管理するWebアプリです。

## 責務

- 評価軸とパッケージの管理
- 不変のFIXリビジョンと差分台帳
- ポイント付与、残高、`evaluationTotal`、予約、確定、解放の管理
- 未受領FIXと外部URL・外部アカウント所有権の検証
- Pointsの認証とMarketsへのOAuth Provider/API提供

商材の出品、Auctionの作成・入札・落札はMarketsの責務です。Taskとグループ機能はv0.2では実装しません。

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
