# Webアプリ文書移設manifest

旧 `projects/web-app` のdocs・plan、利用者が明示した未追跡の`other.md`、リポジトリ共通docsを調査した時点の39 Markdownについて、現在の移動先と正規性を対応付けます。

## 判定区分

- **現行正本**: 現行の仕様または運用文書として参照する移設先。
- **v0.1履歴正本**: v0.1の実装観測を保存する一次資料。現行v0.2の要件ではない。
- **archive・非正規**: 情報保全のための旧案・旧モノリス資料。実装根拠にしない。
- **廃止重複**: 別の正本と同じ文章を重複保持していた範囲。正本側だけを参照する。
- **変更なし**: Webアプリ分割の対象外で、元の場所を維持するリポジトリ共通文書。

## 39 Markdown対応表

<!-- prettier-ignore -->
| Source ID | 旧パス | 現在の移動先・正本 | 区分 | 備考 |
| ---: | --- | --- | --- | --- |
| SRC-001 | `docs/CODE_OF_CONDUCT.ja.md` | [docs/CODE_OF_CONDUCT.ja.md](../CODE_OF_CONDUCT.ja.md) | 変更なし | リポジトリ全体の行動規範 |
| SRC-002 | `docs/README.ja.md` | [docs/README.ja.md](../README.ja.md) | 変更なし | リポジトリ全体の日本語README |
| SRC-003 | `projects/web-app/docs/readme/README.ja.md` | [archive/readme/README.ja.md](./archive/readme/README.ja.md) | archive・非正規 | 旧miseコマンドを含む。現行入口はPoints・MarketsそれぞれのREADME |
| SRC-004 | `projects/web-app/docs/v0.1/index.ja.md` | [archive/v0.1/index.ja.md](./archive/v0.1/index.ja.md)、[Points索引](../../projects/points-web-app/docs/v0.1/index.ja.md)、[Markets索引](../../projects/markets-web-app/docs/v0.1/index.ja.md) | archive・非正規 | 原索引を保存し、現在のナビゲーションはapp別索引へ分割 |
| SRC-005 | `projects/web-app/docs/v0.1/details/architecture.md` | [archive/v0.1/details/architecture.md](./archive/v0.1/details/architecture.md) | archive・非正規 | 旧Next.jsモノリスの構成 |
| SRC-006 | `projects/web-app/docs/v0.1/details/auction.md` | [markets v0.1 auction.md](../../projects/markets-web-app/docs/v0.1/details/auction.md) | v0.1履歴正本 | Marketsへ責務移管 |
| SRC-007 | `projects/web-app/docs/v0.1/details/auth.md` | [archive/v0.1/details/auth.md](./archive/v0.1/details/auth.md) | archive・非正規 | 旧Auth.js単一認証 |
| SRC-008 | `projects/web-app/docs/v0.1/details/contribution-evaluation-and-fix.md` | [points v0.1 contribution-evaluation-and-fix.md](../../projects/points-web-app/docs/v0.1/details/contribution-evaluation-and-fix.md) | v0.1履歴正本 | Pointsへ責務移管 |
| SRC-009 | `projects/web-app/docs/v0.1/details/csv-export.md` | [points v0.1 csv-export.md](../../projects/points-web-app/docs/v0.1/details/csv-export.md) | v0.1履歴正本 | 旧Task・Analytics CSVの一次資料 |
| SRC-010 | `projects/web-app/docs/v0.1/details/csv-upload.md` | [points v0.1 csv-upload.md](../../projects/points-web-app/docs/v0.1/details/csv-upload.md) | v0.1履歴正本 | 旧Task・評価CSVの一次資料 |
| SRC-011 | `projects/web-app/docs/v0.1/details/data-model.md` | [archive/v0.1/details/data-model.md](./archive/v0.1/details/data-model.md) | archive・非正規 | Points・Markets・通知が混在する旧ER図 |
| SRC-012 | `projects/web-app/docs/v0.1/details/group-management.md` | [points v0.1 group-management.md](../../projects/points-web-app/docs/v0.1/details/group-management.md) | v0.1履歴正本 | グループはv0.2で廃止 |
| SRC-013 | `projects/web-app/docs/v0.1/details/image-upload-cloudflare-r2.md` | [points v0.1 image-upload-cloudflare-r2.md](../../projects/points-web-app/docs/v0.1/details/image-upload-cloudflare-r2.md) | v0.1履歴正本 | 画像添付はv0.2で廃止 |
| SRC-014 | `projects/web-app/docs/v0.1/details/notification.md` | [archive/v0.1/details/notification.md](./archive/v0.1/details/notification.md) | archive・非正規 | 旧共通通知基盤。通知はv0.2で廃止 |
| SRC-015 | `projects/web-app/docs/v0.1/details/other.md` | [archive/v0.1/details/other.md](./archive/v0.1/details/other.md) | archive・非正規 | Group、Task、Auctionの旧要件が混在 |
| SRC-016 | `projects/web-app/docs/v0.1/details/overview.md` | [archive/v0.1/details/overview.md](./archive/v0.1/details/overview.md) | archive・非正規 | 旧アプリ全体の目的・方針 |
| SRC-017 | `projects/web-app/docs/v0.1/details/permission.md` | [points v0.1 permission.md](../../projects/points-web-app/docs/v0.1/details/permission.md) | v0.1履歴正本 | 主に旧Group・Task・CSV認可 |
| SRC-018 | `projects/web-app/docs/v0.1/details/response.md` | [archive/v0.1/details/response.md](./archive/v0.1/details/response.md) | archive・非正規 | 旧Server Action・Route Handler形式 |
| SRC-019 | `projects/web-app/docs/v0.1/details/review-search-and-github-conversion.md` | [markets v0.1 review-search-and-github-conversion.md](../../projects/markets-web-app/docs/v0.1/details/review-search-and-github-conversion.md) | v0.1履歴正本 | AuctionReviewが主対象。GitHub変換画面は未実装の旧記録 |
| SRC-020 | `projects/web-app/docs/v0.1/details/search-indexes-and-db-extensions.md` | [markets v0.1 search-indexes-and-db-extensions.md](../../projects/markets-web-app/docs/v0.1/details/search-indexes-and-db-extensions.md) | v0.1履歴正本 | 旧PostgreSQL・PGroongaを含む |
| SRC-021 | `projects/web-app/docs/v0.1/details/task-management.md` | [points v0.1 task-management.md](../../projects/points-web-app/docs/v0.1/details/task-management.md) | v0.1履歴正本 | Taskはv0.2で完全廃止。Auctionへの旧リンクはMarkets索引を参照 |
| SRC-022 | `projects/web-app/docs/v0.1/details/user-settings.md` | [points v0.1 user-settings.md](../../projects/points-web-app/docs/v0.1/details/user-settings.md) | v0.1履歴正本 | 旧通知設定を含む |
| SRC-023 | `projects/web-app/docs/v0.2/index-en.md` | なし | 廃止重複 | 0行の空ファイルで、移設対象となる情報なし |
| SRC-024 | `projects/web-app/docs/v0.2/index.ja.md` | [archive/v0.2/combined-design.ja.md](./archive/v0.2/combined-design.ja.md)、[横断アーキテクチャ](./v0.2/architecture.md)、[Points v0.2索引](../../projects/points-web-app/docs/v0.2/index.ja.md)、[Markets v0.2索引](../../projects/markets-web-app/docs/v0.2/index.ja.md) | archive・非正規 / 現行正本へ再構成 | 統合原文は非正規。承認済み内容だけを現行正本へ再構成 |
| SRC-025 | `projects/web-app/docs/v0.2/details-ja/auction.md` | [markets v0.2 markets-domain.md](../../projects/markets-web-app/docs/v0.2/details-ja/markets-domain.md) | 現行正本へ統合 | 商材、Auction、入札、配分、精算、落札証明をMarketsドメイン仕様へ統合 |
| SRC-026 | `projects/web-app/docs/v0.2/details-ja/auth.md` | [v0.2/authentication.md](./v0.2/authentication.md) | 現行正本 | 旧1〜2619行の固有情報を再構成。旧2624〜3485行と3545〜4465行の重複説明は統合後に廃止済み |
| SRC-027 | `projects/web-app/docs/v0.2/details-ja/cache.md` | [archive/v0.2/cache.md](./archive/v0.2/cache.md) | archive・非正規 | Next.js cache、SSE、Redisを前提とする旧案 |
| SRC-028 | `projects/web-app/docs/v0.2/details-ja/csv-export.md` | [points v0.2 csv-export.md](../../projects/points-web-app/docs/v0.2/details-ja/csv-export.md) | 現行正本 | 旧39〜65行のv0.2固有要件を再構成。旧66〜503行とv0.1の44〜481行の重複転載は廃止済み |
| SRC-029 | `projects/web-app/docs/v0.2/details-ja/csv-upload.md` | [points v0.2 csv-upload.md](../../projects/points-web-app/docs/v0.2/details-ja/csv-upload.md) | 現行正本 | FIX評価アップロードの仕様で具体化する移設先 |
| SRC-030 | `projects/web-app/docs/v0.2/details-ja/evaluation-criteria-management.md` | [points v0.2 evaluation-criteria-management.md](../../projects/points-web-app/docs/v0.2/details-ja/evaluation-criteria-management.md) | 現行正本 | 単一同格ADMIN方式へ統一する移設先 |
| SRC-031 | `projects/web-app/docs/v0.2/details-ja/naming-convention-unification.md` | [archive/v0.2/naming-convention-unification.md](./archive/v0.2/naming-convention-unification.md)、[横断migration plan](../../plan/web-app/v0.2-migration.md) | archive・非正規 / 現行planへ統合 | 旧Next.js／Prisma前提の実施順は履歴保存し、新規2appの手順はplanへ統合 |
| SRC-032 | `projects/web-app/docs/v0.2/details-ja/naming-convention.md` | [archive旧版](./archive/v0.2/naming-convention.md)、[v0.2/naming-convention.md](./v0.2/naming-convention.md) | archive・非正規 / 現行正本 | 旧Next.js／Prisma版を保存し、Hono／Drizzle／TanStack版へ再構成 |
| SRC-033 | `projects/web-app/docs/v0.2/details-ja/other.md` | [archive/v0.2/consideration-notes.md](./archive/v0.2/consideration-notes.md) | archive・非正規 | Gitの基準treeには未追跡だったが、利用者が明示したPoints、Markets、横断構成、撤回案を含む検討原文として保全 |
| SRC-034 | `projects/web-app/docs/v0.2/details-ja/profile-setting.md` | [points v0.2 profile-setting.md](../../projects/points-web-app/docs/v0.2/details-ja/profile-setting.md) | 現行正本 | プロフィール、Social Account、外部URL、公開設定、言語要件を再構成 |
| SRC-035 | `projects/web-app/docs/v0.2/details-ja/response-format.md` | [archive旧版](./archive/v0.2/response-format.md)、[v0.2/response-format.md](./v0.2/response-format.md) | archive・非正規 / 現行正本 | 旧Server Action／SSE版を保存し、Hono／RFC 9457へ再構成 |
| SRC-036 | `projects/web-app/docs/v0.3/main.md` | [points v0.3 main.md](../../projects/points-web-app/docs/v0.3/main.md) | 将来仕様 | Pointsへ移動。Substitutionとテストはv0.2へ前倒し、write APIと設定入出力は将来候補として保持 |
| SRC-037 | `projects/web-app/docs/v0.2/details-ja/migration-nextjs-to-vp-tanstack-start.md` | [初期メモarchive](../../plan/web-app/archive/migration-nextjs-to-vp-tanstack-start.md)、[横断migration plan](../../plan/web-app/v0.2-migration.md) | archive・非正規 / 現行planへ統合 | 3行の初期メモを履歴保存し、実行手順を横断planへ具体化 |
| SRC-038 | `projects/web-app/docs/v0.2/details-ja/prototype-scraping-site-account.md` | [初期メモarchive](../../projects/points-web-app/plan/archive/prototype-scraping-site-account.md)、[Points実装plan](../../projects/points-web-app/plan/v0.2-implementation.md) | archive・非正規 / 現行planへ統合 | 見出しだけの初期メモを、Web URL所有権・未受領FIXの仕様とPoints planへ統合 |
| SRC-039 | `README.md` | [README.md](../../README.md) | 変更なし | monorepo全体の入口。Webアプリ分割後の導線だけを更新し、他projectの説明を保持 |

## 重複とarchiveの扱い

- `docs/web-app/archive/**` の内容は、正本へ昇格させない限り実装要件ではありません。
- 旧 `auth.md` の後半2案は、前半と同じToken保存・Refresh・BFF構成を説明する重複だったため、固有情報だけを現行認証正本へ統合して削除しました。
- 旧v0.2 CSV出力に転載されていたv0.1本文は削除し、v0.1履歴正本への参照へ置き換えました。
- v0.1資料の本文中に残る旧相対リンクや `projects/web-app/...` は履歴上の文字列です。現在の配置は本manifestの移動先を正とします。
