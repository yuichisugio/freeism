# Points Web App v0.2 仕様

`points.freeism.app`は、ポイント付与とポイント管理だけを責務とする。商材情報を含むAuction、入札、落札証明は`markets.freeism.app`が所有する。

## 正本

- [Pointsドメイン仕様](./details-ja/points-domain.md)
- [未受領FIXと外部URL所有権](./details-ja/unclaimed-fix-and-ownership.md)
- [CSV取込](./details-ja/csv-upload.md)
- [CSV出力](./details-ja/csv-export.md)
- [評価軸管理](./details-ja/evaluation-criteria-management.md)
- [プロフィール設定](./details-ja/profile-setting.md)
- [横断アーキテクチャ](../../../../docs/web-app/v0.2/architecture.md)
- [認証仕様](../../../../docs/web-app/v0.2/authentication.md)
- [Points–Markets契約](../../../../docs/web-app/v0.2/points-markets-contract.md)
- [設計判断台帳](../../../../docs/web-app/v0.2/decision-register.md)

## v0.2の境界

- Better Auth、Hono、Drizzle、D1を使う`points-worker`と、TanStack Start/Vite PlusのSPA+SSGを同じprojectで管理する。
- GoogleとGitHubをログイン・明示linkの共通Provider集合として使う。email/password、Apple、ORCIDは実装しない。
- 評価結果はdraftを持たず、ADMINが不変FIX revisionとしてアップロードする。
- グローバルな同格ADMINだけを管理し、Group、一般member、評価軸別owner/adminを持たない。
- 負のFIXと負残高を許可するが、残高不足時の消費系操作は拒否する。
- Task、Auction、通知、PWA、画像は実装しない。
- v0.1データは移行しない。v0.1文書は実装履歴であり、v0.2の互換要件ではない。

## 実装計画

実行順、対象ファイル、テスト、release gateは`../../plan/v0.2-implementation.md`に記載する。仕様書へ手順を重複させない。

## 英語版

英語版は未作成である。空だった旧`index-en.md`は移設しない。
