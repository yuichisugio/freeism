# Accounts v0.1 主仕様レビュー

- [Accounts v0.1 主仕様レビュー](#accounts-v01-主仕様レビュー)
  - [1. 概要](#1-概要)
  - [2. レビューの進め方](#2-レビューの進め方)
  - [3. 要修正](#3-要修正)
    - [M01 公開鍵を更新する標準APIが無く登録時の必須項目にも公開鍵が無い](#m01-公開鍵を更新する標準apiが無く登録時の必須項目にも公開鍵が無い)
    - [M02 JWKS URIはtrusted originに限られ第三者の開発者が使えない](#m02-jwks-uriはtrusted-originに限られ第三者の開発者が使えない)
    - [M03 webクライアントはloopbackのredirect URIを登録できない](#m03-webクライアントはloopbackのredirect-uriを登録できない)
    - [M04 新規ユーザーの初期表示名が2箇所で食い違う](#m04-新規ユーザーの初期表示名が2箇所で食い違う)
    - [M05 Points側文書がClient Secretを前提にしている](#m05-points側文書がclient-secretを前提にしている)
    - [M07 既存のOAuth同意があると同意画面が省かれる](#m07-既存のoauth同意があると同意画面が省かれる)
    - [M11 保存ボタンを非活性にする条件に証明済みの限定が無い](#m11-保存ボタンを非活性にする条件に証明済みの限定が無い)
    - [M13 解除と退会が標準のfresh session要件に掛かる](#m13-解除と退会が標準のfresh-session要件に掛かる)
    - [M14 独自表の外部キーに削除時動作が無い](#m14-独自表の外部キーに削除時動作が無い)
    - [M16 設定表にtrustedProvidersが無くORCIDを追加連携できない](#m16-設定表にtrustedprovidersが無くorcidを追加連携できない)
    - [M17 AdminプラグインとappAdminの権限が未定義](#m17-adminプラグインとappadminの権限が未定義)
    - [M23 認証APIのレート制限がWorkersで既定では無効になりうる](#m23-認証apiのレート制限がworkersで既定では無効になりうる)
    - [M25 受け入れ条件に退会が無い](#m25-受け入れ条件に退会が無い)
    - [M29 v0.2文書がv0.1に設計要件と完了条件を課している](#m29-v02文書がv01に設計要件と完了条件を課している)
    - [M30 実装計画の設定値の参照先アンカーの誤り](#m30-実装計画の設定値の参照先アンカーの誤り)
  - [4. 記載追加が望ましい](#4-記載追加が望ましい)
  - [5. 懸念のみ](#5-懸念のみ)
  - [6. 付記](#6-付記)
  - [7. 統合指摘の全一覧](#7-統合指摘の全一覧)
  - [8. トリアージで区分を変えた指摘と理由](#8-トリアージで区分を変えた指摘と理由)

## 1. 概要

| 項目 | 内容 |
| --- | --- |
| 対象文書 | [main.ja.md](../specification/v0.1/main.ja.md)（Accounts v0.1主仕様、944行） |
| 関連文書 | [verify-url.ja.md](../specification/v0.1/verify-url.ja.md)（URL登録・検証仕様、227行）、[v0.1.md](../implementation-plan/v0.1.md)（v0.1実装計画、182行）、[implementation-plan/v0.2.md](../implementation-plan/v0.2.md)、[specification/v0.2/main.ja.md](../specification/v0.2/main.ja.md)、[specification/v0.3/main.ja.md](../specification/v0.3/main.ja.md)、[上位目標のmain.ja.md](../specification/main.ja.md)、Points 側の [profile-setting.md](../../../points-web-app/docs/v0.2/details-ja/profile-setting.md) などのリンク先 |
| レビュー日 | 2026-09-24 |
| 対象の状態 | accounts-web-app の `src` は空で、実装は未着手である。本レビューは仕様（計画）のレビューである |
| 前回レビューとの関係 | [verify-url-v0.1-review.ja.md](verify-url-v0.1-review.ja.md)（以下「前回レビュー」）で扱った指摘は再掲しない。関係する箇所では R番号で参照する |

結論の要約:

- **要修正 15件**（M01、M02、M03、M04、M05、M07、M11、M13、M14、M16、M17、M23、M25、M29、M30）。
  - 仕様・実装計画を変えないと実装に進めないもの、または現実の利用フローで実害が出るものである。
  - うち1件（M05）は、修正先が Points 側の文書である。
  - うち5件（M01、M03、M07、M17、M29）には仕様作成者の判断事項がある。
  - 通常の利用フローで必ず通る経路に関わるのは、M07（再連携で同意画面が出ない）、M13（2日目以降の解除・退会が拒否される）、M14（解除・退会が外部キーで失敗しうる）、M16（ORCID を追加連携できない）である。
  - M04 は、本人が設定する前に Provider の実名が公開プロフィールに出うるという、プライバシーに関わる食い違いである。
- **記載追加が望ましい 46件**（統合ID単位）。
  - 実装者が妥当に判断できるが、仕様や実装計画に1〜2文あると実装・案内がぶれないものである。
- **懸念のみ 25件**（統合ID単位）と、確認のみで懸念なし 7件。
  - ほかに、記載追加の統合指摘に含まれる懸念のみの副論点が1件ある（B2-08）。
- **付記 2件**（M31、M06）。
  - M31 は v0.1 の対象外の文書の不備である。
  - M06 は前回レビューの付記に既出で、今回は範囲を広げて記録する。
- 統合IDは M01〜M96 で、M55 は欠番である（計95件）。

凡例:

- 行番号は 2026-09-24 時点（HEAD `25abca37`）の各ファイルの行である。
- `main.ja.md` は [specification/v0.1/main.ja.md](../specification/v0.1/main.ja.md)、`verify-url.ja.md` は [specification/v0.1/verify-url.ja.md](../specification/v0.1/verify-url.ja.md)、`v0.1.md` は [implementation-plan/v0.1.md](../implementation-plan/v0.1.md) を指す。
- `implementation-plan/v0.2.md` は [implementation-plan/v0.2.md](../implementation-plan/v0.2.md)、`v0.2/main.ja.md` は [specification/v0.2/main.ja.md](../specification/v0.2/main.ja.md)、`v0.3/main.ja.md` は [specification/v0.3/main.ja.md](../specification/v0.3/main.ja.md) を指す。
- Points 側の文書は、`profile-setting.md`・`unclaimed-fix-and-ownership.md`・`evaluation-criteria-management.md`（いずれも points-web-app の `docs/v0.2/details-ja/`）と、`v0.2-implementation.md`（points-web-app の `plan/`）と書く。
- Better Auth のコードは、npm から取得した 1.7.5 の配布物の行番号で書く。略号は次のとおりである。
  - OP: `@better-auth/oauth-provider@1.7.5` の `dist/authorize-riRRCSbC.mjs`
  - OP-introspect: 同パッケージの `dist/introspect-njKASm3q.mjs`
  - BA: `better-auth@1.7.5` の `dist/` からの相対パス
  - core: `@better-auth/core@1.7.5` の `dist/` からの相対パス
  - drizzle-adapter: `@better-auth/drizzle-adapter@1.7.5` の `dist/index.mjs`
  - rc.1: リポジトリの `node_modules` にある 1.7.0-rc.1（移行元の Points が使う版）
- 「公式文書」は Better Auth の Markdown 版（`https://better-auth.com/llms.txt/docs/{path}.md`）で、行番号はその取得物の行である。
- 「観察された事実」は文書・コードを開くか、コマンドを実行して確かめた内容である。
- 「疑われる問題」は、そこから導いた推測である。
- 「元ID」は8本の調査報告の指摘ID（A1〜D2）、「統合ID」（M01〜M96）はレビュー担当が重複を統合して付けたIDである。

## 2. レビューの進め方

### 2.1 体制と役割

| 役割 | 人数 | 担当 | モデル |
| --- | --- | --- | --- |
| 調査 | 観点A〜Dに各2名（計8名） | 観点ごとに独立して仕様を読み、指摘を報告した（元ID A1〜D2） | Opus 5.5 |
| レビュー | 1名 | 8本の報告の全指摘を統合し（M01〜M96）、行単位で引用と成立を確認した | Opus 5.5 |
| 検証 | 1名 | レビューの網羅性、引用、Better Auth のコード、外部事実、区分の判断を再確認した | Opus 5.5 |
| 管理 | 1名 | 敵対的レビューを行い、最終区分をトリアージで確定した | Fable 5.1 |
| 執筆 | 1名 | 本書を作成し、行番号参照を実ファイルと突き合わせた | Opus 5.5 |

観点は次のとおりである。

| 観点 | 範囲 |
| --- | --- |
| A | OAuthクライアント・クライアント認証・Accounts API契約 |
| B | 所有権・紐付け・解除・退会・公開設定・管理画面の状態遷移と利用フロー |
| C | テーブル構造、JSONバックアップ・復元・移行 |
| D | 提供・技術要件（Better Auth 1.7 の設定・プラグイン）と、文書全体の整合・受け入れ条件・実装計画 |

### 2.2 手順

1. 観点A〜Dの調査担当が、それぞれ2名ずつ独立に仕様を読み、指摘を報告した。
   - 各指摘には、観察された事実、疑われる問題、発生条件と影響、他の箇所で扱われていないかの確認結果、根拠の強さ、修正要否の提案を書いた。
2. レビュー担当が、8本の報告の指摘139件を95件の統合指摘（M01〜M96、M55は欠番）へまとめた。
   - 報告者が要修正とした指摘42件は、全件を行単位で確認した。
   - Better Auth の挙動は、報告者の展開物を使わず、npm から 1.7.5 を取得し直して確認した。
3. 検証担当が、レビューを独立に再確認した。
   - 139件の元IDがすべて統合指摘に対応付いていることを機械照合で確認した。
   - 報告者区分の転記に不一致が無いことを確認した。
   - 要修正の根拠となる Better Auth の行を、1.7.5 の配布コードで記録し直した（本書の行番号はこの記録を正とする）。
   - レビューの誤り・不足を14件指摘した（下記）。
4. 管理エージェントが敵対的レビューとトリアージを行い、最終区分を確定した。
   - 本書の区分はこのトリアージを正とする。
   - 区分を変えた指摘は、[8章](#8-トリアージで区分を変えた指摘と理由)にまとめた。

検証担当とトリアージの指摘により、本書では次の点を訂正した内容で書いている。

- M07 の修正案は、レビュー担当の推奨（試行ごとの referenceId）から、`prompt=consent` の契約と、同意OFF保存時の `oauthConsent` 削除の組み合わせに改めた（[M07](#m07-既存のoauth同意があると同意画面が省かれる)、[8章](#8-トリアージで区分を変えた指摘と理由)）。
- M02 について、`trustedOrigins` は関数でも指定できる（BA `context/helpers.mjs`:76-81）。ただし第三者の origin を加えると CSRF の検査などの信頼範囲も広がるため、結論は変わらない。
- M23 の `NODE_ENV` は、モジュールの読み込み時に1回だけ読まれる（core `env/env-impl.mjs`:30-32）。Worker の変数として `NODE_ENV` を設定すれば有効になるので、「既定で無効」は「変数を設定しない限り無効」という条件付きである。
- M21 は、TTL が未定義であることそのものが論点であり、公開の取り消しがキャッシュに残るプライバシー上の影響を明記した。
- M08 は、「同意ONで保存した後に拒否すると提供許可が残る」点を加えた。
- M22 は、レビュー担当が示した経路（前回の R01 に依存する経路）を、本人の二重登録による経路に差し替えた。C1-02 の前提（OAuth だけの解除）は、[main.ja.md:876](../specification/v0.1/main.ja.md) がデータ層で想定しており、根拠の無い仮定ではない。
- M06 について、「`plan/` 配下はどの報告にも無い」は誤りで、A2-06 が `v0.2-implementation.md`:13 に触れている。`docs/readme/README.ja.md`:13 は前回付記の11箇所に含まれる。
- M31 は、レビュー担当が要修正に数えていたが、v0.1 の対象外のため付記に移した。
- M01 の endpoint の範囲は、OP の 2505〜5063行である（レビュー担当の「2943行まで」は不完全）。結論は変わらない。
- 調査報告 A-1 の Better Auth の行番号には、1.7.5 と rc.1 の行番号が混在していた。本書では 1.7.5 の行番号（検証担当の記録）を使う。
- 元IDごとの判定と統合後の区分がずれていた A1-19・D1-16（M37）、A1-20（M45）、A2-21（M33）、C2-11（M38）は、統合後の区分に揃えた。

### 2.3 証拠の所在（実行した外部確認）

各担当が実行した外部確認の要点を示す。
作業ファイルは、セッションの作業用ディレクトリ（scratchpad の `rv/`、`ba-src/`、`d2/`）に置いた。

| 手段 | 確認した内容 | 結果（観察） |
| --- | --- | --- |
| npm | `npm view better-auth dist-tags` | `latest` は 1.7.5 だった |
| npm | `npm pack` で `better-auth`・`@better-auth/core`・`@better-auth/oauth-provider`・`@better-auth/drizzle-adapter` の 1.7.5 を取得 | レビュー担当と調査担当の tgz の SHA-1 が一致し、registry の `dist.shasum` とも一致した（better-auth `1a72ca5f…`、oauth-provider `af806603…`、core `a1b89ae2…`） |
| コード確認 | 1.7.0-rc.1（リポジトリの `node_modules`） | M01・M07・M13・M16・M23 に関わる分岐が rc.1 にもあることを確認した（例: rc.1 `index.mjs`:4390 の同意画面の省略、`create-context.mjs`:159 の `freshAge` 既定1日） |
| 公式文書 | Better Auth の `plugins/oauth-provider`・`plugins/jwt`・`plugins/open-api`・`plugins/admin`・`concepts/rate-limit`・`concepts/session-management`・`concepts/users-accounts`・`reference/options`・`concepts/database` | すべて HTTP 200 で取得した。本書の「公式文書 N行」はこの取得物の行である |
| 公式文書 | [D1 の外部キー](https://developers.cloudflare.com/d1/sql-api/foreign-keys/) | 23行に「By default, D1 enforces that foreign key constraints are valid within all queries and migrations」とある（検証担当が取得） |
| 公式文書 | [Workers Cache の purge](https://developers.cloudflare.com/workers/cache/purge/)・[Purge cache](https://developers.cloudflare.com/cache/how-to/purge-cache/) | Workers Cache は常に Free 枠の制限を使う。Free 枠の tag・prefix の purge は 5 requests per minute、bucket 25。URL単位の purge は無く、単一の URL も path prefix で消す |
| 公式文書 | [Workers の process](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/) | `process.env` は既定で空である。`nodejs_compat_populate_process_env`（互換日付 2025-04-01 以降は既定で有効）の下では、設定した環境変数・secret が入る |
| 公式文書 | [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)、[D1 `batch()`](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)、[D1 の JSON 関数](https://developers.cloudflare.com/d1/sql-api/query-json/) | 1クエリ100バインド変数、1呼出しのクエリ数は Paid 1,000・Free 50。`batch()` は SQL トランザクション。`json_each(?)` に配列を1つのバインド値で渡す例がある（調査担当の取得。レビュー担当は再取得していない） |
| 公式文書 | [ORCID の OIDC discovery](https://orcid.org/.well-known/openid-configuration)、ORCID-Source の OIDC・revoke の文書 | `claims_supported` に email が無い。token endpoint の認証方式は `client_secret_post` だけ。失効は `POST https://orcid.org/oauth/revoke`（調査担当の取得） |
| grep | Points の `docs`・`plan` | `specification/v0.1/main.md` へのリンクが docs 配下11件、plan 配下5件。`Client Secret` は `profile-setting.md`:55・154 と `v0.2-implementation.md`:486 の3件 |
| grep | [v0.1.md](../implementation-plan/v0.1.md) | 「失効」「revoke」は0件 |
| コード確認 | 移行元 points-web-app | `auth-options.ts`:64 は `trustedProviders` を指定し、79-89行は `rateLimit.enabled: true` と `ipAddressHeaders: ["cf-connecting-ip"]` を指定する。`points-oauth-provider.ts`:93-118 は連携の試行ごとに `consentReferenceId` を変える。`create-auth.ts` は account の hook と session 作成時の補修で独自表を作る |
| スクリプト | [main.ja.md](../specification/v0.1/main.ja.md) の目次・リンク | 目次40項目と見出し40個が一致した。相対・文書内リンク112件はすべて実在した |

### 2.4 Better Auth 1.7.5 の確認箇所

要修正の根拠となった箇所を示す。
行番号は検証担当が 1.7.5 の配布コードで記録したものである。

| 統合ID | 1.7.5 の該当箇所 | 結果 | rc.1 |
| --- | --- | --- | --- |
| M01 | OP:2866-2902・2903-2931（`update` の schema に `jwks` が無い）、OP:2385（`updateClientEndpoint`）、OP:1866-1869（`private_key_jwt` は鍵が必須）、endpoint の全件は OP:2505〜5063 | 成立 | `index.mjs`:1765・1806 にも無い |
| M02 | OP:1850-1856（登録時）、OP:1236-1259（取得時。1255-1258）、公式文書 `plugins/oauth-provider` 1054行、BA `context/helpers.mjs`:76-81（関数でも指定できる） | 成立 | `index.mjs`:974 |
| M03 | OP:1699-1701（web の拒否）、OP:1708-1710（native の HTTP loopback）、OP:1757・1778（既定は web）、OP:5386（`stripLoopbackRedirectPort`）、OP:5427-5446（port を除いた比較） | 成立 | 未比較 |
| M07 | OP:5547-5548（prompt の解析）、OP:5645（`prompt=consent`）、OP:5646-5650（referenceId）、OP:5651（skipConsent）、OP:5660-5676（既存同意の検索）、OP:5677-5685（不足時は同意画面へ）、OP:5686-5694（コードの発行）、OP:26-133（`consentEndpoint`。55-58 は拒否、101-118 は作成・更新、127 は consent を除いて再実行）、OP:3078（`/oauth2/delete-consent`）、公式文書 871行 | 成立 | `index.mjs`:4390 |
| M13 | BA `api/routes/account.mjs`:260-282（263行の `use`）、BA `api/routes/session.mjs`:331-342、BA `context/create-context.mjs`:149、BA `api/routes/update-user.mjs`:292-295・335-339、公式文書 `concepts/session-management` 73行 | 成立（既定1日。基準は `createdAt`） | `create-context.mjs`:159 |
| M14 | BA `db/internal-adapter.mjs`:232-245、BA `api/routes/account.mjs`:280、drizzle-adapter:557、BA `db/get-migration.mjs`:617・645、core `db/get-tables.mjs`:139・217 | 成立 | — |
| M16 | BA `api/routes/callback.mjs`:173-176、BA `api/routes/account.mjs`:207、BA `context/helpers.mjs`:152-156、BA `plugins/generic-oauth/index.mjs`:56・229-235 | 成立 | `callback.mjs`:155、`account.mjs`:153 |
| M17 | BA `plugins/admin/access/statement.mjs`（既定の admin ロール）、BA `plugins/admin/routes.mjs`:753-781 | 成立 | — |
| M23 | BA `context/create-context.mjs`:172、core `env/env-impl.mjs`:3・30-32、core `utils/ip.mjs`:174-195、BA `api/rate-limiter/index.mjs`:239-244 | 条件付きで成立（`NODE_ENV` を変数として設定しない場合） | `create-context.mjs`:182 |
| M27 | core `oauth2/oauth-provider.d.mts`:195（型だけ。`.mjs` に0件） | 成立 | — |

### 2.5 未確認の事項

次の事項は、レビュー担当・検証担当とも確認していない。
本書では、これらに依拠する記述に「未確認」または「報告者の記録に依拠」と書く。

- Workers 上の実機での動作（レート制限の有効・無効、purge の成否、Cache の入口別の挙動）。
- Workers が受け取る要求に `X-Forwarded-For` が付くか（M23）。
- `auth` CLI による Drizzle schema の生成で、外部キーの `onDelete` の既定が何になるか（M14）。
  - 調査担当 C-1 は、rc.1 の `auth/dist/api.mjs`:158 で「指定が無ければ `cascade` を出力する」と記録した。1.7.5 では再確認していない。
- D1 の `batch()` 内の各文が、「1呼出しのクエリ数」の上限に1件ずつ数えられるか（M45・M77）。
- Workers Cache の purge が、Free 枠のどの区分（tag・prefix）で数えられるか（M21。公式文書から推測した）。
- ORCID が PKCE の `code_challenge` を受け付けるか（M37）。
- Google・GitHub の token 失効 endpoint の公式な仕様（M27。調査担当 D-1 は未確認とした）。
- Better Auth 1.7.0〜1.7.2 の `account.issuer` 列（M86。移行ガイドの記録に依拠）。

## 3. 要修正

要修正は15件である。
各項目は、観察された事実、Better Auth の確認箇所、疑われる問題、発生する操作、影響、他の箇所の確認結果、最小修正案の順に書く。
判断事項があるものは、最後にその内容を書く。

### M01 公開鍵を更新する標準APIが無く登録時の必須項目にも公開鍵が無い

- 元ID: A1-01（要修正）、A2-04（要修正・軽微）
- 根拠の強さ: 強
- 仕様作成者の判断事項: **あり**（鍵の更新方法）

**観察された事実**

- [main.ja.md:168](../specification/v0.1/main.ja.md)「開発者向け画面で公開鍵を登録・更新できる。鍵の検査・クライアント認証にはBetter Auth標準の機能を使う」
- [main.ja.md:589](../specification/v0.1/main.ja.md) は、公開鍵の変更もアプリ名などと同じ1つの「保存」ボタンでまとめて反映するとする。
- [main.ja.md:910](../specification/v0.1/main.ja.md) は、標準で実現できない認証拡張を、理由・追加内容・代替案を示して承認を得てから実装するとする。
- [main.ja.md:159](../specification/v0.1/main.ja.md) は必須入力を「アプリ名とリダイレクトURL」とし、[main.ja.md:163](../specification/v0.1/main.ja.md) は画面とバックエンドで必須項目を検査するとする。
- [main.ja.md:165](../specification/v0.1/main.ja.md) は、`private_key_jwt` 用の公開鍵を登録するとする。

**Better Auth 1.7.5 の確認箇所**

- OP:2866-2902（`/admin/oauth2/update-client`）と OP:2903-2931（`/oauth2/update-client`）の `update` の schema に、`jwks`・`jwks_uri` が無い。
  - `z.object` は未定義のキーを取り除くので、送っても反映されず、エラーにもならない。
- OP の endpoint（OP:2505〜5063 の28件）を列挙しても、鍵を更新する endpoint は無い。`/oauth2/register` は作成だけを行う。
- OP:1866-1869 は、`private_key_jwt` で `jwks`・`jwks_uri` のどちらも無い登録を拒否する（`private_key_jwt requires either jwks or jwks_uri`）。
- rc.1 の `index.mjs`:1765・1806 の `update` の schema にも `jwks` は無い。

**疑われる問題（推測）**

- 鍵の更新は、`oauthClient.jwks` を Accounts が独自に DB 更新する実装になる。これは [main.ja.md:168](../specification/v0.1/main.ja.md) の「標準の機能を使う」と合わず、[main.ja.md:910](../specification/v0.1/main.ja.md) の承認対象にあたる。
- [main.ja.md:589](../specification/v0.1/main.ja.md) の1つの保存ボタンは、標準の update と独自の DB 更新の2系統への書込になり、一方だけが成功した状態が生じうる（A1-01）。
- 必須項目（[main.ja.md:159](../specification/v0.1/main.ja.md)）と標準の登録条件が合わず、アプリ名とリダイレクトURLだけで登録するとバックエンドで拒否される。

**発生する操作**

- 開発者が「開発者向け」画面で、公開鍵を入れずにクライアントを登録する操作。
- 利用側の運営者が、秘密鍵の更新や漏えいへの対応で公開鍵を差し替える操作。

**影響（推測）**: 開発者向け画面の鍵管理に実装者が着手できない。標準の update API に鍵を渡す実装にすると、鍵が変わらないまま成功したように見える。

**他の箇所で扱われていないことの確認結果**

- [v0.1.md:116](../implementation-plan/v0.1.md) は「公開鍵の登録・更新をAPIへ接続する」とだけ書き、方法の記載は無い。
- [v0.1.md:12](../implementation-plan/v0.1.md) は承認制の一般則だけである。
- 前回レビューに該当の指摘は無い。

**最小修正案**

- 必須: [main.ja.md:159](../specification/v0.1/main.ja.md) の必須入力に公開鍵（JWKS）を加える。
- 鍵の更新は、判断事項に応じて次のどちらかにする。
  - 案A: [main.ja.md:910](../specification/v0.1/main.ja.md) の手続きに従い、「公開鍵の更新は `oauthClient.jwks` を Accounts の保存処理で更新する独自拡張とし、検査は標準の JWKS 検査と同等の条件にする」と明記して承認を得る。[main.ja.md:589](../specification/v0.1/main.ja.md) に、標準の update と独自更新の順序と失敗時の扱いを1文加える。
  - 案B: v0.1 は登録時だけ公開鍵を受け付け、鍵の差し替えはクライアントの再登録で行う。[main.ja.md:168・589](../specification/v0.1/main.ja.md) を登録時の記述に改める。
- 修正箇所: [main.ja.md:159・168・589](../specification/v0.1/main.ja.md)、[v0.1.md:116](../implementation-plan/v0.1.md)。

**仕様作成者の判断事項**

- 独自の DB 更新を承認するか、v0.1 は登録時のみとするか。
- 案Bでは Client ID が変わる。このため、Client ID をキーとする本人の同意・公開選択（`client_consents`・`external_account_visibility`）と、Points の接続設定を作り直すことになる（推測）。

### M02 JWKS URIはtrusted originに限られ第三者の開発者が使えない

- 元ID: A1-02（要修正）、A2-02（要修正・軽微）
- 根拠の強さ: 強
- 仕様作成者の判断事項: なし

**観察された事実**

- [main.ja.md:158](../specification/v0.1/main.ja.md) は、外部サービスの開発者が自分でクライアントを登録できるとする。
- [main.ja.md:165](../specification/v0.1/main.ja.md) は「`private_key_jwt`用の公開鍵をJWKSまたはJWKS URIで登録する」とする。

**Better Auth 1.7.5 の確認箇所**

- OP:1850-1856 は、登録時に `isTrustedOrigin` を満たさない `jwks_uri` を拒否する（`jwks_uri must belong to a trusted origin or the Client ID Metadata Document origin`）。
- OP:1236-1259 の `validateJwksUri`（1255-1258行）は、鍵の取得時にも同じ条件を確認する。
- 公式文書 `plugins/oauth-provider` 1054行に「requires `https` unconditionally and a trusted origin」とある。
- `trustedOrigins` は、要求ごとに値を返す関数でも指定できる（BA `context/helpers.mjs`:76-81）。

**疑われる問題（推測）**

- 第三者の開発者の origin は Accounts の `trustedOrigins` に無いので、JWKS URI での登録は標準では失敗する。
- `trustedOrigins` を関数にして開発者の origin を加えることはできる。しかし `trustedOrigins` は CSRF の検査や `callbackURL` の許可にも使われるため、Accounts 自身の信頼範囲まで広がる。この回避策は採るべきではない。

**発生する操作**: 開発者が「JWKS URI」を選んでクライアントを登録する操作。

**影響（推測）**: 登録が必ず失敗する。回避しようとすると、セキュリティの境界が崩れる。

**他の箇所で扱われていないことの確認結果**: [main.ja.md:160・545](../specification/v0.1/main.ja.md)、[v0.1.md:113・116](../implementation-plan/v0.1.md) を確認した。`trustedOrigins` との関係の記載は無い。

**最小修正案**: [main.ja.md:165](../specification/v0.1/main.ja.md) を「`private_key_jwt`用の公開鍵をJWK Set（インラインのJWKS）で登録する」に改める。

### M03 webクライアントはloopbackのredirect URIを登録できない

- 元ID: A1-03（要修正）
- 根拠の強さ: 強
- 仕様作成者の判断事項: **あり**（ローカル開発の扱い）

**観察された事実**

- [main.ja.md:162](../specification/v0.1/main.ja.md)「ホストが`localhost`またはループバックIPアドレスの場合は、ローカル開発用としてHTTPも許可する。ローカルのURLも、ポートとパスを含む登録済みURLとの完全一致を確認する」
- [main.ja.md:156](../specification/v0.1/main.ja.md) は、v0.1 の連携対象をバックエンドを持つWebサービスとする。
- [main.ja.md:797](../specification/v0.1/main.ja.md) の受け入れ条件に「redirect URI」がある。

**Better Auth 1.7.5 の確認箇所**

- OP:1699-1701: `application_type` が `web` の場合、HTTPS 以外、または loopback（HTTP・HTTPS とも）を拒否する（`web clients require https redirect URIs on non-loopback hosts`）。
- OP:1757・1778: `application_type` を省略すると `web` になる。
- OP:1708-1710: `native` で HTTP を使えるのは `localhost`・`127.0.0.1`・`[::1]` だけである。
- OP:5427-5446 の `findRegisteredRedirectUri` は、OP:5386 の `stripLoopbackRedirectPort` を使い、loopback の HTTP では port を除いて比較する（RFC 8252 §7.3 の方式）。

**疑われる問題（推測）**

- v0.1 の対象である web クライアントに、localhost の redirect URI を登録できない。
- 仕様の「ループバックIPアドレス」は `127.0.0.2` などを含みうるが、標準が許すのは3種類だけである。
- 仕様の「ポートを含む完全一致」は、標準の port を除いた一致と逆である。
- 仕様どおりに実装するには redirect URI の検査・一致判定を独自に作ることになり、[main.ja.md:910](../specification/v0.1/main.ja.md) の承認対象にあたる。

**発生する操作**: 開発者がローカル開発用の callback（例: `http://localhost:3000/...`）を登録する操作。

**影響（推測）**: 標準のままでは、登録が拒否されるか、`native` で登録した場合は port の違う URL も一致として通る。どちらも [main.ja.md:162](../specification/v0.1/main.ja.md) と食い違う。

**他の箇所で扱われていないことの確認結果**: [main.ja.md:161・797](../specification/v0.1/main.ja.md)、[v0.1.md:88](../implementation-plan/v0.1.md) を確認した。[v0.1.md:88](../implementation-plan/v0.1.md) の OAuth Proxy は Accounts が外部 Provider へ出る場合の話で、この論点とは別である。

**最小修正案**: [main.ja.md:162](../specification/v0.1/main.ja.md) を標準の挙動に合わせ、次のどちらかにする。

- 案A:「ローカル開発用の `http://localhost`・`127.0.0.1`・`[::1]` は、`application_type: native` のクライアントとして登録する。loopback の HTTP は RFC 8252 に従い port を除いて一致を確認する」
- 案B:「リダイレクトURLは HTTPS とする。ローカル開発では HTTPS の Preview 環境を使う」

**仕様作成者の判断事項**: ローカル開発用に `native` 種別での登録を認めるか、HTTPS に限るか。

### M04 新規ユーザーの初期表示名が2箇所で食い違う

- 元ID: A1-04、B1-08、D1-06（要修正）、C1-13（記載追加）
- 根拠の強さ: 中〜強
- 仕様作成者の判断事項: なし

**観察された事実**

- [main.ja.md:118](../specification/v0.1/main.ja.md)「ユーザー作成時のAccounts表示名は仮の名前「ユーザー」とする」
- [main.ja.md:833](../specification/v0.1/main.ja.md)「新規ユーザーの表示名はProviderの標準マッピングなどを使って初期値を設定し」
- [v0.1.md:112](../implementation-plan/v0.1.md) は「仮の表示名で利用を開始できる」と「標準のProviderマッピングなどで初期値を設定する」を続けて書く。
- [main.ja.md:909](../specification/v0.1/main.ja.md) により、表示名は公開プロフィールで匿名の閲覧者へ返る。
- [main.ja.md:793](../specification/v0.1/main.ja.md) の受け入れ条件に「共通ログインフローと仮の表示名」がある。

**Better Auth 1.7.5 の確認箇所**: 標準のマッピングは、GitHub が `profile.name || profile.login || ""`（core `social-providers/github.mjs`:80）、Google が `user.name`（core `social-providers/google.mjs`:127）である。

**疑われる問題（推測）**

- [main.ja.md:833](../specification/v0.1/main.ja.md) をそのまま読んで実装すると、Provider の氏名が初期表示名になり、本人が設定する前に公開プロフィールへ出る。
- [v0.1.md:112](../implementation-plan/v0.1.md) の並びからは「マッピングの仕組みで仮名を入れる」という意図とも読める。文言として、矛盾とも曖昧さとも読める。

**発生する操作**: 初めての外部アカウントでログインし、ユーザーが作られる操作（すべての新規登録）。

**影響（推測）**: 本人の同意なく実名が公開されうる。

**他の箇所で扱われていないことの確認結果**

- [main.ja.md:532-533](../specification/v0.1/main.ja.md) は外部アカウント側の表示名で、Accounts の表示名とは別である。
- [main.ja.md:919](../specification/v0.1/main.ja.md) の `updateUserInfoOnLink: false` は連携時の上書きを防ぐだけで、作成時には効かない。

**最小修正案**: [main.ja.md:833](../specification/v0.1/main.ja.md) と [v0.1.md:112](../implementation-plan/v0.1.md) を「各Providerの`mapProfileToUser`などで、新規ユーザーの表示名を「ユーザー」にする。Providerの名前は外部アカウントの表示名として保存する」に揃える。

### M05 Points側文書がClient Secretを前提にしている

- 元ID: A1-05、A2-05、B2-06、D2-13（要修正）、B1 の付記
- 根拠の強さ: 強
- 修正先: **Points 側の文書**
- 仕様作成者の判断事項: なし

**観察された事実**

- [profile-setting.md:55](../../../points-web-app/docs/v0.2/details-ja/profile-setting.md)「その接続先に登録したOAuthクライアントのClient ID・Client Secretを設定する。Client SecretはPointsのバックエンドで管理する」
- [profile-setting.md:154](../../../points-web-app/docs/v0.2/details-ja/profile-setting.md)（必須テスト）は「Client Secretをバックエンドで管理したまま」とする。
- [v0.2-implementation.md:486](../../../points-web-app/plan/v0.2-implementation.md) は「Client Secretのバックエンド管理を確認する」とする。
- 一方、[main.ja.md:165・240・545](../specification/v0.1/main.ja.md) は、`private_key_jwt` と DPoP を採用し、秘密鍵を利用側のバックエンドで保管するとする。
- [main.ja.md:66](../specification/v0.1/main.ja.md) は、Points との連携の正本として `profile-setting.md` の「3. Accountsとの情報連携」へリンクしている。
- Points の `docs`・`plan` で `Client Secret` を grep すると、上記の3箇所だけだった。`private_key_jwt`・DPoP の記述は Points 側に無い。

**疑われる問題（推測）**: Points の実装者が、Accounts が発行しない Client Secret の設定欄を作る。`private_key_jwt` の秘密鍵と DPoP の鍵の管理が、Points 側の要件から漏れる。

**発生する操作**: Points の運営者が接続先を設定する操作と、初回連携のコード交換・Client Credentials でのトークン取得。

**影響（推測）**: Points が Client Secret で実装すると、Accounts のトークンエンドポイントで認証できない。調査担当 A-1 は、公式文書に「A confidential client must use its registered `token_endpoint_auth_method`」とあることを記録している（報告者の記録に依拠）。

**他の箇所で扱われていないことの確認結果**: 前回レビューの付記は、Points 側のリンク切れと「編集可能Webページ」の文言だけを扱っている。Client Secret の論点は新規である。

**最小修正案**

- [profile-setting.md:55・154](../../../points-web-app/docs/v0.2/details-ja/profile-setting.md) を「Client IDと、`private_key_jwt`用の秘密鍵・DPoP用の鍵をPointsのバックエンドで管理し、公開鍵をAccountsへ登録する」に改める。
- [v0.2-implementation.md:486](../../../points-web-app/plan/v0.2-implementation.md) の確認項目を、秘密鍵・DPoP 鍵のバックエンド管理の確認に改める。

付随する訂正: B2-06 は「`v0.2-implementation.md` に該当の記述は無い」と書いたが、実際には486行にある。A2-05 の記載が正しい。

### M07 既存のOAuth同意があると同意画面が省かれる

- 元ID: A2-01、B2-02（要修正）
- 根拠の強さ: 強（1.7.5 と rc.1 の両方で分岐を確認した）
- 仕様作成者の判断事項: **あり**（修正方式）

**観察された事実**

- [main.ja.md:84](../specification/v0.1/main.ja.md) は、利用側サービスから開始した連携では「アカウント連携」画面を同意画面として使い、情報提供同意を保存した後に標準OAuthの同意処理へ進むとする。
- [main.ja.md:592](../specification/v0.1/main.ja.md) も同じ流れを定める。
- [main.ja.md:166](../specification/v0.1/main.ja.md) が再表示を定めるのは「初回の保存前に中断した場合」だけである。
- [main.ja.md:856](../specification/v0.1/main.ja.md) は「標準`oauthConsent`はOAuth scope等の同意、独自表は情報提供同意と外部アカウント単位の選択を管理する」とし、2つの同意を同期する規則は無い。
- [v0.1.md:114-115](../implementation-plan/v0.1.md) は `consentPage` への接続と「再連携時の保存済み選択を確認する」だけを書き、画面を毎回出す手段は書いていない。
- [profile-setting.md:82](../../../points-web-app/docs/v0.2/details-ja/profile-setting.md) は、連携先を別の Points ユーザーへ変える再連携で「Accountsでの本人確認と情報提供への同意を行い」とする。
- 移行元の `points-oauth-provider.ts`:93-118 は、`postLogin.consentReferenceId` で連携の試行ごとに別の値を作り、毎回同意画面へ進めていた。

**Better Auth 1.7.5 の確認箇所**

- OP:5645 は、`prompt=consent` なら、`skipConsent` の判定（OP:5651）と既存同意の検索（OP:5660）より前に同意画面へ送る。
- OP:5660-5676 は、`clientId`・`userId`（と `referenceId`）で `oauthConsent` を検索する。
- OP:5677-5685 は、同意が無いか、scope・claims・resource が不足する場合に同意画面へ送る。
- 以上をすべて満たすと、OP:5686-5694 で認可コードを発行する。同意画面は出ない。
- 公式文書 `plugins/oauth-provider` 871行に「To remove consent, delete that user's "oauthConsent" for that client」とある。
- rc.1 の `index.mjs`:4390 にも同じ分岐がある。

**疑われる問題（推測）**: 2回目以降の連携開始では `consentPage` が省かれ、「アカウント連携」画面が表示されないまま連携が確定する。

**発生する操作**

- 本人が Accounts で情報提供同意を OFF にした後、Points で連携を解除し、しばらくして Points から再び連携を開始する操作。
- [profile-setting.md:82](../../../points-web-app/docs/v0.2/details-ja/profile-setting.md) の流れで、連携先を別の Points ユーザーへ移して再連携する操作。

**影響（推測）**

- 前者では、Points は連携を確定するが、一覧APIは404になる。本人には同意を ON に戻す画面が出ない。
- 後者では、Points 仕様が求める「再連携での情報提供への同意」が行われない。

**他の箇所で扱われていないことの確認結果**: [main.ja.md:82-86・166・176・592・856](../specification/v0.1/main.ja.md)、[v0.1.md:113-115](../implementation-plan/v0.1.md)、[profile-setting.md](../../../points-web-app/docs/v0.2/details-ja/profile-setting.md) の3.3・3.4節を確認した。同意画面を毎回出す手段の記載は無い。

**修正方式の比較**

| 観点 | (a) 利用側が `prompt=consent` を付ける契約 | (b) 同意OFFで保存したとき `oauthConsent` を削除 | (c) 試行ごとの referenceId（A2-01、移行元の方式） |
| --- | --- | --- | --- |
| [main.ja.md:84](../specification/v0.1/main.ja.md) の「利用側から開始した連携では同意画面を使う」 | 満たす（付けたクライアントについて） | 同意 ON のまま再連携すると省かれる | 満たす（全クライアント） |
| [profile-setting.md:82](../../../points-web-app/docs/v0.2/details-ja/profile-setting.md)（同意 ON のまま別ユーザーへ再連携） | 満たす | 満たさない | 満たす |
| 同意 OFF → 再連携 | 満たす | 満たす（クライアントが prompt を付けなくても画面が出る） | 満たす |
| Accounts 側の実装 | 無し（OIDC 標準のパラメーター） | 保存APIから標準の `/oauth2/delete-consent`（OP:3078）を呼ぶ | `postLogin` の必須項目（`page`・`shouldRedirect`）の設定、state からの値の生成、試行ごとに増える `oauthConsent` 行の掃除 |

- (a) で同意画面を経た場合、同意の保存後に OP:127 が `consent` を除いて authorize を再実行し、既存同意の検索が成立してコードを発行する。同意画面が繰り返し出ることはない。
- クライアントが `prompt=consent` を付けない場合でも、情報の提供は `client_consents`（[main.ja.md:877](../specification/v0.1/main.ja.md)）で決まるので、本人が保存した範囲を超えては提供されない（推測）。

**最小修正案**: (a) と (b) を併用する。

- (a) [main.ja.md:84](../specification/v0.1/main.ja.md) を API 契約として書き換える。例:「利用側は連携開始の認可要求に`prompt=consent`を付ける。付けない場合、保存済みの同意があれば同意画面を省く」。Points 側の [profile-setting.md](../../../points-web-app/docs/v0.2/details-ja/profile-setting.md) 3.3節と [v0.2-implementation.md](../../../points-web-app/plan/v0.2-implementation.md) の該当タスクにも1文加える。
- (b) [main.ja.md:176](../specification/v0.1/main.ja.md) または [main.ja.md:856](../specification/v0.1/main.ja.md) に「本人が情報提供同意をOFFで保存したとき、そのクライアントの`oauthConsent`を削除する」を加える。これは、クライアントが `prompt` を付けなくても、本人が提供を止めたクライアントへは画面を経ずに再連携されないようにする Accounts 側の制御である。
- [v0.1.md:114-115](../implementation-plan/v0.1.md) に、上記の接続と確認を加える。

**仕様作成者の判断事項**: 第三者のクライアントを含め、すべての連携開始で必ず同意画面を出す要件があるなら、(c) を採る。その場合は (a)・(b) は不要になる。

### M11 保存ボタンを非活性にする条件に証明済みの限定が無い

- 元ID: A2-14、B2-04（要修正・軽微）
- 根拠の強さ: 強
- 仕様作成者の判断事項: なし

**観察された事実**

- [main.ja.md:600](../specification/v0.1/main.ja.md)「情報提供への同意をONにしたOAuthクライアントのうち、外部アカウントが1件も選択されていないものがある場合は、画面全体の「保存」ボタンを非活性にする」（証明済みという限定が無い）
- [main.ja.md:601](../specification/v0.1/main.ja.md) と [main.ja.md:877](../specification/v0.1/main.ja.md) は「本人に証明済みとして紐付く外部アカウントが1件以上」を保存APIで検査する。
- [main.ja.md:593・596](../specification/v0.1/main.ja.md) により、「未検証で保存」したURLも一覧表の行になる。

**疑われる問題（推測）**: 同意 ON で未検証の行だけを選ぶと、画面では保存ボタンが有効なのに、保存APIが全体をエラーにする。

**発生する操作**: 初回連携などで、「未検証で保存」したURLだけを提供先に選んで保存する操作。

**影響（推測）**: 保存に失敗し、本人に理由が伝わりにくい。

**他の箇所で扱われていないことの確認結果**: [main.ja.md:176-178・185-186・593-601・877](../specification/v0.1/main.ja.md) を確認した。

**最小修正案**: [main.ja.md:600](../specification/v0.1/main.ja.md) を「証明済みの外部アカウントが1件も選択されていないものがある場合は」に揃える。

### M13 解除と退会が標準のfresh session要件に掛かる

- 元ID: B1-02、D1-03（要修正）、C1-04（記載追加）
- 根拠の強さ: 強
- 仕様作成者の判断事項: なし（2案のどちらかを選ぶ軽微な修正）

**観察された事実**

- [main.ja.md:564](../specification/v0.1/main.ja.md) は、外部アカウントの解除と Accounts ユーザーの退会を「Accountsへの通常のログイン状態」と権限に基づいて実行するとする。
- [main.ja.md:123](../specification/v0.1/main.ja.md) は、ログインセッションを7日とし、利用に応じて延長する。
- [main.ja.md:835](../specification/v0.1/main.ja.md) は、解除を `unlinkAccount()` へ接続するとする。
- [main.ja.md:914-923](../specification/v0.1/main.ja.md) の設定表に、`session.freshAge` と `user.deleteUser.enabled` は無い。
- [main.ja.md:834](../specification/v0.1/main.ja.md) により、メールを返さない Provider（ORCID）のユーザーには内部用の値がメールとして入る。

**Better Auth 1.7.5 の確認箇所**

- BA `api/routes/account.mjs`:260-282 の `unlinkAccount` は、263行で `use: [freshSessionMiddleware]` を指定する。
- BA `api/routes/session.mjs`:331-342 は、`freshAge` が0以外で、`session.createdAt` からの経過が `freshAge` 以上なら、403 `SESSION_NOT_FRESH` を返す。
  - 基準は `createdAt` なので、セッションの延長では fresh な状態に戻らない。
- BA `context/create-context.mjs`:149 の `freshAge` の既定値は `3600 * 24`（1日）である。公式文書 `concepts/session-management` 73行も既定を1日とする。
- BA `api/routes/update-user.mjs`:292-295 は、`deleteUser.enabled` が無いと404を返す。335-339行は、パスワードも確認メールも無い場合、fresh でなければ 400 `SESSION_EXPIRED` を返す。
- rc.1 の `create-context.mjs`:159 も既定は1日である。

**疑われる問題（推測）**

- Accounts は OAuth だけで登録するのでパスワードが無い。ORCID のユーザーは内部用のメールなので、確認メールも使えない。
- このため、ログインから1日を超えたセッションで解除・退会を押すと、標準APIが拒否する。[main.ja.md:564](../specification/v0.1/main.ja.md) の「通常のログイン状態」では、この拒否を説明できない。

**発生する操作**: 前日以前にログインした本人が、「アカウント連携」画面で連携を解除する操作、または設定画面で退会する操作。7日セッションの2日目以降は必ず発生する。

**影響（推測）**

- 仕様に案内が無いため、本人は原因が分からない。
- Provider 側の token 失効を先に行ってから `unlinkAccount` が拒否されると、Provider 側は失効済みで、Accounts 側の紐付けが残る（D1-03）。

**他の箇所で扱われていないことの確認結果**: [main.ja.md:119-128・562-577・921](../specification/v0.1/main.ja.md)、[v0.1.md:111・143](../implementation-plan/v0.1.md) を確認した。再認証・fresh session の記載は無い。

**最小修正案**: 次のどちらかを [main.ja.md:564](../specification/v0.1/main.ja.md) と設定表に書く。どちらの場合も、設定表に `user.deleteUser.enabled: true` を加える。

- 案A: 設定表に `session.freshAge: 0` を加え、[main.ja.md:564](../specification/v0.1/main.ja.md) の「通常のログイン状態」のとおりにする。
- 案B: [main.ja.md:564](../specification/v0.1/main.ja.md) に「解除・退会は、ログインから`session.freshAge`（既定1日）以内のセッションを要求し、超えている場合は再ログインを案内する」を加える。token 失効の前に fresh の判定を行う順序も書く。

### M14 独自表の外部キーに削除時動作が無い

- 元ID: C1-01（要修正）、B1-03 の削除側（要修正）
- 根拠の強さ: 強（外部キーの強制と標準の削除順は確認済み）
- 仕様作成者の判断事項: なし

**観察された事実**

- [main.ja.md:843-848](../specification/v0.1/main.ja.md) の独自表の外部キーに、`ON DELETE` の指定は無い。例:
  - `external_accounts.user_id → user.id`（843行）
  - `external_account_verifications.auth_account_id → account.id`（845行）
  - `client_consents.user_id → user.id`（847行）
- [main.ja.md:805](../specification/v0.1/main.ja.md) は、この節を D1 SQLite 上の物理設計とする。
- [main.ja.md:835](../specification/v0.1/main.ja.md) は解除を `unlinkAccount()` へ接続し、[main.ja.md:879](../specification/v0.1/main.ja.md) は退会で「本人の独自表データと標準認証・登録クライアントを削除する」とする。
- [main.ja.md:881](../specification/v0.1/main.ja.md) は、関連する複数書込を D1 の `batch()` 1回で確定し、複数 batch に分けた操作の原子性は保証しないとする。
- D1 は既定で外部キーを強制する（Cloudflare の foreign-keys ページ23行。検証担当が取得）。

**Better Auth 1.7.5 の確認箇所**

- BA `db/internal-adapter.mjs`:232-245 の `deleteUser` は、session・account・user を別々の文で削除する。
- BA `api/routes/account.mjs`:280 の `unlinkAccount` は、`deleteAccount` の1文で削除する。
- drizzle-adapter:557 の `transaction` の既定値は `false` である。
- 標準表どうしの参照は、既定で `cascade` になる（BA `db/get-migration.mjs`:617・645、core `db/get-tables.mjs`:139・217）。
- `auth` CLI の Drizzle schema の生成で同じ既定になるかは、1.7.5 では未確認である（C-1 の rc.1 の記録に依拠）。

**疑われる問題（推測）**

- Drizzle の `.references()` で `onDelete` を省くと、SQLite の既定の NO ACTION になる（C1-01）。
- `auth_account_id → account.id` が NO ACTION のままだと、`oauth` 証明の行が残っている間は `unlinkAccount` が外部キー違反で失敗する。
- 同様に `external_accounts.user_id → user.id` があるため、`deleteUser` の user の削除も失敗する。このとき session はすでに削除されている。
- 独自表を先に別の batch で消すと、後の標準の削除が失敗した場合に、独自データだけが消えた状態が残る。

**発生する操作**: OAuth 連携の解除と退会。どちらも通常の操作で必ず通る経路である。

**影響（推測）**: NO ACTION のまま実装すると、解除と退会が常に失敗する。実装すればすぐ気付く種類の不備だが、削除の順序と原子性は仕様で決める必要がある。

**他の箇所で扱われていないことの確認結果**: [main.ja.md:125・137-138・535-537・568-576・876・879・881](../specification/v0.1/main.ja.md)、[v0.1.md:117・120・143](../implementation-plan/v0.1.md) を確認した。削除時動作と、標準の削除との順序の記載は無い。前回レビューにも該当しない。

**最小修正案**

- [main.ja.md:843-848](../specification/v0.1/main.ja.md) の各外部キーに `ON DELETE CASCADE` を明記する。
  - `external_accounts.user_id`・`client_consents.user_id` → `user.id`
  - `external_account_verifications.auth_account_id` → `account.id`
  - `external_identifiers`・`external_account_verifications`・`verification_identifiers`・`external_account_visibility` の親へのFK
- これにより、`unlinkAccount` の account の削除1文で `oauth` 証明とその対象関連が消え、`deleteUser` の user の削除1文で独自表の全データが消える。どちらも1文なので、文単位で原子的になる（推測）。
- [main.ja.md:876・879](../specification/v0.1/main.ja.md) に「標準の削除に伴うCASCADEで独自表の証明・データを終了し、支える証明が無くなった識別子の`is_active`の更新は続くbatchで行う」を1文加える。
- 後続の batch が間に合わない間も、[main.ja.md:877](../specification/v0.1/main.ja.md) が読み取り時に成功済み証明の対象を確認するので、情報は漏れない。ただし部分UNIQUEが、他人による同じ識別子の有効化を一時的に妨げる（C1-01、推測）。

### M16 設定表にtrustedProvidersが無くORCIDを追加連携できない

- 元ID: B1-01、D1-01（要修正）
- 根拠の強さ: 強
- 仕様作成者の判断事項: なし

**観察された事実**

- [main.ja.md:916-923](../specification/v0.1/main.ja.md) の設定表で `accountLinking` に関わるのは、[main.ja.md:918](../specification/v0.1/main.ja.md)（`disableImplicitLinking: true`）と [main.ja.md:919](../specification/v0.1/main.ja.md)（`allowDifferentEmails: true`・`updateUserInfoOnLink: false`）の2行だけで、`trustedProviders` は無い。
- [main.ja.md:919](../specification/v0.1/main.ja.md) のキーは、`account.accountLinking` の接頭辞を省いて書かれている。
- [main.ja.md:146](../specification/v0.1/main.ja.md) は明示的な追加連携を定め、[main.ja.md:835・925](../specification/v0.1/main.ja.md) は追加連携と ORCID を `linkSocial()` へ接続するとする。
- [main.ja.md:834](../specification/v0.1/main.ja.md) は、メールを返さない Provider に内部用の一意な値を対応付けるとする。
- 移行元の `auth-options.ts`:64 は `trustedProviders` を指定している。
- ORCID の OIDC の claims に email・email_verified は無い（調査担当の取得）。

**Better Auth 1.7.5 の確認箇所**

- BA `api/routes/callback.mjs`:173-176 は、`trustedProviders` に含まれず、かつ `emailVerified` が偽なら `UNABLE_TO_LINK_ACCOUNT` を返す。
- BA `api/routes/account.mjs`:207 は、idToken による連携にも同じ条件を置く。
- BA `context/helpers.mjs`:152-156 により、`trustedProviders` の既定は空配列である。
- BA `plugins/generic-oauth/index.mjs`:56 は、userinfo に `email_verified` が無いと `false` にする。229-235行では `mapProfileToUser` の戻り値で `emailVerified` を上書きできる。
- rc.1 の `callback.mjs`:155・`account.mjs`:153 にも同じ条件がある。

**疑われる問題（推測）**

- 設定表どおりに構成すると、ORCID の追加連携は常に `unable_to_link_account` で失敗する。メール未検証の GitHub アカウントも追加連携できない。
- ORCID での新規登録はユーザー作成の経路なので、この条件に掛からない。このため「ORCID で登録はできるが、追加連携はできない」という非対称が起きる（B1-01）。
- `mapProfileToUser` で `emailVerified` を真にすれば通るが不自然で、`trustedProviders` を指定するのが正攻法である。

**発生する操作**: Google で登録した本人が、「アカウント連携」画面で ORCID を追加する操作。

**影響（推測）**: v0.1 の主要機能である ORCID の追加連携ができない。受け入れ条件（[main.ja.md:794](../specification/v0.1/main.ja.md)「複数アカウント」）と [v0.1.md:111](../implementation-plan/v0.1.md) の明示連携の検証を満たせない。

**他の箇所で扱われていないことの確認結果**: [main.ja.md:116-127・144-148・830-835・912-937](../specification/v0.1/main.ja.md)、[v0.1.md:108-112](../implementation-plan/v0.1.md) を確認した。[main.ja.md:912](../specification/v0.1/main.ja.md) は実際の設定値を Options で確認するとして実装時に補う余地を残すが、設定表に無ければ主要な流れが既定で失敗する。

**最小修正案**

- 設定表に `account.accountLinking.trustedProviders: ["google", "github", "orcid"]`（Provider ID は採用値）を追加する。
- [main.ja.md:919](../specification/v0.1/main.ja.md) のキーを `account.accountLinking.allowDifferentEmails`・`account.accountLinking.updateUserInfoOnLink` と完全な形で書く。
- `disableImplicitLinking: true` の下では暗黙の連携は起きないので、この指定は明示連携の許可だけに効く（Options の `disableImplicitLinking` の説明。D1-01 の記録）。

### M17 AdminプラグインとappAdminの権限が未定義

- 元ID: B1-09、D2-03（要修正）、D1-08（記載追加）。関連: A2-12、B2-09（監査）
- 根拠の強さ: 強（定義が無いこと）
- 仕様作成者の判断事項: **あり**（v0.1 で運営者機能を持つか）

**観察された事実**

- [main.ja.md:818-819](../specification/v0.1/main.ja.md) は、Admin の role・ban の標準列と「Adminの代理ログイン」を標準機能として使うとする。
- [main.ja.md:937](../specification/v0.1/main.ja.md)「Admin | Accounts内の`appAdmin`・`user`の権限管理」
- `main.ja.md` で `appAdmin` が出るのは895行と937行の2箇所だけである。
  - [main.ja.md:895](../specification/v0.1/main.ja.md) は Points の評価軸の権限についての確認事項で、「今回指定された」という対話由来の表現である。
- [v0.1.md:110](../implementation-plan/v0.1.md)「AdminプラグインはAccounts側で確定した運営権限へ対応付ける」の「確定した運営権限」は、`main.ja.md` のどこにも無い。
- [main.ja.md:565](../specification/v0.1/main.ja.md) の「対象の管理者」は定義されていない。
- [main.ja.md:609](../specification/v0.1/main.ja.md) の監査対象に、代理ログイン・ban・role の変更は無い。
- [main.ja.md:580](../specification/v0.1/main.ja.md) の管理画面は3画面で、運営者の機能は無い。[main.ja.md:89-100](../specification/v0.1/main.ja.md) の機能表と [main.ja.md:787-802](../specification/v0.1/main.ja.md) の受け入れ条件にも Admin は無い。
- [evaluation-criteria-management.md:5](../../../points-web-app/docs/v0.2/details-ja/evaluation-criteria-management.md) は、Points の v0.2 がグローバルな `ADMIN` だけを持つとする。

**Better Auth 1.7.5 の確認箇所**

- BA `plugins/admin/access/statement.mjs` の既定の admin ロールは、`impersonate`・`delete`・`ban`・`set-role` などを持つ。
- BA `plugins/admin/routes.mjs`:753-781 の `removeUser` は、`deleteUser.beforeDelete` を通らず、`internalAdapter.deleteUser` を直接呼ぶ。
- `appAdmin` という独自のロール名を使うには、アクセス制御の定義か `adminRoles` の設定が要る（公式文書 `plugins/admin`。D1-08・D2-03 の記録）。

**疑われる問題（推測）**

- 定義しないまま既定の admin ロールを使うと、管理者は代理ログインで本人として、情報提供同意・OAuth 同意・外部アカウントの解除・退会を実行できる。監査も残らない。
- `removeUser` は、[main.ja.md:573-574](../specification/v0.1/main.ja.md) の退会処理（登録クライアントの終了、独自表の削除）を通らない。
- ban したユーザーの公開プロフィールと API 提供を続けるかも決まらない。
- [main.ja.md:895](../specification/v0.1/main.ja.md) と [main.ja.md:937](../specification/v0.1/main.ja.md) の役割名が同じで、Points 側の役割名が Accounts 側に混入した可能性がある。

**発生する操作**: 実装者が [v0.1.md:110](../implementation-plan/v0.1.md) に従って Admin を接続する時点。運営者が迷惑ユーザーや問い合わせに対応する場面。

**影響（推測）**: 何を実装すればよいかが決まらず、実装に着手できない。代理ログインをそのまま有効にすると、本人の同意なく提供設定が変わりうる。

**他の箇所で扱われていないことの確認結果**: [main.ja.md:562-567・578-614・816-824・895・927-940](../specification/v0.1/main.ja.md)、[v0.1.md:110](../implementation-plan/v0.1.md)、[v0.2/main.ja.md](../specification/v0.2/main.ja.md)、[v0.3/main.ja.md:18-20](../specification/v0.3/main.ja.md)、Points の [evaluation-criteria-management.md](../../../points-web-app/docs/v0.2/details-ja/evaluation-criteria-management.md)・[profile-setting.md](../../../points-web-app/docs/v0.2/details-ja/profile-setting.md) を確認した。定義は無い。

**最小修正案**: 判断事項に応じて次のどちらかにする。

- 案A: v0.1 で運営者機能が不要なら、[main.ja.md:818-819・937](../specification/v0.1/main.ja.md) から Admin を外し、[v0.1.md:110](../implementation-plan/v0.1.md) の該当文を削除する。
- 案B: 必要なら、次を `main.ja.md` に数行で定め、受け入れ条件に1行足す。
  - 使う機能（例: ban だけ）と、使わない既定権限（代理ログイン、`removeUser` など）の扱い。
  - `appAdmin` の任命方法と、「対象の管理者」（[main.ja.md:565](../specification/v0.1/main.ja.md)）の意味。
  - ban したユーザーの公開プロフィール・API提供の扱い。
  - 監査の対象（[main.ja.md:609](../specification/v0.1/main.ja.md) への追加）。操作主体の記録方法は前回レビューの R46 と同時に決める（B2-09）。
- どちらの場合も、[main.ja.md:895](../specification/v0.1/main.ja.md) の「今回指定された」「説明中の」という対話由来の表現は、文書として意味が通る記述に直す。

### M23 認証APIのレート制限がWorkersで既定では無効になりうる

- 元ID: D1-02（要修正）
- 根拠の強さ: 中〜強（検証担当は条件付きで同意）
- 仕様作成者の判断事項: なし

**観察された事実**

- [main.ja.md:922](../specification/v0.1/main.ja.md) は `rateLimit.storage: "database"` だけを記載し、`rateLimit.enabled` と IP の取得方法（`advanced.ipAddress`）の記載は無い。
- [v0.1.md:92](../implementation-plan/v0.1.md) は、認証 endpoint に Better Auth 標準の DB 保存型 Rate Limit を設定するとする。
- 移行元の `auth-options.ts`:79-89 は、`rateLimit.enabled: true` と `ipAddressHeaders: ["cf-connecting-ip"]` を明示している。

**Better Auth 1.7.5 の確認箇所**

- BA `context/create-context.mjs`:172 は `enabled: options.rateLimit?.enabled ?? isProduction` である。
- core `env/env-impl.mjs`:3 は `globalThis.process?.env` などを参照する。30-32行の `nodeENV`・`isProduction` は、モジュールの読み込み時に1回だけ決まり、要求ごとには読まれない。
- core `utils/ip.mjs`:174-195: `trustedProxies` が無い場合、`x-forwarded-for` が複数の値なら `null` を返す。
- BA `api/rate-limiter/index.mjs`:239-244: IP を決められないときは、共有のキー（`NO_TRUSTED_IP_KEY`）を使う。

**Cloudflare の確認結果**

- 公式の Workers の process のページでは、`process.env` は既定で空のオブジェクトである。
- ただし `nodejs_compat` と `nodejs_compat_populate_process_env`（互換日付 2025-04-01 以降は既定で有効）の下では、Worker に設定した環境変数・secret が `process.env` に入る。
- 同ページの「ビルド時の静的な置換」は `process.env.NODE_ENV` という式そのものの置換である。Better Auth は別の経路で読むので、この置換の対象にならないと推測する。

**疑われる問題（推測）**

- Worker の変数に `NODE_ENV=production` を設定しない限り、レート制限は既定で無効になる見込みである。
- 有効にしても、IP を決められない要求はパスごとに1つの共有バケットに入る。このため、1人の連続要求で、ログイン系の endpoint が全員に対して429になりうる。
- Workers が受け取る要求に `X-Forwarded-For` が付くかは未確認である。

**発生する操作**: 本番へのデプロイ時点から、認証APIへの連続要求があったとき。

**影響（推測）**: 認証APIの頻度制御が効かないか、第三者の連続要求で全利用者のログインが妨げられる。

**他の箇所で扱われていないことの確認結果**: [main.ja.md:553-560](../specification/v0.1/main.ja.md)、[v0.1.md:92-93](../implementation-plan/v0.1.md) を確認した。前回レビューの R05・R06 は参照先アンカーとユーザー単位の制限の論点で、本件とは別である。

**最小修正案**: 設定表に次の2行を追加する。既定の挙動（`NODE_ENV` の有無）に依存しなくなる。

- `rateLimit.enabled: true`
- `advanced.ipAddress.ipAddressHeaders: ["cf-connecting-ip"]`

### M25 受け入れ条件に退会が無い

- 元ID: D2-01（要修正）
- 根拠の強さ: 強
- 仕様作成者の判断事項: なし

**観察された事実**

- [main.ja.md:94](../specification/v0.1/main.ja.md) の機能表に「登録・ログイン・退会」がある。[main.ja.md:127](../specification/v0.1/main.ja.md) は、本人が設定画面で退会を実行できるとする。
- [main.ja.md:568-576](../specification/v0.1/main.ja.md) は、退会確認、ログイン・紐付け・公開・提供の終了、登録OAuthクライアントの終了（[main.ja.md:573](../specification/v0.1/main.ja.md)）、データの削除を定める。
- [main.ja.md:787-802](../specification/v0.1/main.ja.md) の受け入れ条件に、「退会」の語は無い。
- [v0.1.md:169](../implementation-plan/v0.1.md) は、受け入れ条件とテスト結果を突き合わせて完了を判定する。
- [v0.1.md:138](../implementation-plan/v0.1.md) は「退会後は404」を確認対象にするが、登録クライアントの終了は確認対象に無い。

**疑われる問題（推測）**: 退会が完了判定の対象から外れる。特に「本人が登録したOAuthクライアントの終了で、既存の認可・発行済みトークンによるAPI利用も止まる」（[main.ja.md:573](../specification/v0.1/main.ja.md)）は、テストが無いと漏れやすい。

**発生する操作**: 本人が設定画面で退会する操作。

**影響（推測）**: クライアントの終了やトークンの無効化が漏れると、退会したユーザーが登録したクライアントが Accounts API を使い続ける。

**他の箇所で扱われていないことの確認結果**: [v0.1.md:138・143](../implementation-plan/v0.1.md)、[verify-url.ja.md:203-217](../specification/v0.1/verify-url.ja.md) を確認した。

**最小修正案**: [main.ja.md:787-802](../specification/v0.1/main.ja.md) の表に「退会」の行を1行追加する。例:「退会確認の有効化条件、ログイン・セッション・紐付け・一般公開・情報提供の終了、登録クライアントの終了と既存トークンによるAPIの拒否、公開プロフィールの404とpurge」。

### M29 v0.2文書がv0.1に設計要件と完了条件を課している

- 元ID: D2-05（要修正）、C2-09（記載追加）
- 根拠の強さ: 強（文書間の明示的な食い違い）
- 仕様作成者の判断事項: **あり**（どちらの文書に揃えるか）

**観察された事実**

- [v0.2/main.ja.md:208-221](../specification/v0.2/main.ja.md)「v0.1で準備する設計」は、v0.1 に安定ID、フィールド台帳、版管理、削除記録、原本と評価の分離などの基礎を設けるとする。
- [v0.2/main.ja.md:229-233](../specification/v0.2/main.ja.md) は、v0.1 の論理テーブルとして `change_log`/`tombstones` などを挙げる。227行に「実際のテーブル名・数は既存設計に合わせて調整する」とある。
- [v0.2/main.ja.md:367](../specification/v0.2/main.ja.md) は v0.1 で「安定ID、フィールド台帳、デフォルト拒否、選択抽出、更新・削除管理を実装」とする。
- [v0.2/main.ja.md:373](../specification/v0.2/main.ja.md) は「この事前検証はv0.1の設計確定前に行う」とする。
- [v0.2/main.ja.md:434](../specification/v0.2/main.ja.md) は「v0.1の完了条件は、D1だけで通常機能が動き、選択項目を欠落なく取り出せ、未選択項目の混入をテストで検出できることとする」とする。
- [main.ja.md:843-848](../specification/v0.1/main.ja.md) のテーブル設計、[main.ja.md:787-802](../specification/v0.1/main.ja.md) の受け入れ条件、[v0.1.md](../implementation-plan/v0.1.md) には、これらに相当するものが無い。`main.ja.md` と `v0.1.md` は v0.2 の文書を参照しない。

**疑われる問題（推測）**

- v0.1 の完了条件と、設計を確定できる時期が、2つの文書で異なる。
- v0.2 の文書に従えば、`main.ja.md` のテーブル設計は「確定前」になり、[v0.1.md:7](../implementation-plan/v0.1.md) の「未決事項は着手前に確定する」に掛かる。

**発生する操作**: 実装者が v0.1 の完了を判定するとき、テーブル設計を確定して migration を作るとき。

**影響（推測）**: どちらに従うかを実装者が決められない。v0.2 の文書を読まずに進めると、v0.2 で「v0.1で準備済み」とされる基礎が存在しない。

**他の箇所で扱われていないことの確認結果**: `main.ja.md` 全文、`v0.1.md` 全文、[implementation-plan/v0.2.md](../implementation-plan/v0.2.md)、[v0.3/main.ja.md](../specification/v0.3/main.ja.md) を確認した。前回レビューも扱っていない（R28 は Cloudflare 依存の論点だけ）。

**最小修正案**: 判断事項に応じて次のどちらかに統一する。

- 案A: [v0.2/main.ja.md:208-221・227-233・367・373・434](../specification/v0.2/main.ja.md) の v0.1 向けの要件を、v0.2 着手時の作業として書き換える。未リリースで後方互換は不要なので、v0.2 で追加する際に移行すれば足りる（C2-09、推測）。
- 案B: 必要な基礎（例: 選択抽出だけ）を `main.ja.md` のテーブル設計と受け入れ条件に取り込み、`v0.1.md` に作業を加える。

**仕様作成者の判断事項**: v0.2 の準備を v0.1 の範囲に含めるか。

### M30 実装計画の設定値の参照先アンカーの誤り

- 元ID: D2-11（要修正・軽微）
- 根拠の強さ: 強
- 仕様作成者の判断事項: なし

**観察された事実**

- [v0.1.md:109](../implementation-plan/v0.1.md) は「`better-auth/minimal`、暗号化、明示的なProvider連携、ログイン時更新、Cookie cache、DB joins、DB保存型Rate Limitを[認証ライブラリとの分担]に従って設定する」とし、`main.ja.md#認証ライブラリとの分担` へリンクする。
- リンク先の [main.ja.md:814-828](../specification/v0.1/main.ja.md) は、標準モデルの表と、版・CLI・一意制約の記述である。これらの設定値は無い。
- 設定値の表は [main.ja.md:912-923](../specification/v0.1/main.ja.md)（903行の見出し「提供・技術要件」の下）にあり、`better-auth/minimal` は [main.ja.md:911](../specification/v0.1/main.ja.md) にある。
- アンカー自体は実在するので、リンク切れではない。前回レビューの R05 と同じ型の誤りである。

**疑われる問題（推測）**: 読み手がリンクから設定値を見つけられない。

**発生する操作**: 実装者がリンクをたどる操作。

**影響**: 実装の誤りに直結はしないが、M16・M23 で追加する設定行の置き場所と取り違えうる。

**他の箇所で扱われていないことの確認結果**: 調査担当 D-2 がスクリプトで全リンクを確認し、指す内容が違うものを目視で確認した。新規はこの1件である。

**最小修正案**: [v0.1.md:109](../implementation-plan/v0.1.md) のリンク先を `main.ja.md#提供技術要件` に変える。

## 4. 記載追加が望ましい

実装者が妥当に判断できるが、仕様や実装計画に1〜2文あると実装・案内がぶれないものである。
4.1 はトリアージで個別に列挙したもので、トリアージの順に並べた。
4.2 は、トリアージで個別に言及されていないため、レビュー担当の区分（記載追加）を維持したものである。

### 4.1 トリアージで列挙したもの

#### M20 復元候補のサービス名と表示名をJSONから採るか

- 事実: [main.ja.md:878](../specification/v0.1/main.ja.md) が現在の証明として扱わないと定めるのは「候補の過去の証明情報」だけである。[main.ja.md:640](../specification/v0.1/main.ja.md) は、JSON の値を型と形式だけで検査する。[verify-url.ja.md:83](../specification/v0.1/verify-url.ja.md) は「サービス名・ユーザー名などの補助情報は、入力URLと検証のために取得したページから得られる範囲で保存する」とする。[main.ja.md:532](../specification/v0.1/main.ja.md) が表示名の更新を定めるのは OAuth の場合だけである。[main.ja.md:651](../specification/v0.1/main.ja.md) により、候補の公開選択は再証明の後に適用される。
- 影響: 本人が JSON を手で編集した場合に限り、Web の行に検証していないサービス名・表示名を付けたまま再証明でき、「証明済み」のバッジと並んで一般公開・Points に出うる（推測）。識別子は検証でしか有効にならないので、他人の識別子の取得にはつながらない。影響は本人の行の表示に限られる。
- 提案: [main.ja.md:878](../specification/v0.1/main.ja.md) に「候補を再証明するとき、`service`・`displayName`はverify-url.ja.md:83に従ってバックエンドが再判定し、JSONの値は採用しない」と1文書く。
- 補足: レビュー担当・検証担当は要修正（軽微）としたが、管理者判断で記載追加とした（[8章](#8-トリアージで区分を変えた指摘と理由)）。

#### M08 同意画面を終えるときの操作

- 事実: [main.ja.md:592](../specification/v0.1/main.ja.md) は「保存した提供内容に同意して元のサービスへ戻る操作へ進む」とだけ書く。同意 OFF のまま戻れるか、拒否できるかは書かれていない。[main.ja.md:600-601](../specification/v0.1/main.ja.md) の保存条件は、同意 ON のクライアントだけに掛かる。標準には拒否がある。公式文書 `plugins/oauth-provider` 879行の `accept` がそれで、OP:55-58 は `accept: false` で `access_denied` を返す。同文書871行には、拒否しても既存の同意は残るとある。移行元の同意画面には「許可しない」（`accept: false`）があった（B2-01）。
- 影響: 同意 OFF のまま戻ると OAuth は成立し、Points は連携を保存するが、一覧APIは404になる（[main.ja.md:257](../specification/v0.1/main.ja.md) は存在しない場合と同意が無い場合を同じ404にしている）。逆に、同意 ON で保存した後に標準の同意画面で拒否すると、`client_consents` は ON のまま残る。この状態では、クライアントは照合APIで本人の Accounts ユーザーIDを特定できる（推測）。
- 提案: [main.ja.md:592](../specification/v0.1/main.ja.md) に次を1〜2文で書く。同意 OFF のまま戻れるか（戻れば OAuth は成功し、一覧は404）。「連携しない」を選んだ場合は標準の拒否で `access_denied` を返すこと。同意 ON で保存した後に拒否した場合、保存済みの同意を維持するか OFF へ戻すか。

#### M09 同意画面に示す利用目的の出典

- 事実: [main.ja.md:84・592](../specification/v0.1/main.ja.md) は「連携先と利用目的を示し」とする。[main.ja.md:159](../specification/v0.1/main.ja.md) の登録項目に「利用目的」は無く、説明文は任意入力である。[main.ja.md:187](../specification/v0.1/main.ja.md) は Points についてだけ利用目的を定める。
- 影響: Points 以外のクライアントや、説明文が空のクライアントについて、同意画面に何を利用目的として出すかが決まらない。表示内容の定義の不足であり、安全性や正しさの欠陥ではない。
- 提案: 「説明文を利用目的として表示し、必須にする」か、「Accounts共通の定型文（提供する項目と、連携先が公開表示・照合に使いうること）を表示する」かを1文で決める。

#### M18 別ユーザーや別originのJSONを復元した場合

- 事実: [main.ja.md:630](../specification/v0.1/main.ja.md) は、提供範囲を「同じAccountsユーザーへのバックアップ復元」とする。[main.ja.md:632](../specification/v0.1/main.ja.md) は、別サービスへの取込を取込先が定めるとする。[main.ja.md:638-643](../specification/v0.1/main.ja.md) の検査に、JSON の `accountsOrigin`・`accountsUserId` と復元先の一致は無い。[main.ja.md:637・650](../specification/v0.1/main.ja.md) は「同じAccountsユーザーへ復元するとき」と条件付きで書く。
- 影響: 本人が別ユーザー（退会前の自分など）や別インスタンスの JSON を選んだときの結果が決まらない。ただし候補は再証明するまで有効にならず（[main.ja.md:651](../specification/v0.1/main.ja.md)）、影響は本人のデータに限られる。別インスタンスの同じ文字列の Client ID に同意が付く懸念（D2-06）は、Client ID が乱数なので現実的でない（推測）。
- 提案: [main.ja.md:639](../specification/v0.1/main.ja.md) 付近に「`accountsOrigin`・`accountsUserId`が復元先の本人と一致すること」を検査に加えるか、一致しない場合の扱い（例: 全項目を候補にし、同意は取り込まない）を1文で決める。

#### M19 復元時に既存の行へ対応付ける規則

- 事実: [main.ja.md:852](../specification/v0.1/main.ja.md) は「同じ本人の同じ正規化URLは候補を含め1行」とする。[main.ja.md:844](../specification/v0.1/main.ja.md) に本人内の UNIQUE `(user_id, kind, provider, issuer, value)` がある。[main.ja.md:666](../specification/v0.1/main.ja.md) は、識別子の種類・サービス・固有ID・正規化URLで同一性を判定するとする。
- 影響: 2回目の復元や、未検証登録済みのURLの復元は、これらの記述から既存行の更新と読める。残るのは境界ケースである。JSON の1アカウントが既存の複数行にまたがる場合や、複数の JSON アカウントが既存の1行に当たり公開選択が食い違う場合の結果が決まらない。単純に挿入すると UNIQUE 違反で復元全体が失敗する（C2-02、推測）。
- 提案: [main.ja.md:878](../specification/v0.1/main.ja.md) に「本人の既存行（候補を含む）と識別子キーが一致する項目はその行を更新する。1アカウントが既存の複数行に当たる場合と、公開選択が食い違う場合は入力不備とする」を1〜2文加える。

#### M21 Workers CacheのTTL上限とpurge失敗時の扱い

- 事実: [main.ja.md:942](../specification/v0.1/main.ja.md) は、公開情報の DB 更新後にプロフィールのキャッシュを purge するとする。[v0.1.md:77](../implementation-plan/v0.1.md) は purge の契機を「…退会など」と例示し、[v0.1.md:80](../implementation-plan/v0.1.md) は「公開キャッシュ用の`Cache-Control`」とだけ書き、max-age を決めていない。公式文書では、Workers Cache は常に Free 枠の制限を使い、tag・prefix の purge は1分に5件（bucket 25）で、超えると失敗を返す。URL単位の purge は無く、path prefix で消す。
- 影響: 失敗するのはアカウント全体で bucket を使い切ったときに限られ、v0.1 の規模ではまれである（推測）。ただし TTL が決まっていないので、失敗したときに古い HTML が残る時間に上限が無い。本人が一般公開を取り消した、または退会したのに、公開 HTML に外部アカウントとの対応が残り続けうる。これはプライバシーに関わる影響である。
- 提案: [v0.1.md:77-80](../implementation-plan/v0.1.md) に、公開プロフィールの TTL の上限（例: `cloudflare-cdn-cache-control` で edge 向けに数分。D1-05 の記録）を定め、purge に失敗した場合はログに残して TTL で収束させる、と1文書く。再試行キューなどの追加の仕組みは不要である。
- 補足: Workers Cache の purge が Free 枠の tag・prefix の区分で数えられることは、公式文書からの推測である。副論点の B2-08（purge 対象の列挙）は懸念のみとした（[5章](#5-懸念のみ)）。

#### M22 OAuth証明が他ユーザーに有効なユーザー名やURLと衝突する

- 事実: [main.ja.md:844](../specification/v0.1/main.ja.md) に部分UNIQUE `(kind, provider, issuer, value) WHERE is_active=1` がある。[main.ja.md:345-367](../specification/v0.1/main.ja.md) の OAuth の例は、`oauth` 証明の対象に `provider_username`・`url` を含む。[main.ja.md:875](../specification/v0.1/main.ja.md) の最後の文は「OAuth固有IDとOAuth認証行はこの手順では移動しない」とする。[main.ja.md:136](../specification/v0.1/main.ja.md) はリンク証拠の再証明による所有者の更新を定める。[main.ja.md:876](../specification/v0.1/main.ja.md) は、OAuth の解除でほかの方法が支える識別子を有効なまま残すとしており、データ層で OAuth だけの解除を想定している。
- 影響（推測）: 本人がユーザーAで `https://github.com/alice` をリンク証明で有効にした後、誤って「GitHubでログイン」を押すと、GitHub OAuth はAに連携されていないので新しいユーザーCが作られる（[main.ja.md:117](../specification/v0.1/main.ja.md)）。Cの `oauth` 証明の対象が、Aの有効な行と部分UNIQUEで衝突する。OAuth の成功で Web 識別子を移すのか、対象から外すのかが読み取れない。決めないまま実装すると、ログインできるのに外部アカウント行が無い状態になりうる（M15 と重なる）。
- 提案: 前回レビューの R58 と同時に、[main.ja.md:875](../specification/v0.1/main.ja.md) か [main.ja.md:876](../specification/v0.1/main.ja.md) に「OAuth証明が確認した`provider_username`・`url`が他ユーザーに有効な場合は、新しい所有者へ移す（または、OAuth証明の対象から外し、固有IDだけで証明する）」を1文で書く。

#### M24 Open APIプラグインの用途の記載

- 事実: [main.ja.md:935](../specification/v0.1/main.ja.md) は「Open API | Better AuthのAPIドキュメント。Accounts資源APIのOpenAPI 3.2.1とそれぞれの仕様を表示」とする。公式文書 `plugins/open-api` によれば、このプラグインは Better Auth の core とプラグインの endpoint を OpenAPI 3.1.1 で生成し、Scalar で表示する。[v0.1.md:141](../implementation-plan/v0.1.md) には、Valibot から OpenAPI 3.2.1 を作り、Open API プラグインの出力と区別して案内する作業がある。
- 影響: [main.ja.md:935](../specification/v0.1/main.ja.md) だけを読むと、プラグインが資源APIの 3.2.1 も生成するように読める。作成手段は計画に書かれているので、実装は止まらない。
- 提案: [main.ja.md:935](../specification/v0.1/main.ja.md) を [v0.1.md:141](../implementation-plan/v0.1.md) と揃え、「Better Auth認証APIのOpenAPI 3.1.1を生成する。Accounts資源APIのOpenAPI 3.2.1は共有のValibot schemaから作成する」とする。

#### M26 受け入れ条件に所有権と情報提供の異常系が無い

- 事実: [main.ja.md:794](../specification/v0.1/main.ja.md) の「所有権・連携」の行に、Web URL の再証明による所有者の更新（[main.ja.md:136・875](../specification/v0.1/main.ja.md)）と、最後のログイン手段の解除拒否（[main.ja.md:125・876](../specification/v0.1/main.ja.md)）が無い。[main.ja.md:796](../specification/v0.1/main.ja.md) の「情報提供」の行に、同意 OFF/ON での選択の保持（[main.ja.md:176-177](../specification/v0.1/main.ja.md)）、後から追加したアカウントの非公開（[main.ja.md:189](../specification/v0.1/main.ja.md)）、クライアント削除後の API の拒否（[main.ja.md:237・879](../specification/v0.1/main.ja.md)）が無い。一方、[v0.1.md:118](../implementation-plan/v0.1.md) は Web識別子の移動を保存層の検証対象に、[v0.1.md:165](../implementation-plan/v0.1.md) は所有者更新を D1 上の検証対象にしている。
- 影響: 計画の検証対象にはあるので完全な漏れではないが、完了判定（[v0.1.md:169](../implementation-plan/v0.1.md)）の基準からは漏れる。
- 提案: [main.ja.md:794・796](../specification/v0.1/main.ja.md) に上記の項目を加える。所有者更新の規則は、前回レビューの R02 の決定後のものとする。

#### M27 Provider側のtoken失効は標準機能に無い

- 事実: [main.ja.md:535-537](../specification/v0.1/main.ja.md) は、Google・GitHub・ORCID で token の失効を確認してから解除するよう求める。1.7.5 では core `oauth2/oauth-provider.d.mts`:195 に `revokeToken?` の型があるだけで、`.mjs` に実装も呼び出しも無い（grep で確認）。[v0.1.md](../implementation-plan/v0.1.md) に「失効」「revoke」は0件である。[main.ja.md:910](../specification/v0.1/main.ja.md) は標準外の認証拡張を承認制にする。ORCID には `POST https://orcid.org/oauth/revoke` がある（調査担当の取得）。移行元の `github-identity-grant.ts` に GitHub の token 削除がある（A-1 の記録）。
- 影響: 「標準機能で構成する」と「失効の確認を必須にする」のどちらを優先するかで、実装が止まる。受け入れ条件と計画の両方から漏れやすい（D2-09）。
- 提案: 3つの Provider の失効を [main.ja.md:910](../specification/v0.1/main.ja.md) の承認対象の独自拡張として明記し、[v0.1.md](../implementation-plan/v0.1.md) の「4. Accountsの機能を実装・移管する」に失効の接続作業を1行加える。

#### M28 要件確定後の確認事項に未決事項が無い

- 事実: [main.ja.md:885-891](../specification/v0.1/main.ja.md) は、`verify-url.ja.md` と [main.ja.md:873](../specification/v0.1/main.ja.md) の再掲と、テーブル構造への参照である。[main.ja.md:893-895](../specification/v0.1/main.ja.md) は Points 側の事項である。[v0.1.md:7](../implementation-plan/v0.1.md) は「未決事項は対応する実装に着手する前に確定し」とする。
- 影響: 実装者が、[v0.1.md:7](../implementation-plan/v0.1.md) のゲートでどの事項を止めるべきかを判断できない。仕様の振る舞いの矛盾ではなく、管理方法の改善である。
- 提案: 節を「未決事項」に改め、本レビューの判断事項（M01・M03・M07・M17・M29）と前回レビューの判断事項（R01・R16・R17・R20）を、止める実装フェーズとともに列挙する。[main.ja.md:887-889](../specification/v0.1/main.ja.md) は `verify-url.ja.md` への参照1行にまとめる。

#### M15 標準のaccountから独自表を作る契機と失敗時の再構成

- 事実: [main.ja.md:835](../specification/v0.1/main.ja.md) は標準関数への接続だけを書く。[main.ja.md:873-879](../specification/v0.1/main.ja.md) に、サインアップと `linkSocial()` の成功時に `external_accounts`・`external_identifiers`・`oauth` 証明を作る手順は無い。[main.ja.md:881](../specification/v0.1/main.ja.md) は、複数の batch に分けた操作の原子性を保証しないとする。[v0.1.md:26](../implementation-plan/v0.1.md) は、移行元の認証フックから外部アカウント管理部分を切り出すとする。移行元の `create-auth.ts` は、account の作成・更新後の hook で独自表を作り、session 作成時の補修（`reconcilePermanentOAuthSubjects`）で不整合を直している。
- 影響: 標準の account の作成と独自表の書込は同じ batch にならない。独自表の書込が失敗すると、ログインできるのに外部アカウント一覧に出ない OAuth アカウントが残り、本人の操作では直せない（推測）。発生は D1 の一時的な失敗や M22 の衝突に限られる。
- 提案: [main.ja.md:873-879](../specification/v0.1/main.ja.md) に「OAuth連携: 標準`account`の作成・更新後に、外部アカウント行・Provider識別子・`oauth`証明・表示名を冪等に作成・更新する（公開選択はOFF）。失敗した場合は次回ログイン時に再構成する」を1項目加える。削除側（外部キー）は M14 で扱う。

### 4.2 レビュー担当の区分を維持したもの

#### M10 同意画面でクライアントを名前でしか識別できない

- 事実: [main.ja.md:158](../specification/v0.1/main.ja.md) で誰でもクライアントを登録でき、[main.ja.md:159](../specification/v0.1/main.ja.md) のアプリ名は自由入力である。同意画面に示すのは連携先の名前である（[main.ja.md:592](../specification/v0.1/main.ja.md)）。
- 影響: 第三者が「Points」という名前で登録すると、本人は区別できない。提供されるのは本人が保存した情報だけなので、影響は限定的である。
- 提案: 同意画面に今回の `redirect_uri` の host（または紹介URLの host）を表示すると1文書く。M09 と同時に決めるとよい。

#### M12 同意ONで選択0件の状態が解除や移動や復元で生じる

- 事実: [main.ja.md:601・877](../specification/v0.1/main.ja.md) の検査は保存時だけである。解除（[main.ja.md:137・876](../specification/v0.1/main.ja.md)）、Web識別子の移動（[main.ja.md:875](../specification/v0.1/main.ja.md)）、復元（[main.ja.md:878](../specification/v0.1/main.ja.md)）では、同意 ON のまま選択0件になりうる。[main.ja.md:316](../specification/v0.1/main.ja.md) は0件を空配列で返す。[main.ja.md:600](../specification/v0.1/main.ja.md) の非活性化は画面全体に掛かる。
- 影響: 無関係なクライアントの0件が、今回の保存を止める。利便性の問題で、情報は漏れない。
- 提案: [main.ja.md:600](../specification/v0.1/main.ja.md) に「条件を満たさないクライアントの列を画面に示す」を加えるか、解除・復元の後にこの状態を案内すると1文書く。

#### M32 client credentials用のscopeは管理用APIでしか付与できない

- 事実: 公式文書 `plugins/oauth-provider` 28行は、`client_credentials_scopes` を管理用の create・update と `clientPrivileges` の `configure-client-credentials-scopes` で付与するとする。OP:2174-2176 は `admin` のときだけ採用する。[v0.1.md:113](../implementation-plan/v0.1.md) で対応済みである。[main.ja.md:166・232](../specification/v0.1/main.ja.md) には付与の方法が無い。
- 影響: 計画どおりに実装すれば問題は無い。主仕様からは、登録したクライアントに自動で付くのか、運営者の承認が要るのかが読み取れない。
- 提案: [main.ja.md:166](../specification/v0.1/main.ja.md) か [main.ja.md:232](../specification/v0.1/main.ja.md) に「登録したクライアントには`identities:read`をClient Credentials用のscopeとして付与する（データの提供は本人の同意で制御する）」と1文書く。

#### M33 resourceのallowedScopesでopenidが落ちる点とトークン用途の判定方法

- 事実: [main.ja.md:230](../specification/v0.1/main.ja.md) は両フローで `resource` を指定し、[main.ja.md:231・233](../specification/v0.1/main.ja.md) により資源APIはクライアント用トークンだけを使う。[main.ja.md:236](../specification/v0.1/main.ja.md) は「トークンの用途」を確認するとする。OP-introspect:478-493 は resource の `allowedScopes` と要求 scope の積集合をとり、619-627行の `enforcePerClientResources` は既定で有効、1801行は `openid` を含むときだけ ID Token を発行する。
- 影響: resource の `allowedScopes` を `identities:read` だけにすると、初回連携の `openid` が落ち、ID Token が出ないか `invalid_scope` になる（設定しだい、推測）。「トークンの用途」の判定方法も書かれていない。
- 提案: [main.ja.md:230](../specification/v0.1/main.ja.md) を「Client Credentialsで`resource`を指定し、初回連携は`openid`を要求する」に単純化し、[main.ja.md:236](../specification/v0.1/main.ja.md) の用途を「`sub`が`client_id`と一致するクライアント用トークン」と具体化する。resource の設定と関連付けを設定表に加える。

#### M34 ID Tokenのissと提供元originの対応

- 事実: [main.ja.md:227](../specification/v0.1/main.ja.md) は、利用側が `iss` と `sub` を確認し、Accounts サービスの提供元と Accounts ユーザーIDを保持するとする。公式文書 `plugins/oauth-provider` 1111行は、issuer を設定しなければ basePath（例: `/api/auth`）が issuer のパスになるとする。
- 影響: 既定のままでは `iss` が `accountsOrigin` と一致しない。Points での対応付けと、JWT の検証に使う issuer が決まらない。
- 提案: 「JWTプラグインの`jwt.issuer`を`accountsOrigin`と同じ値にする」などを1文で定める。

#### M35 user.idをausr形式にする設定

- 事実: [main.ja.md:810](../specification/v0.1/main.ja.md) は `ausr_` と乱数による固定IDを定め、[main.ja.md:818](../specification/v0.1/main.ja.md) は `user` に固定IDを保存するとする。[main.ja.md:227](../specification/v0.1/main.ja.md) は ID Token の `sub` を公開固定IDとする。公式文書 `plugins/oauth-provider` 2064行は、`sub` にユーザーの内部IDを使うとする。Better Auth は `advanced.database.generateId` でモデルごとにIDを生成できる。
- 影響: `user.id` 自体を `ausr_` にするのか、別の列を持つのかが読み取れない。別の列にすると、`sub` と `accountsUserId` が食い違う。
- 提案: [main.ja.md:810](../specification/v0.1/main.ja.md) か [main.ja.md:818](../specification/v0.1/main.ja.md) に「`user.id`を`advanced.database.generateId`で`ausr_`形式に生成し、公開IDとOIDCの`sub`に使う。`sub`はクライアントによらず同じ値とする」と書く。

#### M36 OAuth ProviderとJWTの必須設定が設定表に無い

- 事実: [main.ja.md:234](../specification/v0.1/main.ja.md) は Access Token を15分・900秒とする。[main.ja.md:914-923](../specification/v0.1/main.ja.md) の設定表に OAuth Provider・JWT の設定は無い。OP-introspect:1782 の既定は3600秒である。公式文書 `plugins/jwt` 304行は、OAuth Provider と併用する場合に `/token` の無効化と jwt ヘッダーの無効化を MUST とする。
- 影響: 設定を漏らすと `expires_in` が3600になり、セッション由来の JWT が `/token` から発行される経路が残る。
- 提案: 設定表に `m2mAccessTokenExpiresIn: 900`、`disabledPaths: ["/token"]`、`jwt({ disableSettingJwtHeader: true })` と、scope・resource・`clientPrivileges`・`jwt.issuer`・署名方式の行を加える。

#### M37 Providerごとの識別子の対応とORCIDの注意

- 事実: [main.ja.md:403・532・835・854](../specification/v0.1/main.ja.md) は、OAuth の応答からどの識別子と表示名を作るかを Provider ごとに定めていない。標準の `account` は profile を保存しない。ORCID の `sub` はURL形式でない16桁の iD で、token endpoint の認証方式は `client_secret_post` だけである（調査担当の取得）。Generic OAuth は、clientSecret があれば既定で `client_secret_post` になる（core `oauth2/token-endpoint-auth.mjs`:6-7）。ORCID の PKCE 対応は未確認である。
- 影響: 識別子の作り方が実装者ごとに分かれる。ORCID iD をURI形式で持つ利用側の照合で `no_match` になりうる。
- 提案: 「外部認証と登録の接続」節に、Provider ごとの対応表（固有ID・ユーザー名・プロフィールURL・表示名の取得元）を加える。前回レビューの R08 と同時に決める。PKCE の可否は [v0.1.md:111](../implementation-plan/v0.1.md) の実通信の検証で確認する。

#### M38 OAuthのメールアドレスの保存先とJSONでの除外

- 事実: [main.ja.md:619](../specification/v0.1/main.ja.md) は、OAuth のメールアドレスを複数アカウントを見分ける補助情報として本人に表示する。[main.ja.md:843](../specification/v0.1/main.ja.md) の `external_accounts` にも、標準の `account`（[main.ja.md:820](../specification/v0.1/main.ja.md)）にもメールの列は無い。[main.ja.md:634](../specification/v0.1/main.ja.md) は JSON から除外する。
- 影響: 表示の元データが無い。復元・移行の後に同じ表示名の Google アカウントを見分けにくい（C2-11。再認証で対応付くので実害は小さい）。
- 提案: `external_accounts` に本人向けだけの `email TEXT?` を加えるか、表示時に Provider から取得すると1文で決める。

#### M39 シーケンス図にDPoPの手順が無い

- 事実: [main.ja.md:498-503](../specification/v0.1/main.ja.md) の図は「Client Credentialsでクライアント認証」「Access Tokenと識別子配列で一括照合」とだけ書く。[main.ja.md:240](../specification/v0.1/main.ja.md) は DPoP proof を要求する。[main.ja.md:899](../specification/v0.1/main.ja.md) は図を仕様の変更時に更新するとする。
- 影響: 図だけを読んだ利用側の実装者が DPoP proof を漏らしうる。本文に記載があるので影響は小さい。
- 提案: 図のラベルに `private_key_jwt` と DPoP proof を加える。

#### M40 表示と提供する情報の一覧に証拠URLが無い

- 事実: [main.ja.md:399・401](../specification/v0.1/main.ja.md) の API は `evidenceUrl` を返す。[main.ja.md:620](../specification/v0.1/main.ja.md) の一般公開・OAuthクライアント向けの項目に証拠URLは無い。
- 影響: 提供項目の一覧と API が一致しない。影響は小さい。
- 提案: [main.ja.md:620](../specification/v0.1/main.ja.md) に「証拠URL」を加える。

#### M41 Points側文書の照合入力にユーザー名が無い

- 事実: [unclaimed-fix-and-ownership.md:48](../../../points-web-app/docs/v0.2/details-ja/unclaimed-fix-and-ownership.md) は「Accounts APIはプロフィールURL・外部サービス名と固有ID・AccountsユーザーIDを受け付ける」とする。[main.ja.md:199](../specification/v0.1/main.ja.md) は「外部サービス名と固有IDまたはユーザー名」を受け付ける。
- 影響: Points の CSV 列の設計で、ユーザー名の列が検討から漏れうる。
- 提案: Points 側の文書で「外部サービス名と固有IDまたはユーザー名」とする。

#### M42 自己ホスト型でないProviderにissuerが送られた場合

- 事実: [main.ja.md:419](../specification/v0.1/main.ja.md) は、自己ホスト型の Provider では `issuer` を必須とし、それ以外では省略を標準形とする。[main.ja.md:427](../specification/v0.1/main.ja.md) は不明な項目を入力エラーにする。
- 影響: `github` で `issuer` を送った場合に、受け付けて無視するのかエラーにするのかが決まらない。
- 提案: 「自己ホスト型でないProviderで`issuer`を指定した場合は`INVALID_VALUE`とする」などを1文書く。前回レビューの R09 と同時に決める。

#### M43 401と403のWWW-Authenticateの扱い

- 事実: [main.ja.md:453-454](../specification/v0.1/main.ja.md) は、401・403 の JSON body だけを定める。標準の `verifyAccessTokenRequest` は `WWW-Authenticate` 付きの401を送出する（A1-17・A2-08 の記録）。RFC 9449 7.1節は、DPoP の401に `DPoP` のチャレンジを付けるとする。[main.ja.md:237](../specification/v0.1/main.ja.md) のクライアント削除後の要求を401と403のどちらにするかも書かれていない。
- 影響: ヘッダーを残すかどうかが実装者で分かれ、DPoP 対応の標準ライブラリの再試行・診断が効かないことがある。
- 提案: 「401・403では標準の`WWW-Authenticate`を維持し、bodyは本表の形式とする。削除・無効化したクライアントのトークンは401とする」と書く。

#### M45 照合の分割読取とクエリ数

- 事実: [main.ja.md:881](../specification/v0.1/main.ja.md) は、照合の最大1,000件を1クエリ100バインド変数の上限内で分割して読むとする。D1 の1呼出しのクエリ数は Free 50・Paid 1,000 である。D1 公式は `json_each(?)` に配列を1つのバインド値で渡す例を示す（調査担当の取得）。
- 影響: 分割すると約30〜40文になり、Free プランの上限に近い（推計）。`batch()` 内の文が呼出しのクエリ数に数えられるかは未確認である。前回レビューの R41（前提とするプラン）と関連する。
- 提案: [main.ja.md:881](../specification/v0.1/main.ja.md) の「読取を分割する」を、「`json_each`で入力配列を1つのバインド値として渡す」に置き換えるか、実装方法を固定しない表現にする。

#### M48 鍵のローテーション手順とJWTが失効できないこと

- 事実: [main.ja.md:168-169](../specification/v0.1/main.ja.md) は鍵の更新と、認可・保存トークンの失効に標準の操作を使うことを定める。[main.ja.md:234](../specification/v0.1/main.ja.md) は Access Token を15分とする。公式文書には、インラインの JWKS は複数の鍵を持てること、JWT の Access Token はサーバー側で失効できないことが書かれている（A2-03 の記録）。
- 影響: 鍵を差し替えても、発行済みの Access Token は最長15分使える。新旧の鍵を併存させて切り替える手順も無い。
- 提案: 「JWKSに新旧の鍵（`kid`）を併存させて切り替える」「JWTのAccess Tokenは失効できず、鍵の更新後も最長15分有効である。即時に止める場合はクライアントを削除・無効化する」の2点を書く。M01 の判断とあわせて決める。

#### M49 資源APIの頻度制限と429

- 事実: [main.ja.md:558](../specification/v0.1/main.ja.md) は、資源APIに入力件数・容量の上限だけを適用する。[main.ja.md:446-457](../specification/v0.1/main.ja.md) のエラー表に429は無い。[v0.1.md:92](../implementation-plan/v0.1.md) は、Web検証・一般APIを WAF で制限するとする。
- 影響: 同意を持たないクライアントでも1,000件の照合を繰り返し送れ、D1 の処理が遅れうる（推測）。WAF が返す429は表の形式にならない。
- 提案: [main.ja.md:558](../specification/v0.1/main.ja.md) に「`/api/v1/*`にもWAFのRate Limitingを適用する」と書き、表に429（WAF の応答形式。利用側は HTTP ステータスで判定する）を1行加える。

#### M50 運営者によるクライアントの停止

- 事実: [main.ja.md:167](../specification/v0.1/main.ja.md) で、クライアントを管理・削除できるのは登録者だけである。1.7.5 の create の入力に `disabled` がある（OP:2190）。運営者による停止と、ban された登録者のクライアントの扱いは書かれていない。
- 影響: 誰でも登録できる構成なのに、運営者が悪用されたクライアントを止める手順が無い。
- 提案: 「運営者は標準の`disabled`でクライアントを停止でき、停止中は認可とAPI提供を拒否する」を、M17 の決定と合わせて書く。

#### M56 解除でのtoken失効と最後のログイン手段の判定の順序

- 事実: [main.ja.md:137](../specification/v0.1/main.ja.md) は、残るログイン手段の条件を確認して認証連携も解除するとする。[main.ja.md:535-537・876](../specification/v0.1/main.ja.md) は、外部で失効を確認してから解除するとする。
- 影響: 最後のログイン手段を含む行の解除で、行全体を拒否するのか、Web証明だけを終了するのかが決まらない。失効を先に行い、その後に標準の解除が拒否すると、外部の token だけが失効する。
- 提案: [main.ja.md:137](../specification/v0.1/main.ja.md) か [main.ja.md:876](../specification/v0.1/main.ja.md) に「最後のログイン手段と操作条件を先に確認し、満たさない場合は何も変更しない。満たす場合に外部tokenを失効してから解除する」を1文加える。

#### M57 OAuthの証明だけを解除する操作が無い

- 事実: [main.ja.md:876](../specification/v0.1/main.ja.md) の前半は、OAuth の解除でほかの方法が支える識別子を残すとし、[v0.1.md:118](../implementation-plan/v0.1.md) はこれを検証対象にする。一方、[main.ja.md:137](../specification/v0.1/main.ja.md) の画面の解除は行全体を対象にし、[main.ja.md:594・599](../specification/v0.1/main.ja.md) に方法単位の解除操作は無い。
- 影響: [main.ja.md:876](../specification/v0.1/main.ja.md) 前半の規則が、どの操作で起きるのかが分からない。
- 提案: 画面に「OAuthの認証連携だけ解除する」操作を加えるか、[main.ja.md:876](../specification/v0.1/main.ja.md) の前半を行全体の解除に揃えて [v0.1.md:118](../implementation-plan/v0.1.md) の検証対象を合わせる。

#### M58 唯一のログイン手段で作った別ユーザーからの移動が行き止まりになる

- 事実: [main.ja.md:139](../specification/v0.1/main.ja.md) は、別ユーザーに連携済みなら元ユーザーでの解除を案内する。[main.ja.md:138](../specification/v0.1/main.ja.md) は元ユーザーに別のログイン手段を残すとし、[main.ja.md:125](../specification/v0.1/main.ja.md) は最後のログイン手段の解除を許可しない。メールの異なる Provider でログインすると新規ユーザーが作られる（[main.ja.md:117](../specification/v0.1/main.ja.md)）。BA `api/routes/callback.mjs`:180 は `account_already_linked_to_different_user` を返す。
- 影響: 誤って作ったユーザーのログイン手段が1つだけだと、案内どおりに操作しても完了できない。
- 提案: [main.ja.md:139](../specification/v0.1/main.ja.md) に「元ユーザーのログイン手段がそれだけの場合は、元ユーザーの退会後に連携するよう案内する」を加える。

#### M59 解除後もuser.emailが残り同じメールで新規登録できない

- 事実: `user.email` は一意である。標準の解除は `user.email` を変えない。`disableImplicitLinking` の下では、未連携のアカウントのメールが既存ユーザーと一致すると `account_not_linked` になる（BA `oauth2/link-account.mjs`:79-82）。[main.ja.md:531](../specification/v0.1/main.ja.md) は、メールアドレスにかかわらず Provider と固有IDで判定するとする。
- 影響: 解除した Google アカウントで新規登録しようとすると、登録ではなく `account_not_linked` になる。
- 提案: [main.ja.md:834](../specification/v0.1/main.ja.md) の内部用の一意な値をすべての Provider に広げるか、最低限 [main.ja.md:138](../specification/v0.1/main.ja.md) に「解除後も元ユーザーに同じメールが残る場合は、既存ユーザーへの連携で移す」を書く。

#### M60 退会時に外部のtokenを失効するか

- 事実: 解除では外部での失効の確認を完了の条件にする（[main.ja.md:535-537](../specification/v0.1/main.ja.md)）。退会では、認証情報とトークンの削除だけを定める（[main.ja.md:572-574](../specification/v0.1/main.ja.md)）。
- 影響: 退会で失効するのか、失効に失敗したら退会を止めるのかが決まらない。失効しない場合、各 Provider の連携アプリ一覧に Accounts が残る。
- 提案: [main.ja.md:574](../specification/v0.1/main.ja.md) に、例えば「退会では外部tokenの失効を試み、失敗しても退会を完了する」を1文加える。

#### M69 150件の数え方を表の列で判定できない

- 事実: [main.ja.md:852](../specification/v0.1/main.ja.md) は、150件を `kind='url'` の本人行数で検査するとする。URL の行は、本人の入力のほかに、証明から導出したプロフィールURLや OAuth の証明の対象URLとしても作られる（[main.ja.md:873](../specification/v0.1/main.ja.md)、[main.ja.md:358-361](../specification/v0.1/main.ja.md)）。[main.ja.md:844](../specification/v0.1/main.ja.md) に行の出どころを表す列は無い。[main.ja.md:132](../specification/v0.1/main.ja.md) は OAuth の連携数に上限を設けない。
- 影響: 前回レビューの R25 を「本人が登録したURLだけを数える」と決めると、現在の表では区別できない。
- 提案: R25 を決めるときに、数える対象を表の列で判定できるかを併せて確認する（例: 登録元を表す列を加える、または `kind='url'` の全行を数えると明記する）。

#### M70 連携日時と検証日時の更新規則と証明を失った識別子の扱い

- 事実: [main.ja.md:843](../specification/v0.1/main.ja.md) の `linked_at` は NULL を許し、[main.ja.md:854](../specification/v0.1/main.ja.md) は `verified_at` を「現在有効な成功の日時」とする。[main.ja.md:874](../specification/v0.1/main.ja.md) の再検証と [main.ja.md:876](../specification/v0.1/main.ja.md) の OAuth 解除で、日時の更新と、証明を失った識別子を残すか削除するかが書かれていない。
- 影響: 表示と JSON 出力の値が実装で分かれる。照合と提供の正しさには影響しない（[main.ja.md:877](../specification/v0.1/main.ja.md) が読み取り時に確認する）。
- 提案: [main.ja.md:854](../specification/v0.1/main.ja.md) 付近に、`linked_at`・`verified_at` の更新規則と、証明を失った識別子を `is_active=0` の候補として残すか削除するかを1〜2文書く。

#### M77 5MiBの復元を1 batchで処理できる保証が無い

- 事実: [main.ja.md:881](../specification/v0.1/main.ja.md) は、5MiB・登録URL150件までの有効な復元入力を処理できることを実装時に確認するとする。件数の上限は URL の150件だけで、[main.ja.md:645](../specification/v0.1/main.ja.md) は存在しない Client ID の設定も保持する。
- 影響: 意図的に巨大な JSON を作ると、1 batch に収まらない見込みである（推測）。通常の利用では問題にならないが、[main.ja.md:881](../specification/v0.1/main.ja.md) の確認義務をそのままでは満たせない。
- 提案: `clientConsents`・`clientVisibility`・外部アカウント数に上限を置き、[main.ja.md:881](../specification/v0.1/main.ja.md) の文を「定めた件数上限までの入力」に置き換える。M45 の `json_each` を採れば文の数は減る。

#### M78 復元候補の過去情報を出力する方法

- 事実: [main.ja.md:854](../specification/v0.1/main.ja.md) は `imported_verifications_json` を本人向けの参考とする。[main.ja.md:659-664](../specification/v0.1/main.ja.md) の JSON 形式に対応する項目は無い。[main.ja.md:633](../specification/v0.1/main.ja.md) は出力時点の証明状態を区別できる情報を記録するとする。
- 影響: 復元した候補をもう一度出力するとき、過去の証明を落とすのか `verifications` に混ぜるのかが決まらない。混ぜると、移行先で現在の証明に見える。
- 提案: [main.ja.md:663](../specification/v0.1/main.ja.md) か [main.ja.md:854](../specification/v0.1/main.ja.md) に「出力の`verifications`は現在の証明行だけから作り、`imported_verifications_json`は出力しない（または別項目で出す）」と1文書く。

#### M79 復元の入力検査で扱う重複と欠落

- 事実: [main.ja.md:642](../specification/v0.1/main.ja.md) の重複検査は、同じ正規化URLと、同じサービス名・固有IDだけである。`clientConsents` 内の同じ `clientId`、`clientVisibility` 内の同じ `clientId`、ユーザー名・`issuer` を含む重複は対象外である。[main.ja.md:648](../specification/v0.1/main.ja.md) の「バックアップに含まれていない」が何を指すかも書かれていない。
- 影響: JSON を手で編集した場合に、処理順で結果が変わる。
- 提案: [main.ja.md:642](../specification/v0.1/main.ja.md) を「同じClient ID・同じ識別子キー（`kind, provider, issuer, value`）の重複で値が食い違わないこと」に一般化し、[main.ja.md:648](../specification/v0.1/main.ja.md) の意味を `clientConsents` に無いことと定義する。

#### M80 移行できる範囲と移行先で必要な再操作

- 事実: [main.ja.md:901](../specification/v0.1/main.ja.md) は、ヘルプでバックアップと移行の扱いを説明するとする。[main.ja.md:628-634](../specification/v0.1/main.ja.md) に、移行できる範囲とできない範囲の一覧は無い。前回レビューの R28 の別の側面である。
- 影響: 移行先では、すべての所有権証明と情報提供同意のやり直しが要る。利用者はこの手間を事前に知ることができない。
- 提案: [main.ja.md:628](../specification/v0.1/main.ja.md) の近くに、v0.1 で移行できる範囲と移行先で必要な再操作を2〜3行で書き、ヘルプはそれを参照する。

#### M85 cookieCacheの管理操作の範囲

- 事実: [main.ja.md:921](../specification/v0.1/main.ja.md) は「管理操作で最新のセッションを確認するときは標準`disableCookieCache`でDB状態を読む」とする。公式文書 `concepts/session-management` は、cookieCache が有効だと、失効したセッションも `maxAge` まで有効に見えるとする。
- 影響: ban・退会・セッションの失効の後、他の端末で最大1時間、状態変更APIを通過しうる（推測）。
- 提案: 「管理操作」を「セッション本人による状態変更API全般とOAuth同意」と明記する。

#### M90 受け入れ条件にあって本文に定義が無い項目

- 事実: [main.ja.md:793](../specification/v0.1/main.ja.md) の「前回ログイン方法」「同一ブラウザーのユーザー切り替え」は、[main.ja.md:932・933](../specification/v0.1/main.ja.md) のプラグイン表と [main.ja.md:819](../specification/v0.1/main.ja.md) にしか現れない。[main.ja.md:801](../specification/v0.1/main.ja.md) の Preview の「共有データ」は [v0.1.md:86](../implementation-plan/v0.1.md) にだけある。[main.ja.md:789](../specification/v0.1/main.ja.md) は参照先を正とするが、表の各行に参照先のリンクが無い。
- 影響: テストの合否基準を実装者が作ることになる。Multi Session と同意画面の組み合わせでは、誤った本人で同意するおそれがある（推測）。
- 提案: 「認可要求時は現在のアクティブセッションの本人を表示する」などを本文に1文書き、表の各行に参照先のリンクを付ける。

#### M91 v0.1で実装する機能の表に無い機能

- 事実: [main.ja.md:89-100](../specification/v0.1/main.ja.md) の表に、Admin（[main.ja.md:937](../specification/v0.1/main.ja.md)）、監査（[main.ja.md:608-613](../specification/v0.1/main.ja.md)）、日英UI（[main.ja.md:603](../specification/v0.1/main.ja.md)）、OSSライセンスページ（[main.ja.md:943](../specification/v0.1/main.ja.md)）、OpenAPI の表示（[main.ja.md:584](../specification/v0.1/main.ja.md)）、公開ヘルプ・プライバシー説明（[main.ja.md:901](../specification/v0.1/main.ja.md)）が無い。
- 影響: 表を機能の全体像として読むと、これらが範囲外に見える。受け入れ条件（[main.ja.md:800](../specification/v0.1/main.ja.md)）とも一貫しない。
- 提案: 表に「管理画面（日英・監査・OpenAPI・OSSライセンス・ヘルプ）」の行を足す。ヘルプ・プライバシー説明は計画と受け入れ条件にも1語足す。

#### M92 実装計画のフェーズとの対応漏れ

- 事実: [v0.1.md:94](../implementation-plan/v0.1.md) はログ項目の方針だけで、[main.ja.md:608-609](../specification/v0.1/main.ja.md) の監査イベントを記録する作業が無い。[v0.1.md:109](../implementation-plan/v0.1.md) は「暗号化」だけで、[main.ja.md:525](../specification/v0.1/main.ja.md) の versioned secrets の運用が無い。
- 影響: 監査イベントと secrets の運用が、実装で漏れやすい。
- 提案: [v0.1.md:94](../implementation-plan/v0.1.md) に「main.ja.md:608-609 のイベントを記録する」を、[v0.1.md:109](../implementation-plan/v0.1.md) 付近に versioned secrets の切り替え手順を1行加える。

#### M93 用語の使い分け

- 事実: `main.ja.md` では、「連携」（107回）が外部アカウントの連携、サービスとの連携、連携先など複数の意味で使われる。「公開設定」（51回）は広義と狭義が混在する。「提供許可」（14回）は定義文が無い。「識別情報」「識別子」「外部ID」が並存する。
- 影響: [main.ja.md:609](../specification/v0.1/main.ja.md) の監査対象「公開許可の変更」と、[main.ja.md:564](../specification/v0.1/main.ja.md) の「公開設定の変更」に、同意の ON/OFF が含まれるかが読み取れない。実装上は同じ保存APIなので実害は小さい。
- 提案: 「説明」節に用語を数行で定義する（外部アカウントの連携とサービス連携、情報提供同意、公開選択、提供許可）。[main.ja.md:609](../specification/v0.1/main.ja.md) は「情報提供同意・公開選択の変更」と書く。

## 5. 懸念のみ

現実的なフローでの実害が小さいもの、または仕様の意図として読めるものである。
いずれも**修正は不要**である。
5.1 はトリアージで個別に言及したもの、5.2 はレビュー担当の区分（懸念のみ）を維持したものである。

### 5.1 トリアージで列挙したもの

#### B2-08（M21の一部）purge対象の列挙

- 事実: [v0.1.md:77](../implementation-plan/v0.1.md) と [v0.1.md:138](../implementation-plan/v0.1.md) の purge の対象・確認観点に、再検証、ログイン時の外部表示名の更新、証明方法の追加、OAuth の部分解除、復元による一般公開の変更が明示されていない。Workers Cache の purge は全データセンターへ伝播する（公式文書）。
- 懸念のみとする理由: [main.ja.md:942](../specification/v0.1/main.ja.md) の「公開情報のDB更新後に該当プロフィールのキャッシュをpurgeする」という一般則と、[v0.1.md:77](../implementation-plan/v0.1.md) の「など」で、対象は読み取れる。修正は不要である。

### 5.2 レビュー担当の区分を維持したもの

| 統合ID | 内容 | 事実と、懸念のみとする理由（修正は不要） |
| --- | --- | --- |
| M44 | 署名付き認可要求が10分で失効する | OP:5745-5747 は `codeExpiresIn ?? 600` で失効させる。同意画面の途中で外部アカウントの追加に時間をかけると失効するが、保存済みの設定は残り（[main.ja.md:166](../specification/v0.1/main.ja.md)）、連携元から再開できる |
| M46 | クライアントアサーションと DPoP proof の記録行が自動で消えない | 公式文書 `plugins/oauth-provider` 2164行に、定期的な削除は無いとある。Points の利用量では当面小さく、運用で掃除を検討すれば足りる |
| M47 | FAPI 2.0 への言及 | [main.ja.md:242](../specification/v0.1/main.ja.md) の言及は準拠と誤読されうるが、利用側は同じ運営の Points である。署名方式は M36 の設定表で決めればよい |
| M52 | `accounts_user` の形式検査 | [main.ja.md:257・413](../specification/v0.1/main.ja.md) の例は `ausr_` 形式でない（前回 R49 と同種）。形式不正を `invalid_input` と `no_match` のどちらにしても情報は漏れない |
| M53 | 一覧取得の body の上限 | [main.ja.md:422・456](../specification/v0.1/main.ja.md) の上限は一括照合だけに定める。一覧取得の body は Workers の既定の上限で止まる |
| M54 | 退会で消えるクライアントについて、他ユーザーの同意行を消すか | [main.ja.md:856](../specification/v0.1/main.ja.md) で表示は有効なクライアントに限られ、[main.ja.md:879](../specification/v0.1/main.ja.md) も同じ Client ID の設定の保持を認めている。残るのは孤立データだけである |
| M61 | 同じ外部アカウントへの連携の競合 | 一意性は [main.ja.md:828・844](../specification/v0.1/main.ja.md) の制約で保たれる。競合には同一人物が別ユーザーで同時に操作する必要があり、現実的でない |
| M62 | 組織アカウントの取り合い | 前回レビューの R59 の別側面である。R59 の提案（組織のプロフィールページの証拠に限る）を採れば解消する |
| M63 | 表示名の入力規則 | [main.ja.md:105](../specification/v0.1/main.ja.md) は最大50文字だけを定める。共有の Valibot schema で画面とバックエンドを揃えれば問題にならない |
| M64 | 登録者が退会すると全利用者の連携が終わる | [main.ja.md:571・573](../specification/v0.1/main.ja.md) のとおりの仕様で、退会確認画面に終了するクライアントを表示する |
| M66 | 再登録で公開プロフィールURLが変わる | 新しい `ausr_` ID が発行される（[main.ja.md:810](../specification/v0.1/main.ja.md)）ので、外部ページのリンクの張り替えが要る。確認画面に一言加える程度でよい |
| M67 | Accounts 側から連携を始める入口 | [main.ja.md:81](../specification/v0.1/main.ja.md) は入口を2つ用意するとするが、[main.ja.md:580-602](../specification/v0.1/main.ja.md) の画面に Accounts 側の開始操作は無い。OAuth はクライアントが開始するので、[main.ja.md:81](../specification/v0.1/main.ja.md) の言い換えで足りる |
| M72 | `evidence_key` と `auth_account_id` が同じ値を持つ | [main.ja.md:845・854](../specification/v0.1/main.ja.md)。冗長だが、解除して再連携しても新しい `account.id` になるので UNIQUE は衝突しない |
| M73 | 証明と識別子の `account_id` の一致を DB で守っていない | [main.ja.md:852](../specification/v0.1/main.ja.md) が保存処理で確認すると定めている。実装の誤りへの防御にとどまる |
| M74 | Drizzle の relations と `relationName` | [main.ja.md:883・920](../specification/v0.1/main.ja.md) は公式と一致する。relations v2 を採る場合に `alias` へ合わせればよい |
| M75 | 列の NULL 可否と `client_consents.display_name` の出典 | [main.ja.md:399・661・847](../specification/v0.1/main.ja.md)。一覧は有効なクライアントを表示する（[main.ja.md:856](../specification/v0.1/main.ja.md)）ので、画面への影響は無い |
| M76 | ER図に `account` と証明の関連が無い | [main.ja.md:858-869](../specification/v0.1/main.ja.md) の図に `auth_account_id` の関連が無いが、[main.ja.md:845](../specification/v0.1/main.ja.md) の表に外部キーがある。直すなら1行の追加 |
| M81 | 5MiB 超過の通知とストリーミング出力 | [main.ja.md:631](../specification/v0.1/main.ja.md) と [v0.1.md:102](../implementation-plan/v0.1.md)。出力は数百KB程度の見込みで、全体を組み立てて大きさを確認してから返せば解消する |
| M82 | 復元で、連携を開始していないクライアントへの同意を作れる | [main.ja.md:166・645](../specification/v0.1/main.ja.md)。本人が自分の提供を決める操作で、他者への被害は無い |
| M84 | 冗長な既定値と完全なキー | `updateAccountOnSignIn` は既定で有効（BA `oauth2/link-account.mjs`:148）、`allowUnlinkingAll` の既定は無効（BA `api/routes/account.mjs`:277）。意図の明示として残してよい。キーの書き方は M16 で直す |
| M86 | Better Auth 1.7.0〜1.7.2 の `account.issuer` 列 | 移行ガイドによれば 1.7.3 で撤回された（報告者の記録に依拠）。新規導入では最新版を選ぶので実害は小さい |
| M87 | `advanced.backgroundTasks.handler` の影響範囲 | [main.ja.md:923](../specification/v0.1/main.ja.md)。この構成で後回しになるのはレート制限表の掃除だけで、「応答の成立に必要な保存は完了を待つ」と矛盾しない |
| M88 | Workers Cache の入口別の範囲と Preview | purge は呼び出した入口のキャッシュにだけ効く（公式文書）。[v0.1.md:81](../implementation-plan/v0.1.md) は専用の入口からの purge を定めている。Preview ごとの独立は実装時に検証すればよい |
| M94 | 3つの状態の列挙と、API で到達しない値 | [main.ja.md:263-267・397・401](../specification/v0.1/main.ja.md)。クライアント向けでは `verificationStatus` が常に `verified` になるが、判定の誤りにはつながらない |
| M95 | OSS としての本体のライセンス | [main.ja.md:905・943](../specification/v0.1/main.ja.md)。本体のライセンスはリポジトリの LICENSE で決められ、実装は進められる |

確認のみで懸念なし（7件）:

- M51: 同意 OFF/ON での選択の保持と、照合APIで存在を推測できる経路が無いこと（[main.ja.md:176-177・189・257・428・856](../specification/v0.1/main.ja.md)）。
- M65: 別ユーザーに連携済みの OAuth を連携しようとした場合の標準の結果（BA `api/routes/callback.mjs`:180）が、[main.ja.md:139](../specification/v0.1/main.ja.md) と整合すること。
- M68: 一般公開・同意・クライアント別の公開の3層が、画面・API・公開プロフィール・JSON で同じ意味であること（[main.ja.md:596-599・877](../specification/v0.1/main.ja.md)）。
- M71: Web識別子の移動を、制約違反を起こさない文の順序で1 batch に収められること（[main.ja.md:844・875](../specification/v0.1/main.ja.md)）。削除対象の証明は、事前に読み取った今回のキーに関連する証明に限る必要がある（実装の注意）。
- M83: JSON 形式・token の除外・復元の検査順（[main.ja.md:634・639・659](../specification/v0.1/main.ja.md)）。
- M89: Hono の `app.query()` は 4.13.0 で追加されており、[v0.1.md:45](../implementation-plan/v0.1.md) と矛盾しないこと。
- M96: v0.2・v0.3 の文書のその他の記述が v0.1 と矛盾しないこと（[v0.2/main.ja.md](../specification/v0.2/main.ja.md) の DID、[v0.3/main.ja.md:18-20](../specification/v0.3/main.ja.md) の共同管理）。

## 6. 付記

本レビューの対象（v0.1）の外の文書だが、確認の過程で見つけたため記録する。

- M31 v0.2 実装計画のリンク切れと、JSON一括登録の提供版の食い違い（元ID D2-12）
  - [implementation-plan/v0.2.md:5](../implementation-plan/v0.2.md) は `../specification/v0.2/main.md#v02で追加する機能` を参照するが、v0.2 のディレクトリには `main.ja.md` しか無い。
  - 同じ計画は「JSONアップロードによるWeb URLの一括登録・一括検証」を v0.2 の作業とする。しかし [v0.2/main.ja.md:11-21](../specification/v0.2/main.ja.md) の「v0.2で追加する機能」に一括登録は無く、[v0.3/main.ja.md:21-26](../specification/v0.3/main.ja.md) に v0.3 の機能として書かれている。
  - 提供版を決め、[implementation-plan/v0.2.md](../implementation-plan/v0.2.md) を削除するか v0.3 の計画へ移し、リンクを `main.ja.md` に直すのがよい。
  - v0.3 側のリンク切れ（`../v0.1/main.md`、`../../implementation-plan/v0.3.md`）は前回レビューの R50 で既出である。
- M06 Points 側文書から `specification/v0.1/main.md` へのリンク切れ（元ID A2-06、B2-07）
  - 前回レビューの付記に既出である（points-web-app の docs 配下の11箇所）。
  - 今回 grep で確認した docs 配下の11箇所は、`docs/v0.2/index.ja.md`:19、`csv-export.md`:18、`unclaimed-fix-and-ownership.md`:11・40・44・104、`points-domain.md`:22・43・139・252、`docs/readme/README.ja.md`:13 である。前回の11箇所と同じ集合である。
  - 新しい側面として、plan 配下にも5箇所ある。[v0.2-implementation.md:13・426・450・472](../../../points-web-app/plan/v0.2-implementation.md) と、`plan/archive/prototype-scraping-site-account.md`:5 である。
  - 調査担当 A2-06 は、このうち `v0.2-implementation.md`:13 に触れていた。
  - 前回付記と同じく `main.ja.md` へのリンクに直す際に、plan 配下の5箇所も含めるのがよい。

## 7. 統合指摘の全一覧

レビュー担当の統合一覧（元ID一覧と 2.1・2.2 節）から転記した。
最終区分はトリアージの結果である。
トリアージでレビュー担当の区分を上書きしたものは、備考に「管理者判断で変更」と書いた。
統合行の区分は、含まれる元IDのうち最も高い区分を採る。元IDごとの判定が統合後の区分と異なる A1-19・D1-16（M37）、A1-20（M45）、A2-21（M33）、C2-11（M38）は、統合後の区分に揃えた。
M55 は統合一覧に存在しない欠番である。
調査担当 D-2 の0章（目次・リンクの機械的な確認）は、指摘IDを持たない確認結果で、問題は無かった。

| 統合ID | 元ID | タイトル | 最終区分 | 備考 |
| --- | --- | --- | --- | --- |
| M01 | A1-01、A2-04 | 公開鍵の更新が標準に無く、登録時の必須項目も合わない | 要修正 | 仕様作成者の判断事項あり |
| M02 | A1-02、A2-02 | JWKS URI は trusted origin が必須 | 要修正 | 軽微 |
| M03 | A1-03 | localhost の redirect URI の規定が標準と食い違う | 要修正 | 仕様作成者の判断事項あり |
| M04 | A1-04、B1-08、C1-13、D1-06 | 新規ユーザーの初期表示名 | 要修正 | 軽微。C1-13（記載追加）はレビュー担当が上げた |
| M05 | A1-05、A2-05、B2-06、D2-13、B1付記 | Points 側文書が Client Secret を前提にしている | 要修正 | 修正先は Points 側文書 |
| M06 | A2-06、B2-07 | Points 側文書から `v0.1/main.md` へのリンク切れ | 付記 | 既出（前回レビューの付記）。plan 配下の5箇所を追加 |
| M07 | A2-01、B2-02 | 既存の `oauthConsent` があると同意画面が省かれる | 要修正 | 仕様作成者の判断事項あり。修正案は管理者判断で変更 |
| M08 | B2-01、A2-13 | 同意画面を終えるときの操作 | 記載追加が望ましい | B2-01（要修正）をレビュー担当が下げた |
| M09 | B2-03、A2-09 | 同意画面に示す「利用目的」の出典 | 記載追加が望ましい | B2-03（要修正）をレビュー担当が下げた |
| M10 | A2-10、B2-12 | 同意画面でクライアントを名前でしか識別できない | 記載追加が望ましい | |
| M11 | A2-14、B2-04 | 保存ボタンを非活性にする条件 | 要修正 | 軽微 |
| M12 | A2-15、B2-05、C2-04 | 同意ONで選択0件の状態が、解除・移動・復元で生じる | 記載追加が望ましい | A2-15（懸念のみ）を含む |
| M13 | B1-02、C1-04、D1-03 | 解除・退会と fresh session | 要修正 | 軽微。C1-04（記載追加）はレビュー担当が上げた |
| M14 | C1-01、B1-03（削除側） | 独自表の外部キーの削除時動作と、標準の削除との接続 | 要修正 | |
| M15 | C1-03、B2-10、B1-03（連携側）、A1-11（接続点） | 標準 `account` から独自表を作る契機と、失敗時の再構成 | 記載追加が望ましい | B1-03 の連携側（要修正）をレビュー担当が下げた |
| M16 | B1-01、D1-01 | 追加連携の `trustedProviders` | 要修正 | 軽微 |
| M17 | B1-09、D2-03、D1-08（関連 A2-12、B2-09） | Admin プラグインと `appAdmin` の権限 | 要修正 | 仕様作成者の判断事項あり。D1-08（記載追加）はレビュー担当が上げた |
| M18 | C2-01、D2-06、B1-13 | 別ユーザー・別 origin の JSON を復元した場合 | 記載追加が望ましい | C2-01・D2-06（要修正）をレビュー担当が下げた |
| M19 | C2-02 | 復元時に JSON の外部アカウントを既存行へ対応付ける規則 | 記載追加が望ましい | C2-02（要修正）をレビュー担当が下げた |
| M20 | C2-03 | 候補の `service`・`displayName` を JSON から採るか | 記載追加が望ましい | 管理者判断で変更（レビュー担当・検証担当は要修正） |
| M21 | D1-05、B1-12、B2-08 | Workers Cache の purge の頻度制限と TTL | 記載追加が望ましい | D1-05（要修正）をレビュー担当が下げた。B2-08 の論点は懸念のみ |
| M22 | C1-02 | OAuth 証明が、他ユーザーに有効なユーザー名・URLと衝突する | 記載追加が望ましい | 前回 R58 の別経路。C1-02（要修正）をレビュー担当が下げた |
| M23 | D1-02 | 認証APIのレート制限が Workers で有効にならないおそれ | 要修正 | 軽微。検証担当は条件付きで同意 |
| M24 | D1-04 | Open API プラグインの用途 | 記載追加が望ましい | D1-04（要修正）をレビュー担当が下げた |
| M25 | D2-01 | 受け入れ条件に退会が無い | 要修正 | 軽微 |
| M26 | D2-02（token 失効以外） | 受け入れ条件に所有権の異常系が無い | 記載追加が望ましい | レビュー担当が下げた |
| M27 | D1-07、D2-02（token 部分）、D2-09（token 部分） | Provider 側の token 失効が標準機能に無く、計画にも無い | 記載追加が望ましい | D2-02 の token 部分（要修正）をレビュー担当が下げた |
| M28 | D2-04 | 「要件確定後の確認事項」に未決事項が無い | 記載追加が望ましい | D2-04（要修正）をレビュー担当が下げた |
| M29 | D2-05、C2-09 | v0.2 文書が v0.1 に設計要件と完了条件を課している | 要修正 | 仕様作成者の判断事項あり。C2-09（記載追加）はレビュー担当が上げた |
| M30 | D2-11 | 実装計画 `v0.1.md`:109 のリンク先の誤り | 要修正 | 軽微 |
| M31 | D2-12 | v0.2 実装計画のリンク切れと、JSON一括登録の提供版の食い違い | 付記 | 管理者判断で変更（レビュー担当は要修正・軽微）。v0.1 の対象外 |
| M32 | A1-06 | client_credentials の scope は管理用APIでしか付与できない | 記載追加が望ましい | 計画 `v0.1.md`:113 で対応済み |
| M33 | A1-07、A2-21 | resource の allowedScopes で openid が落ちる。トークンの用途の判定方法 | 記載追加が望ましい | A2-21（懸念のみ）を含む |
| M34 | A1-08 | `iss` と `accountsOrigin` の対応 | 記載追加が望ましい | |
| M35 | A1-09、D1-10 | `user.id` を `ausr_` 形式にする設定 | 記載追加が望ましい | |
| M36 | A1-10、D1-09 | OAuth Provider・JWT の必須設定が設定表に無い | 記載追加が望ましい | |
| M37 | A1-11、A1-19、D1-16 | Provider ごとの識別子の対応。ORCID の注意 | 記載追加が望ましい | A1-19・D1-16（懸念のみ）を含む。PKCE は証拠不十分。R08 と同時に決める |
| M38 | A1-12、C2-11 | OAuth のメールの保存先と、JSON での除外 | 記載追加が望ましい | C2-11（懸念のみ）を含む |
| M39 | A1-13 | シーケンス図に DPoP が無い | 記載追加が望ましい | |
| M40 | A1-14 | 表示・提供する情報に証拠URLが無い | 記載追加が望ましい | |
| M41 | A1-15 | Points の照合入力にユーザー名が無い | 記載追加が望ましい | 修正先は Points 側文書 |
| M42 | A1-16 | 自己ホスト型でない Provider に `issuer` を送った場合 | 記載追加が望ましい | R09 と同時に決める |
| M43 | A1-17、A2-08 | 401・403 の `WWW-Authenticate` | 記載追加が望ましい | |
| M44 | A1-18 | 署名付き認可要求が10分で失効する | 懸念のみ | |
| M45 | A1-20、C1-05 | 照合の分割読取とクエリ数。`json_each` | 記載追加が望ましい | A1-20（懸念のみ）を含む。R41 と関連 |
| M46 | A1-21、D1-17 | アサーションと DPoP proof の記録行が自動で消えない | 懸念のみ | |
| M47 | A1-22 | FAPI 2.0 への言及 | 懸念のみ | |
| M48 | A2-03 | 鍵のローテーション手順と、JWT が失効できないこと | 記載追加が望ましい | |
| M49 | A2-07 | 資源APIの頻度制限と429 | 記載追加が望ましい | |
| M50 | A2-11 | 運営者によるクライアントの停止 | 記載追加が望ましい | |
| M51 | A2-16、A2-17 | 同意OFF/ONでの保持。存在を推測できる経路が無いこと | 確認のみ | 懸念なし |
| M52 | A2-18 | `accounts_user` の形式検査 | 懸念のみ | |
| M53 | A2-19 | 一覧取得の body の上限 | 懸念のみ | |
| M54 | A2-20、B1-10、C1-14前半 | 退会で消えるクライアントについて、他ユーザーの同意行を消すか | 懸念のみ | A2-20（記載追加）をレビュー担当が下げた |
| M55 | — | （欠番） | — | 統合一覧に存在しない |
| M56 | B1-04 | 解除で、token の失効と最後のログイン手段の判定の順序 | 記載追加が望ましい | |
| M57 | B1-05 | OAuth の証明だけを解除する操作が無い | 記載追加が望ましい | |
| M58 | B1-06 | 唯一のログイン手段で作った別ユーザーからの移動が行き止まりになる | 記載追加が望ましい | |
| M59 | B1-07 | 解除後も `user.email` が残り、同じメールで新規登録できない | 記載追加が望ましい | |
| M60 | B1-11、C1-04付記 | 退会時に外部 token を失効するか | 記載追加が望ましい | |
| M61 | B1-14 | 同じ外部アカウントへの連携が競合したときの応答 | 懸念のみ | |
| M62 | B1-15 | 組織の取り合い | 懸念のみ | 前回 R59 の別側面 |
| M63 | B1-16 | 表示名の入力規則 | 懸念のみ | |
| M64 | B1-17 | 登録者が退会すると全利用者の連携が終わる | 懸念のみ | |
| M65 | B1-18 | 別ユーザーに連携済みの場合の確認 | 確認のみ | 懸念なし |
| M66 | B1-19 | 再登録で公開プロフィールURLが変わる | 懸念のみ | |
| M67 | B2-11 | Accounts 側から連携を始める入口が画面に無い | 懸念のみ | |
| M68 | B2-13 | 公開設定の3層の一貫性など | 確認のみ | 懸念なし。同意画面の列名は M75、purge の伝播は M21 で扱う |
| M69 | C1-06 | 150件の数え方を表の列で判定できない | 記載追加が望ましい | 前回 R25 の別側面 |
| M70 | C1-07 | `linked_at`・`verified_at` と、証明を失った識別子の扱い | 記載追加が望ましい | |
| M71 | C1-08 | Web識別子の移動を1 batch で行う文の順序 | 確認のみ | 懸念なし |
| M72 | C1-09 | `evidence_key` と `auth_account_id` が同じ値を持つ | 懸念のみ | |
| M73 | C1-10 | 証明と識別子の `account_id` の一致を DB で守っていない | 懸念のみ | |
| M74 | C1-11 | Drizzle relations と `relationName` | 懸念のみ | |
| M75 | C1-12、C2-13 | 列の NULL 可否。`client_consents.display_name` の出典 | 懸念のみ | |
| M76 | C1-14後半 | ER図に account と証明の関連が無い | 懸念のみ | |
| M77 | C2-05 | 5MiB の復元を1 batch で処理できる保証が無い | 記載追加が望ましい | |
| M78 | C2-06 | 候補の過去情報を出力する方法 | 記載追加が望ましい | |
| M79 | C2-07 | 入力検査で扱う重複・欠落 | 記載追加が望ましい | |
| M80 | C2-08 | 移行できる範囲とできない範囲の整理 | 記載追加が望ましい | 前回 R28 の別側面 |
| M81 | C2-10 | 5MiB 超過の通知と、ストリーミングでの出力 | 懸念のみ | |
| M82 | C2-12 | 復元で、連携を始めていないクライアントへの同意を作れる | 懸念のみ | |
| M83 | C2-14、C2-15、C2-16 | JSON 形式・token の除外・検査順 | 確認のみ | 懸念なし |
| M84 | D1-13（D1-01 の付随） | 冗長な既定値と、完全なキー | 懸念のみ | |
| M85 | D1-11 | cookieCache の「管理操作」の範囲 | 記載追加が望ましい | |
| M86 | D1-12 | 1.7.0〜1.7.2 の `account.issuer` 列 | 懸念のみ | |
| M87 | D1-14 | `backgroundTasks` が影響する範囲 | 懸念のみ | |
| M88 | D1-15 | Workers Cache の入口別の範囲と Preview | 懸念のみ | |
| M89 | D1-18 | Hono の `app.query()` | 確認のみ | 懸念なし |
| M90 | D2-07 | 受け入れ条件にあって本文に定義が無い項目 | 記載追加が望ましい | |
| M91 | D2-08 | 「v0.1で実装する機能」の表の欠落 | 記載追加が望ましい | |
| M92 | D2-09 | 計画の各フェーズとの対応漏れ（監査イベント、versioned secrets） | 記載追加が望ましい | token の部分は M27 |
| M93 | D2-10 | 用語の使い分け | 記載追加が望ましい | |
| M94 | D2-14 | 3つの状態の列挙と、API で到達しない値 | 懸念のみ | |
| M95 | D2-15 | OSS としての本体のライセンス | 懸念のみ | |
| M96 | D2-16 | v0.2・v0.3 と v0.1 の関係 | 確認のみ | 懸念なし |

## 8. トリアージで区分を変えた指摘と理由

### 8.1 管理者判断で変更したもの

#### M20（レビュー担当・検証担当: 要修正（軽微） → 最終: 記載追加が望ましい）

- レビュー担当と検証担当は、「バックエンドはクライアントの入力を信用しない」という原則に関わり、1文で解消できるとして要修正（軽微）とした。
- 管理者判断で記載追加に下げた。理由は次のとおりである。
  - 影響は、本人が JSON を手で編集した場合の、本人の行の表示に限られる。
  - 識別子は検証でしか有効にならないので、他人の識別子の取得や照合結果の誤りにはつながらない。
  - [verify-url.ja.md:83](../specification/v0.1/verify-url.ja.md) の補助情報の規定に従い、再証明時にバックエンドが再判定すると1文書けば足りる。

#### M07（区分は要修正のまま、修正案を変更）

- レビュー担当は、移行元と同じ「試行ごとの referenceId」（A2-01 の案）を推奨した。
- 検証担当は、費用と比較の根拠が示されていないと指摘し、最も影響範囲が小さい修正として `prompt=consent`（Points が付ける契約）を推奨した。全クライアントに画面を強制する要件が明示される場合に限り、試行ごとの referenceId が正しいとした。
- 管理者判断で、(a) `prompt=consent` を API 契約に明記することと、(b) 本人が同意 OFF で保存したときにそのクライアントの `oauthConsent` を削除することの併用を推奨とした。
  - (b) は、クライアントが `prompt` を付けない場合にも、本人が提供を止めたクライアントへ黙って再連携されないようにする Accounts 側の制御である。
  - B2-02 が推奨した (b) 単独は、同意 ON のまま再連携する [profile-setting.md:82](../../../points-web-app/docs/v0.2/details-ja/profile-setting.md) の流れを満たさない。
  - 全クライアントに毎回画面を強制する要件がある場合は、試行ごとの referenceId を採る。これを仕様作成者の判断事項とした。

#### M31（レビュー担当: 要修正（軽微） → 最終: 付記）

- レビュー担当は「v0.1 の対象外で、前回の R50 と同じく付記相当」と書きながら、要修正の一覧に数えていた。
- 検証担当の指摘どおり、本レビューの対象は v0.1 なので、v0.1 の要修正の件数から外し、付記とした。

#### M06（報告者: 要修正 → 最終: 付記（既出））

- 調査担当 A2-06・B2-07 は要修正としたが、同じリンク切れは前回レビューの付記に既出である（R番号なし）。
- レビュー担当が既出とし、トリアージでも付記として扱った。新しい側面（plan 配下の5箇所）だけを [6章](#6-付記) に記録した。
- 訂正: レビュー担当は「plan 配下はどの報告にも列挙されていない」と書いたが、A2-06 は `v0.2-implementation.md`:13 に触れていた。`docs/readme/README.ja.md`:13 は前回付記の11箇所に含まれる。

### 8.2 レビュー担当が上げたもの

報告者の区分より高い区分へ上げ、トリアージで維持したものである。

| 統合ID | 元ID（報告者の区分） | 最終区分 | 理由 |
| --- | --- | --- | --- |
| M04 | C1-13（記載追加） | 要修正 | 文言は矛盾とも曖昧さとも読めるが、実名が公開されうる読み方があり、1文で消せる。ほかの3件（A1-04・B1-08・D1-06）と区分を揃えた |
| M13 | C1-04（記載追加） | 要修正 | [main.ja.md:564](../specification/v0.1/main.ja.md) の文言と 1.7.5 の既定値が直接衝突し、2日目以降のすべての解除・退会で起きる |
| M17 | D1-08（記載追加） | 要修正 | [v0.1.md:110](../implementation-plan/v0.1.md) が存在しない前提（確定した運営権限）を参照しており、実装に着手できない |
| M29 | C2-09（記載追加） | 要修正 | 2つの文書で v0.1 の完了条件が異なり、どちらに従うかを実装者が決められない |

### 8.3 レビュー担当が下げたもの

報告者が要修正とした指摘のうち、レビュー担当が要修正より下げ、トリアージで維持したものである。

| 統合ID | 元ID（報告者の区分） | 最終区分 | 理由 |
| --- | --- | --- | --- |
| M08 | B2-01（要修正） | 記載追加が望ましい | 同意 OFF のまま OAuth が成立しても情報は提供されず、[main.ja.md:257](../specification/v0.1/main.ja.md) は存在しない場合と同意が無い場合を意図的に同じ404にしている。安全性の欠陥ではなく、画面の終了操作の定義の不足である。検証担当の補足（同意 ON で保存した後に拒否すると提供許可が残る）は 4.1 の記載に反映した |
| M09 | B2-03（要修正） | 記載追加が望ましい | [main.ja.md:159](../specification/v0.1/main.ja.md) の登録項目に利用目的が無く、[main.ja.md:187](../specification/v0.1/main.ja.md) は Points についてだけ定める。表示内容の定義の不足であり、安全性や正しさの欠陥ではない。説明文か定型文かを1文で決めれば足りる |
| M18 | C2-01、D2-06（要修正） | 記載追加が望ましい | [main.ja.md:630・632](../specification/v0.1/main.ja.md) で提供範囲は決まっており、「移行の取込側が無い」は範囲の決定で欠陥ではない。候補は再証明まで有効にならず（[main.ja.md:651](../specification/v0.1/main.ja.md)）、影響は本人のデータに限られる。D2-06 の Client ID の衝突は、Client ID が乱数なので現実的でない（推測） |
| M19 | C2-02（要修正） | 記載追加が望ましい | [main.ja.md:852・844・666](../specification/v0.1/main.ja.md) から、2回目の復元は既存行の更新と読める。未定義として残るのは、1アカウントが複数行にまたがる場合などの境界ケースである |
| M21 | D1-05（要修正） | 記載追加が望ましい | purge が失敗するのはアカウント全体で bucket 25 を使い切ったときに限られ、v0.1 の規模ではまれである（推測）。検証担当の補足により、TTL が未定義であることと、公開の取り消しが残るプライバシー上の影響を記載に含めた |
| M22 | C1-02（要修正） | 記載追加が望ましい | 前回レビューの R58（記載追加）と同じ1文で解消でき、R58 と同時に決める。検証担当の訂正により、根拠となる経路を本人の二重登録の経路に差し替えた。C1-02 の前提（OAuth だけの解除）は [main.ja.md:876](../specification/v0.1/main.ja.md) がデータ層で想定しており、根拠の無い仮定ではない |
| M24 | D1-04（要修正） | 記載追加が望ましい | 報告者は「3.2.1 の文書の作成手段が仕様・計画のどこにも無い」としたが、[v0.1.md:141](../implementation-plan/v0.1.md) に Valibot から OpenAPI 3.2.1 を作ることと、Open API プラグインの出力と区別して案内することが書かれている。残るのは [main.ja.md:935](../specification/v0.1/main.ja.md) の文言だけである |
| M26 | D2-02 の token 失効以外（要修正） | 記載追加が望ましい | [v0.1.md:118・165](../implementation-plan/v0.1.md) が、所有者の更新・移動を保存層・D1 上の検証対象にしている。報告者は [v0.1.md:165](../implementation-plan/v0.1.md) を見落としていた |
| M28 | D2-04（要修正） | 記載追加が望ましい | [main.ja.md:885-891](../specification/v0.1/main.ja.md) は確定事項の再掲で、[main.ja.md:893-895](../specification/v0.1/main.ja.md) は Points 側の事項である。仕様の振る舞いの矛盾ではなく、管理方法の改善である |
| M27 | D2-02 の token 部分（要修正） | 記載追加が望ましい | [main.ja.md:910](../specification/v0.1/main.ja.md) の承認対象として明記し、計画に作業を1行加えれば足りる。D1-07 と同じ区分に揃えた |
| M15 | B1-03 の連携側（要修正） | 記載追加が望ましい | [main.ja.md:881](../specification/v0.1/main.ja.md) は、複数 batch に分けた操作の原子性を保証しないことを自ら認めている。hook と補修の1〜2文で足りる。削除側（外部キー）は M14 として要修正にした |

このほか、要修正以外の区分の変更として、M54（A2-20 の記載追加 → 懸念のみ）と、M21 の副論点 B2-08（記載追加 → 懸念のみ）がある。
理由は、それぞれ [5.2](#52-レビュー担当の区分を維持したもの) と [5.1](#51-トリアージで列挙したもの) に書いた。
