# Markets Webアプリ

`markets.freeism.app` のフロントエンドとバックエンドを管理するWebアプリです。

## 責務

- 商材情報を含むAuctionの作成、入札、落札、落札証明
- Auction単位のDurable ObjectとHibernation WebSocket
- Settlement WorkflowによるPoints予約、確定、解放の連携
- Markets自身の独立アカウントとPointsアカウントの明示連携

出品はAuction作成を意味し、独立したListing resourceは持ちません。Marketsはポイント残高、評価軸、FIX、ポイント台帳を所有しません。Taskとグループ機能はv0.2では実装しません。

## 技術方針

- Cloudflare Workers、Workers Static Assets、D1
- Auction単位のDurable Objects、Hibernation WebSocket、Workflows
- Hono、Drizzle、Better Auth
- TanStack Start、Vite+
- SPAとSSGを使用し、runtime SSRとServer Functionsは使用しない

## ドキュメント

- [Webアプリ横断仕様](../../../../docs/web-app/README.md)
- [v0.1履歴](../specification/v0.1/index.ja.md)
- [v0.2仕様](../specification/v0.2/index.ja.md)
- [v0.3候補](../specification/v0.3/main.md)
- [v0.2実装plan](../plan/v0.2-implementation.md)
- [複数Points提供先の接続設計](../plan/multiple-points-providers.md)
- [旧資料の移設manifest](../../../../docs/web-app/doc-migration-manifest.md)

## 開発環境

初期化、開発、テスト、デプロイのコマンドは、このプロジェクトの `package.json` にある scripts を参照してください。

## Points 提供先の準備

接続する環境の D1 migration を先に適用します。Markets は `0015_markets-admin-role.sql` と `0016_multi-points-providers.sql` を含む全未適用分を、Freeism Points は `0025_points_dpop.sql` を含む全未適用分を適用します。staging の例は次のとおりです。

```bash
cd projects/markets-web-app
pnpm exec wrangler d1 migrations apply DB --env staging --remote --config wrangler.jsonc
cd ../points-web-app
pnpm exec wrangler d1 migrations apply DB --env staging --remote --config wrangler.jsonc
```

production でも両アプリのコマンドを `--env production` に替えて適用します。対象環境を確認してから実行してください。

Markets に、環境ごとに生成したランダムな32 byte鍵をbase64化した `POINTS_KEY_ENCRYPTION_KEY` を secret として設定します。staging と production にはそれぞれ別の値を登録してください。リポジトリのルートから実行し、値は対話入力します。

```bash
cd projects/markets-web-app
pnpm exec wrangler secret put POINTS_KEY_ENCRYPTION_KEY --env staging --config wrangler.jsonc
pnpm exec wrangler secret put POINTS_KEY_ENCRYPTION_KEY --env production --config wrangler.jsonc
```

## Markets ADMIN の初期付与

Markets の Better Auth `user.role` に `admin` を含む利用者だけが提供先管理と精算の手動 retry を実行できます。migration 適用後、対象利用者が Markets にログインして `user.id` が確定したら、運用者がリポジトリのルートから次の SQL を実行します。`REPLACE_WITH_USER_ID` をその `user.id` に置き換えてください。DB 名は `wrangler.jsonc` の staging=`markets-staging`、production=`markets-production` に対応します。

```bash
cd projects/markets-web-app
pnpm exec wrangler d1 execute markets-staging --env staging --remote --command "UPDATE \"user\" SET role = 'admin' WHERE id = 'REPLACE_WITH_USER_ID'"
pnpm exec wrangler d1 execute markets-staging --env staging --remote --command "SELECT id, role FROM \"user\" WHERE id = 'REPLACE_WITH_USER_ID'"
```

production に付与する場合は両コマンドの DB 名を `markets-production`、`--env` を `production` に置き換えます。対象 DB と利用者 ID を確認してから実行します。

## Points 提供先の登録

Markets ADMIN は `/admin/points-connections` で提供先 origin を登録し、表示された公開 JWK Set と2件の callback URL を提供先の OAuth Client に登録します。URL は各環境の `APP_ORIGIN` に `/api/points-connection/callback`（link）と `/api/points-connection/unlink/callback`（unlink）を付けたものです。提供先から発行された Client ID を Markets に入力し、有効化時の実トークン取得で接続を確認します。
