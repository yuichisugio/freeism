# Markets Web App v0.2 仕様

`markets.freeism.app`は、商材の出品とAuctionを責務とする。ポイント付与、残高、評価軸、FIXは`points.freeism.app`が所有する。

## 正本

- [Marketsドメイン仕様](./details-ja/markets-domain.md)
- [Auction詳細](./details-ja/auction.md)
- [リアルタイム・精算](./details-ja/realtime-and-settlement.md)
- [横断アーキテクチャ](../../../../docs/web-app/v0.2/architecture.md)
- [認証仕様](../../../../docs/web-app/v0.2/authentication.md)
- [Points–Markets契約](../../../../docs/web-app/v0.2/points-markets-contract.md)
- [設計判断台帳](../../../../docs/web-app/v0.2/decision-register.md)

## v0.2の境界

- Better Auth、Hono、Drizzle、D1、AuctionRoom Durable Object、Settlement Workflowを使う`auction-worker`と、TanStack Start/Vite PlusのSPA+SSGを同じprojectで管理する。
- MarketsはGoogleだけで独立ログインし、Pointsは後から1対1で明示連携する。
- Taskは完全廃止し、「Task作成」へ読み替えない。作成するのはlistingとAuctionだけである。
- multi-unit uniform-price、AutoBid、即決、終了延長、終了時vector reservationを実装する。
- WebSocketはread-only subscription、bidは認証済みHTTP mutationとする。
- 通知、PWA、画像、Q&A、chatは実装しない。
- v0.1データは移行しない。v0.1文書は実装履歴であり、v0.2の互換要件ではない。

## 実装計画

実行順、対象ファイル、テスト、release gateは`../../plan/v0.2-implementation.md`に記載する。仕様書へ手順を重複させない。

## 英語版

英語版は未作成である。空だった旧`index-en.md`は移設しない。
