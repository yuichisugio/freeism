# v0.2 設計決定台帳

## 1. 目的

本書は、Cloudflare全面移行とPoints／Markets分離に関する設計会話で選択された事項を、上書き・撤回・保留を含めて追跡する正本である。実装手順は扱わない。

旧文書に記載された案は、本台帳で`採用`とされている場合だけv0.2の確定仕様になる。特に旧`index.ja.md`、旧`auth.md`、旧`other.md`のメモや生成回答を、記載されているだけで確定事項として扱わない。

### Status

| Status       | 意味                                                             |
| ------------ | ---------------------------------------------------------------- |
| `採用`       | v0.2の最終仕様                                                   |
| `上書き済み` | 後発決定により規範性を失った旧決定                               |
| `撤回`       | 明示的に取り下げた決定                                           |
| `対象外`     | 情報は保持するがv0.2では実装しない                               |
| `未確定`     | 検討メモであり、採用判断をしていない                             |
| `承認対象`   | 詳細案として保持するが、利用者が明示承認するまで実装入力にしない |

### Canonical document

- `ARCH`：[アーキテクチャ](./architecture.md)
- `AUTH`：[認証・外部ID・サービス間認可](./authentication.md)
- `API`：[レスポンス形式](./response-format.md)
- `POINTS`：[Points v0.2仕様](../../../projects/points-web-app/docs/v0.2/index.ja.md)
- `MARKETS`：[Markets v0.2仕様](../../../projects/markets-web-app/docs/v0.2/index.ja.md)
- `AUCTION`：[Auction詳細](../../../projects/markets-web-app/docs/v0.2/details-ja/auction.md)

## 2. 移行範囲・基盤

| ID      | Status | 決定                                                                                       | 上書き・撤回関係                                                          | Canonical             |
| ------- | ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | --------------------- |
| DEC-001 | 採用   | v0.2は本番リリース前のテスト環境であり、Supabase等からの業務データ移行を行わない。         | 旧データ移行案を不採用。                                                  | ARCH                  |
| DEC-002 | 採用   | 後方互換URL、旧API、旧DB schema、旧Session、SSE fallback、Prisma互換層を作らない。         | 旧実装との互換維持を不採用。                                              | ARCH                  |
| DEC-003 | 採用   | Webアプリの実行・配信先をCloudflare Workersへ統一する。                                    | Vercel hostingを廃止。                                                    | ARCH                  |
| DEC-004 | 採用   | 静的HTML、JS、CSS、font等はWorkers Static Assetsで配信する。                               | Cloudflare PagesとVercel CDNを不採用。                                    | ARCH                  |
| DEC-005 | 採用   | Supabase PostgreSQLを廃止し、アプリごとに独立したCloudflare D1を使用する。                 | PostgreSQL継続案を不採用。                                                | ARCH                  |
| DEC-006 | 採用   | Prisma ORMを廃止し、Drizzle ORMと手書きD1 migration／constraintを使用する。                | Prisma field・migration案を上書き。                                       | ARCH, POINTS, MARKETS |
| DEC-007 | 採用   | バックエンドHTTP APIをHonoへ統一する。                                                     | Next.js Server Actions、Route Handlers、TanStack Server Functionsを廃止。 | ARCH, API             |
| DEC-008 | 採用   | フロントエンドはNext.jsを廃止し、TanStack StartとVite+へ移行する。                         | Next.js App Router前提を上書き。                                          | ARCH                  |
| DEC-009 | 採用   | TanStack StartはSSG＋SPAに限定し、実行時SSR、RSC、ISRを使用しない。                        | SSR全面利用案を不採用。                                                   | ARCH                  |
| DEC-010 | 採用   | Vite+、TanStack Start、Cloudflare Vite plugin等は完全固定したversionを使用する。           | `^`、`latest`を不採用。                                                   | ARCH                  |
| DEC-011 | 採用   | Upstash Redis＋SSEを廃止し、Auction単位のDurable Object＋WebSocket Hibernationへ移行する。 | 手動reloadだけにする旧案も上書き。                                        | ARCH, AUCTION         |
| DEC-012 | 採用   | `setTimeout`、`setInterval`、独自heartbeatでDOを起こし続けない。                           | 常駐型realtime案を不採用。                                                | AUCTION               |
| DEC-013 | 採用   | 画像管理・アップロードを廃止し、R2を商品画像用途に使用しない。                             | 旧Cloudflare R2画像仕様を廃止。                                           | POINTS, MARKETS       |
| DEC-014 | 採用   | Package managerはpnpm、lockfileはrootの単一`pnpm-lock.yaml`とする。                        | npm中心の旧コマンドを上書き。                                             | ARCH                  |

## 3. アプリ・リポジトリ・文書境界

| ID      | Status | 決定                                                                                                                      | 上書き・撤回関係                                     | Canonical  |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------- |
| DEC-015 | 採用   | `points.freeism.app`と`markets.freeism.app`を独立アプリとして分離する。                                                   | 単一`freeism.app/dashboard`案を上書き。              | ARCH       |
| DEC-016 | 採用   | Pointsのフロントエンドとバックエンドは`projects/points-web-app`で一体管理する。                                           | 旧`projects/web-app`を置換。                         | ARCH       |
| DEC-017 | 採用   | Marketsのフロントエンドとバックエンドは`projects/markets-web-app`で一体管理する。                                         | 旧`auction-worker`単体名を置換。                     | ARCH       |
| DEC-018 | 採用   | 1ドメインにつき1つのFull-stack Workerとし、UI WorkerとAPI Workerをさらに分割しない。                                      | `api.points.freeism.app`等の別API domain案を不採用。 | ARCH       |
| DEC-019 | 採用   | Points／MarketsのDB、認証model、domain型を共有packageにしない。                                                           | 共通domain package案を不採用。                       | ARCH       |
| DEC-020 | 採用   | PointsがOpenAPI契約を所有し、Marketsは生成Clientを通して利用する。                                                        | Points内部実装の共有を禁止。                         | ARCH, API  |
| DEC-021 | 採用   | v0.1〜v0.3のアプリ固有docsとplanは、それぞれのweb-app配下へ情報を失わず移動する。                                         | 全docsを`/docs/web-app`へ集約する初期案を上書き。    | ARCH       |
| DEC-022 | 採用   | `/docs/web-app`にはArchitecture、認証連携、API契約、migration判断、運用等の横断仕様だけを置く。                           | DEC-021と両立する修正版。                            | ARCH       |
| DEC-023 | 採用   | 仕様・制約・状態機械・不採用理由はdocs、実行作業と順序は各アプリのplanへ分離する。                                        | 会話要約だけをplanにする案を不採用。                 | ARCH       |
| DEC-024 | 採用   | 旧見出しと固有情報へsource ID、会話決定へDEC IDを付け、canonical見出しへのtraceabilityを持つ。未割当0件を完了条件とする。 | 情報欠落防止の追加決定。                             | 本書, ARCH |
| DEC-025 | 採用   | 旧`auth.md`の重複文章・同義code例は一度だけ記載し、固有条件、例外、注意、却下案、version差は保持する。                    | 文章の単純削除を禁止。                               | AUTH       |
| DEC-026 | 採用   | `projects/web-app`は移行後に廃止し、`.next`、生成物、`node_modules`は移動しない。                                         | 旧app丸ごと複製案を不採用。                          | ARCH       |

## 4. 責務・機能境界

| ID      | Status     | 決定                                                                                                                      | 上書き・撤回関係                         | Canonical        |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------- |
| DEC-027 | 採用       | Pointsはポイント付与・ポイント管理と、それに必要なプロフィール、外部ID、評価軸、Package、FIX、台帳、予約を所有する。      | 当初のTask／Group所有を撤回。            | POINTS           |
| DEC-028 | 採用       | 現行Auction関連機能はすべてMarketsへ移し、ListingとAuctionをMarketsが所有する。                                           | Points内Auction案を上書き。              | MARKETS, AUCTION |
| DEC-029 | 上書き済み | Task作成もMarketsで行う。                                                                                                 | DEC-030のTask完全廃止で上書き。          | 本書             |
| DEC-030 | 採用       | Task model・Task作成・報告・実行者・Task FIX・Task経由Auctionを完全廃止する。Marketsでは商材出品とAuction作成だけを行う。 | DEC-029と旧Task仕様を上書き。            | POINTS, MARKETS  |
| DEC-031 | 採用       | Group、GroupMembership、Group owner、Group formを完全廃止する。                                                           | 旧Group仕様を廃止。                      | POINTS           |
| DEC-032 | 採用       | 評価軸の一般community memberを管理しない。                                                                                | Group memberの置換ではない。             | POINTS           |
| DEC-033 | 採用       | 評価結果draft、承認待ち、部分FIXを持たず、確定したFIXだけをCSVで登録する。                                                | 旧draft管理を廃止。                      | POINTS           |
| DEC-034 | 採用       | 通知Center、メール、Push、通知作成、watchlist通知を廃止する。操作結果の短命toastだけを残す。                              | `other.md`の「通知を残す」メモを不採用。 | POINTS, MARKETS  |
| DEC-035 | 採用       | PWA、Service Worker、offline機能を廃止する。                                                                              | 旧manifest／PWA cache仕様を廃止。        | ARCH             |
| DEC-036 | 採用       | Q&A、chat、DM、商品画像、SSE、Upstashを新アプリへ移植しない。                                                             | 旧周辺機能を廃止。                       | POINTS, MARKETS  |

## 5. ADMIN・評価軸・Package

| ID      | Status | 決定                                                                                                   | 上書き・撤回関係                                      | Canonical       |
| ------- | ------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------- |
| DEC-037 | 採用   | v0.2の管理Roleは単一種類の同格`ADMIN`だけとする。                                                      | owner、super admin、reviewerを廃止。                  | POINTS, AUTH    |
| DEC-038 | 採用   | 全ADMINが全評価軸・Packageを同じ権限で管理し、軸別・Package別ADMINを作らない。                         | 初期Section 4のresource別ADMIN案をSection 9で上書き。 | POINTS, AUTH    |
| DEC-039 | 採用   | 最後のADMINを削除できず、ADMIN権限は重要操作ごとにD1から再取得する。                                   | Session固定Roleを不採用。                             | AUTH, POINTS    |
| DEC-040 | 採用   | 最初のADMINはADMIN 0件時に限り、Google `accountId`がbootstrap Secretと一致する初回ログインで作成する。 | email判定と公開Admin作成APIを禁止。                   | AUTH            |
| DEC-041 | 採用   | 評価軸IDは不変の標準Nano ID、名前30文字以下、説明200文字以下、関連URL最大20件とする。                  | 旧Group ID／UUID設計を置換。                          | POINTS          |
| DEC-042 | 採用   | 評価軸作成・更新はCSVのみ、1回20件までとし、状態は`ACTIVE / ARCHIVED`とする。                          | GUI一括formを不採用。                                 | POINTS          |
| DEC-043 | 採用   | FIX、台帳、Package、予約から参照された評価軸を物理削除しない。                                         | cascade delete案を不採用。                            | POINTS          |
| DEC-044 | 採用   | Package構成をJSON配列で上書きせず、不変Revisionと正規化itemで保持する。                                | 旧PostgreSQL JSON／配列案を上書き。                   | POINTS          |
| DEC-045 | 採用   | Package IDも標準Nano ID、作成・更新CSVは1回20件、比率は正の整数を最大公約数で正規化する。              | 旧曖昧比率案を上書き。                                | POINTS          |
| DEC-046 | 採用   | プロフィールへ公式Packageを複数登録できるが、自動分配で同時に有効にできるPackageは1つとする。          | 単一登録案と無制限同時有効案を調整。                  | POINTS          |
| DEC-047 | 採用   | Marketsは出品時のPackage Revisionと構成を不変snapshot保存し、後のPoints編集を既存Auctionへ反映しない。 | 最新値参照案を不採用。                                | POINTS, AUCTION |

## 6. ログイン・Social Account・Session

| ID      | Status     | 決定                                                                                                                        | 上書き・撤回関係                                              | Canonical |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------- |
| DEC-048 | 採用       | Marketsは独立Better Authユーザー、D1、Session Cookieを持ち、Pointsを後から明示linkする。                                    | PointsをMarkets唯一login Providerにする案を不採用。           | AUTH      |
| DEC-049 | 上書き済み | Pointsのv0.2 loginはGoogleだけとする。                                                                                      | DEC-050が上書き。                                             | 本書      |
| DEC-050 | 採用       | PointsではGoogleとGitHubを、login画面と既存ユーザーの明示link画面の両方で同じProvider集合として有効化する。                 | DEC-049とGitHub link-only案を上書き。                         | AUTH      |
| DEC-051 | 採用       | Markets自身のloginはGoogleのみとし、email/password、Apple、GitHubを実装しない。                                             | Markets複数Provider案を不採用。                               | AUTH      |
| DEC-052 | 上書き済み | GitHubは所有権確認専用で、通常loginをserver hookで拒否する。                                                                | DEC-050が上書き。独自provider経路hookも不採用。               | 本書      |
| DEC-053 | 採用       | 本人識別の正本は`providerId + accountId`であり、email一致による暗黙link・統合を禁止する。                                   | email identity案を不採用。                                    | AUTH      |
| DEC-054 | 採用       | `disableImplicitLinking: true`、`trustedProviders: []`、`allowDifferentEmails: true`、`updateUserInfoOnLink: false`とする。 | 旧`trustedProviders: [google, github]`案をSection 9で上書き。 | AUTH      |
| DEC-055 | 採用       | OAuth Tokenを暗号化してD1へ保存し、Account Cookieとブラウザへ保存しない。                                                   | Token Cookie案を不採用。                                      | AUTH      |
| DEC-056 | 採用       | Points／Markets CookieはSecure、HttpOnly、SameSite=Lax、host-onlyで、prefixも分離する。                                     | `.freeism.app`共有Cookieを禁止。                              | AUTH      |
| DEC-057 | 採用       | OAuth stateをD1に保存し、PKCE S256、CSRF、Origin、Fetch Metadata検査を有効にする。                                          | 検査無効化を禁止。                                            | AUTH      |
| DEC-058 | 採用       | GitHubはOAuth AppとBetter Auth既定の最小scopeを使い、メールを識別・通知・暗黙linkに使わない。                               | ORCID、X、追加scopeを対象外。                                 | AUTH      |
| DEC-059 | 採用       | GitHub email欠落時はAccount ID由来の`.invalid`予約ドメイン値を使用できるが、本人識別には使わない。                          | email必須identity案を不採用。                                 | AUTH      |
| DEC-060 | 採用       | GitHub Accountを複数Pointsユーザーへlinkせず、別ユーザーで作成済みのProvider Accountをメールで統合しない。                  | 自動Account mergeを禁止。                                     | AUTH      |

## 7. OAuth主体・外部URL所有権・未受領FIX

| ID      | Status     | 決定                                                                                                                      | 上書き・撤回関係                                                         | Canonical    |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------ |
| DEC-061 | 採用       | OAuthの`providerId + accountId -> Points userId`対応を最初のユーザーへ永久固定する。                                      | OAuth主体の再所有を禁止。                                                | AUTH         |
| DEC-062 | 採用       | GitHub所有権利用の停止ではTokenを失効・削除し、ownershipを`INACTIVE`にするが、Better Auth Accountを物理unlinkしない。     | 旧「GitHub Accountをunlink」案を、GitHub login許可との整合のため上書き。 | AUTH         |
| DEC-063 | 採用       | GitHub loginだけでは`INACTIVE` ownershipを再有効化せず、元ユーザーのGoogle fresh認証を伴う明示再有効化でのみ戻す。        | 暗黙再有効化を禁止。                                                     | AUTH         |
| DEC-064 | 採用       | OAuth ownership無効中の新規正負FIXは保留し、元ユーザーの再有効化時に選択不可で一括受領する。                              | 無効中も自動付与する案を不採用。                                         | AUTH, POINTS |
| DEC-065 | 採用       | 汎用Web URLは永久固定せず、所有期間と再所有cooldownを持つ。                                                               | Web URL永久固定案と即時再割当案を不採用。                                | AUTH         |
| DEC-066 | 採用       | Web URL所有権は編集可能ページのlink、`rel="me"`相互link、GitHub OAuth/APIで自動検証する。                                 | OAuth限定案を不採用。                                                    | AUTH         |
| DEC-067 | 撤回       | v0.2で人による手動審査を用意する。                                                                                        | 利用者実行時の自動検証へ明示撤回。                                       | AUTH         |
| DEC-068 | 撤回       | 専用審査Role、承認Queue、複数人承認、異議申立てを設ける。                                                                 | DEC-067撤回に伴い廃止。                                                  | AUTH         |
| DEC-069 | 上書き済み | 編集可能ページへ一時検証Token／nonceを設置する。                                                                          | 後発Section 9のnonce不要・link完全一致へ上書き。                         | AUTH         |
| DEC-070 | 採用       | 外部ページの許可linkとPointsプロフィールURLを正規化して完全一致で判定し、本文文字列・部分一致・ユーザー名推定を使わない。 | 曖昧link検出を不採用。                                                   | AUTH         |
| DEC-071 | 採用       | `rel="me"`が存在するページでは`rel="me"` linkだけを候補とし、iframe／JavaScript生成linkを無視する。                       | 旧無条件通常link案を制限。                                               | AUTH         |
| DEC-072 | 採用       | 初回Web所有者は1回成功で即時有効、30日ごとに再検証する。                                                                  | 無期限検証を不採用。                                                     | AUTH         |
| DEC-073 | 採用       | 再検証失敗時は7日間最大3回、途中成功で継続、3回失敗または解除で所有期間終了とする。                                       | 即時失効案を不採用。                                                     | AUTH         |
| DEC-074 | 採用       | 新所有者は14日間に3回成功した時点で有効となる。                                                                           | 7日2回案、30日3回案を不採用。                                            | AUTH         |
| DEC-075 | 採用       | Web再所有の`effectiveAt`は3回目の成功時刻とする。                                                                         | cooldown開始時刻を不採用。                                               | AUTH         |
| DEC-076 | 採用       | FIXの評価時刻とownership epochで受領者を決め、候補期間・所有者不明期間・新`effectiveAt`以前のFIXを新所有者へ渡さない。    | 過去FIXの移転を禁止。                                                    | AUTH, POINTS |
| DEC-077 | 採用       | 未受領FIXはdraftではなく、受領先だけ未確定の正式FIXである。                                                               | 評価draftと分離。                                                        | POINTS       |
| DEC-078 | 採用       | 正・負の未受領FIXを両方許可し、所有権確認後にURL単位で選択不可・原子的に全件受領する。                                    | 正だけ・個別選択案を不採用。                                             | AUTH, POINTS |
| DEC-079 | 採用       | 受領前に評価軸別正味合計と正負件数を表示し、1件失敗で全件rollbackする。                                                   | 部分claimを不採用。                                                      | AUTH, POINTS |
| DEC-080 | 採用       | 受領後のURL解除・再所有でも既受領FIXを移動・rollbackせず、後続訂正は元受領者へ差分反映する。                              | 所有権変更による移転を禁止。                                             | POINTS       |

## 8. Google fresh・Better Auth version

| ID      | Status     | 決定                                                                                                                                                    | 上書き・撤回関係                                                                                 | Canonical |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------- |
| DEC-081 | 採用       | 重要操作はBetter Auth fresh SessionとGoogle `auth_time <= 15分`の両方を要求する。                                                                       | Session作成時刻だけの判定を強化。                                                                | AUTH      |
| DEC-082 | 上書き済み | step-upは`prompt=login`、署名済みID Token、同じGoogle `sub`を検証し、成功時にSession IDをrotateする。                                                   | `prompt=login`はGoogle現行公式値にないためDEC-244で上書き。email一致禁止とSession rotateは維持。 | AUTH      |
| DEC-083 | 採用       | GitHubだけで登録したPointsユーザーは、重要操作前にGoogleを明示linkしてstep-upする。                                                                     | DEC-050とDEC-081の帰結。                                                                         | AUTH      |
| DEC-084 | 採用       | fresh対象はSocial link／ownership変更、Web所有権、FIX claim／CSV、Points–Markets連携、評価軸、ADMIN、Account close、OAuth鍵、Settlement管理操作とする。 | 初期の狭い対象一覧を後発Section 9で拡張。                                                        | AUTH      |
| DEC-085 | 採用       | 開発・stagingはBetter Auth `1.7.0-rc.1`へexact pinする。                                                                                                | 1.6系安定版開発を不採用。                                                                        | AUTH      |
| DEC-086 | 採用       | ProductionはBetter Auth 1.7正式版への更新と認証回帰完了を必須条件とする。                                                                               | RCのまま本番、1.6 fallbackを不採用。                                                             | AUTH      |

## 9. Points–Markets OAuth認可

| ID      | Status | 決定                                                                                                                | 上書き・撤回関係                        | Canonical |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------- |
| DEC-087 | 採用   | PointsをOAuth 2.1 Authorization Server／Protected Resource、MarketsをOAuth Clientとする。                           | 自社共通Cookie、Google ID突合を不採用。 | AUTH      |
| DEC-088 | 採用   | MarketsとPointsの有効連携は1対1とし、`issuer + pairwise subject`を対応の正本にする。                                | email、内部userId共有を禁止。           | AUTH      |
| DEC-089 | 採用   | 環境内で同一Markets OAuth Client IDを使い、grant／Token class／scopeを分離する。                                    | 2つのClient IDへ分ける案を不採用。      | AUTH      |
| DEC-090 | 採用   | 利用者TokenはAuthorization Code＋PKCE／Refresh Tokenで、残高参照と新規vector reservationだけを許可する。            | 直接debit権限を不採用。                 | AUTH      |
| DEC-091 | 採用   | Client Credentials TokenはMarkets自身を表し、同じClientが作成した既存予約のstatus／capture／releaseだけを許可する。 | M2Mで任意reserve・残高参照を禁止。      | AUTH      |
| DEC-092 | 採用   | 同意画面では残高参照、予約、落札時の確定／解放、offline利用を説明し、技術scopeはuser／M2M Tokenへ分ける。           | 同意説明とToken権限を混同しない。       | AUTH      |
| DEC-093 | 採用   | Access／Refresh TokenはMarkets D1へ暗号化保存し、Client Secret等はWorkers Secretsへ保存する。                       | browser、Cookie、平文D1保存を禁止。     | AUTH      |
| DEC-094 | 採用   | Refresh Token RotationをMarkets Account単位のD1 lease／CASでsingle-flight化する。                                   | process内だけの重複抑止を強化。         | AUTH      |
| DEC-095 | 採用   | 401後の明示Refreshと再試行は1回だけとし、失敗時は再連携を要求する。                                                 | 無限再試行を禁止。                      | AUTH      |
| DEC-096 | 採用   | Worker間通信はService BindingのHTTPを使うが、OAuth Bearer Token、audience、scope、client IDを必ず検証する。         | Service Binding自体を認可根拠にしない。 | AUTH      |
| DEC-097 | 採用   | 有効予約がすべて終端状態になるまでPoints–Markets unlink／relinkを禁止する。                                         | link解除で支払確約を回避できない。      | AUTH      |

## 10. FIX・台帳・金額

| ID      | Status     | 決定                                                                                                       | 上書き・撤回関係                          | Canonical       |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------- |
| DEC-098 | 採用       | FIXは安定result IDを持ち、訂正ごとに不変Revisionを追加する。                                               | 返却IDによる行UPDATEを上書き。            | POINTS          |
| DEC-099 | 採用       | 訂正時は新値全額を再加算せず、旧最新値との差分だけを台帳へ記録する。取消は値0の新Revisionとする。          | 履歴消去・二重加算を禁止。                | POINTS          |
| DEC-100 | 採用       | 負のFIXと負残高を許可する。                                                                                | 非負残高CHECKを廃止。                     | POINTS          |
| DEC-101 | 採用       | 負残高でもFIXは反映するが、reserve、transfer、exchange等の消費系は残高不足なら原子的に拒否する。           | 負FIX拒否案と借越消費案を不採用。         | POINTS          |
| DEC-102 | 採用       | `evaluationTotal`を残高とは別に、FIX評価だけの符号付き累計として管理する。                                 | 曖昧な`earnedTotal`を置換。               | POINTS          |
| DEC-103 | 採用       | transfer、exchange、reserve、capture、releaseは`evaluationTotal`を変更しない。Substitution FIXは変更する。 | 累計と取引残高を分離。                    | POINTS          |
| DEC-104 | 採用       | `point_ledger_entries`を監査上の正本、`point_accounts`をTrigger更新される投影とする。                      | appによる二重UPDATEと毎回全合算を不採用。 | POINTS          |
| DEC-105 | 採用       | 台帳UPDATE／DELETEを禁止し、台帳から残高・`evaluationTotal`・予約投影を再構築できるようにする。            | 可変履歴を禁止。                          | POINTS          |
| DEC-106 | 上書き済み | ポイント額と`minimumUnit`は正の整数だけを扱う。                                                            | DEC-107の固定小数方式へ上書き。           | 本書            |
| DEC-107 | 採用       | 全評価軸共通scale 10,000、1 subunit = 0.0001 pointの固定小数方式を採用する。                               | DEC-106を上書き。                         | POINTS          |
| DEC-108 | 採用       | `minimumUnit`は0.0001以上、最大小数4桁、正数とし、全金額をそのsubunit倍数に制限する。                      | 整数限定を撤回。                          | POINTS          |
| DEC-109 | 採用       | 残高・台帳・予約計算でREALとJavaScript浮動小数点を使わない。API／CSVの金額は10進文字列とする。             | number APIを不採用。                      | POINTS, API     |
| DEC-110 | 採用       | 中間乗除算にはBigIntを使用できるが、D1 bind前と集計後にJavaScript安全整数範囲を検証する。                  | D1へBigInt直接bindを禁止。                | POINTS          |
| DEC-111 | 上書き済み | FIX、transfer、exchange等のCSVは1回100行とする。                                                           | DEC-112が上書き。                         | 本書            |
| DEC-112 | 採用       | PointsのFIX、transfer、exchange、substitution CSVは最大1,000非空データ行とする。                           | DEC-111を上書き。                         | POINTS          |
| DEC-113 | 上書き済み | FIX CSVの最大file sizeを1 MiBとする。                                                                      | DEC-114が後発Section 9で上書き。          | 本書            |
| DEC-114 | 採用       | v0.2の一括CSVはUTF-8、最大5 MiB、最大1,000非空行とする。                                                   | DEC-113を上書き。                         | POINTS, MARKETS |
| DEC-115 | 採用       | CSVは全行検証後に確認し、確定時にserver再検証、全件成功または全件rollbackとする。server draftを持たない。  | 部分成功を禁止。                          | POINTS, MARKETS |
| DEC-116 | 採用       | FIX CSVは1行1外部URLとし、旧カンマ区切り複数URL案はv0.2で採用しない。                                      | 受領者曖昧性を解消。                      | POINTS          |
| DEC-117 | 採用       | FIXは評価期間（月必須・日時任意UTC）、軸管理ID任意、memo 200文字以下、安定result IDを保持する。            | 「Task実行年月」をTask非依存語へ変更。    | POINTS          |
| DEC-118 | 採用       | CSV再送はIdempotency-Keyと正規化内容hashで判定し、同じkey・異なる内容は`409`とする。                       | 二重付与を禁止。                          | POINTS, API     |
| DEC-119 | 採用       | CSV exportではformula injectionを無害化し、検証済み負数は数値として保持する。                              | raw文字列exportを禁止。                   | POINTS, MARKETS |

## 11. Transfer・Exchange・Substitution・自動分配・退会

| ID      | Status | 決定                                                                                                               | 上書き・撤回関係                         | Canonical    |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------ |
| DEC-120 | 採用   | Transfer／ExchangeはCSVのみ、正の額、全件原子的、残高不足拒否とする。                                              | GUI一括formと部分成功を不採用。          | POINTS       |
| DEC-121 | 採用   | Exchange比率は不変Revisionと整数`numerator / denominator`で保持し、出力最小単位に決定的に丸める。                  | REAL比率を禁止。                         | POINTS       |
| DEC-122 | 採用   | 「貢献評価を代用する仕組み」をv0.2へ前倒しし、`SUBSTITUTION_FIX`として不変Revision・差分台帳へ載せる。             | 旧v0.3実装予定を上書き。                 | POINTS       |
| DEC-123 | 採用   | 自動分配は正のFIXだけを対象とし、負FIXは本人へ反映する。分配先の`evaluationTotal`を変更しない。                    | 負FIX分配を不採用。                      | POINTS       |
| DEC-124 | 採用   | 自動分配はPackage Revisionと`max(evaluationTotal, 0)`をweightとし、最大剰余方式・user ID tie-breakで決定的にする。 | 浮動小数・非決定配分を禁止。             | POINTS       |
| DEC-125 | 採用   | 自動分配時のPackage Revision、設定、weightをsnapshot保存し、後の訂正にも同じsnapshotを使う。                       | 最新状態で再計算する案を不採用。         | POINTS       |
| DEC-126 | 採用   | Account closeでSession／consentと公開profileを閉じるが、FIX、Claim、台帳、残高、負残高、永久OAuth主体を保持する。  | 「その人の全データを物理削除」を上書き。 | AUTH, POINTS |

## 12. Markets・Auction

| ID      | Status | 決定                                                                                                                 | 上書き・撤回関係                            | Canonical |
| ------- | ------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------- |
| DEC-127 | 採用   | Markets D1をAuction業務上の唯一の正本とし、Auction IDごとに1つの`AuctionRoom` DOを割り当てる。                       | DO storageだけをSoTにする案を不採用。       | AUCTION   |
| DEC-128 | 採用   | DOは入札直列化、alarm、冪等command、直近event再送、WebSocketを担当し、D1 commit後だけ成功応答・broadcastする。       | memory状態への依存を禁止。                  | AUCTION   |
| DEC-129 | 採用   | Listing／Auction作成はCSVだけで、1行からListingと最初のAuctionを同時作成し、最大1,000行とする。                      | 旧100件、GUI form、Task経由作成を上書き。   | MARKETS   |
| DEC-130 | 採用   | AuctionRoomは初回閲覧・接続・入札時にlazy初期化し、未利用Auctionを大量作成しない。                                   | 全件事前DO生成を不採用。                    | AUCTION   |
| DEC-131 | 採用   | 販売数量は1〜1,000とし、Packageの複数軸minimum unitからLCMによる整数package tickを作る。                             | REAL丸めを禁止。                            | AUCTION   |
| DEC-132 | 採用   | 1ユーザー1Auctionにつき有効bid position 1件とし、再入札はposition更新＋不変bid event追加とする。                     | 可変履歴のみの方式を不採用。                | AUCTION   |
| DEC-133 | 採用   | 順位は価格降順、同額はその価格へ到達したsequence昇順、最後のwinnerだけ残数による部分落札を許可する。                 | client timestamp順を禁止。                  | AUCTION   |
| DEC-134 | 採用   | v0.2はMulti-unit uniform-priceのみとし、全winnerが同じ1個当たりclearing priceを支払う。                              | Pay-as-bid、VCGを対象外。                   | AUCTION   |
| DEC-135 | 採用   | 枠外最高単位がなければ0 tick、同額なら同額、異なるなら枠外最高額＋1 tickをclearing priceとする。                     | 旧曖昧なギリギリ落選者式を確定。            | AUCTION   |
| DEC-136 | 採用   | 全需要が販売数量以内なら正の入札があっても0 tickで落札する。                                                         | 常に最低1 tick案を不採用。                  | AUCTION   |
| DEC-137 | 採用   | AutoBidは非公開上限、必要最小tickへ直接進め、上限引上げとrule取消を許可する。取消前に到達した有効入札は残す。        | 1 tickごとの大量eventを不採用。             | AUCTION   |
| DEC-138 | 採用   | Buy nowは全構成軸が許可する場合だけ設定し、指定数量の全量成功または失敗とする。                                      | NG軸だけ除外して比率を壊す案を不採用。      | AUCTION   |
| DEC-139 | 採用   | 受理済みbid／AutoBid／buy-now holdが一度でもあればseller取消を禁止する。                                             | 入札後任意取消を不採用。                    | AUCTION   |
| DEC-140 | 採用   | 終了間際延長は任意設定、受理された価格更新だけをtriggerとし、回数上限を持つ。                                        | 閲覧・拒否bidによる延長を禁止。             | AUCTION   |
| DEC-141 | 採用   | 入札、AutoBid設定時に残高参照・予約・減算を行わない。ただし有効なPoints連携は要求する。                              | 入札時reservationを不採用。                 | AUCTION   |
| DEC-142 | 採用   | seller本人のbid、終了後bid、価格引下げ、bid撤回を拒否する。                                                          | 旧自由変更案を不採用。                      | AUCTION   |
| DEC-143 | 採用   | 入札後にseller、数量、評価軸、比率、minimum unit、価格式、Points serviceを変更できない。                             | live Auctionの条件変更を禁止。              | AUCTION   |
| DEC-144 | 採用   | 残高不足・負残高で落札候補から除外された場合だけ、`auctionId + userId`につきblacklist行為を最大1回記録する。         | Token失効、429、5xx等のpenaltyを禁止。      | AUCTION   |
| DEC-145 | 採用   | Auction history、winning history、listing history、watchlistをMarketsへ残すが通知は作らない。                        | watchlist通知を廃止。                       | MARKETS   |
| DEC-146 | 採用   | Allocationごとに公開・永続proofを作り、商材、数量、価格vector、buyer／seller公開identityの落札時snapshotを表示する。 | 現在の可変profileだけを表示する案を不採用。 | MARKETS   |
| DEC-147 | 採用   | Reviewはseller→buyer、buyer→seller、1〜5、comment、任意URL、方向ごと1件とし、編集は不変Revisionを残す。              | 上書きだけのReviewを不採用。                | MARKETS   |
| DEC-148 | 採用   | v0.2の1 Auctionは1つの`pointsServiceId`に固定し、全winner・全axisを同じPoints D1で決済する。                         | 複数Points service跨ぎを対象外。            | AUCTION   |

## 13. WebSocket・Frontend・API

| ID      | Status         | 決定                                                                                                                                           | 上書き・撤回関係                                                                                | Canonical       |
| ------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------- |
| DEC-149 | 採用           | WebSocketは購読専用とし、bid mutationは認証済みHTTPからHono→AuctionRoom commandで行う。                                                        | WebSocket commandを不採用。                                                                     | AUCTION         |
| DEC-150 | 採用           | WebSocketはMarkets SessionとOriginをhandshakeで検証し、URL queryへTokenを入れない。                                                            | query Token認証を禁止。                                                                         | AUTH, AUCTION   |
| DEC-151 | 採用           | WebSocket message上限は4 KiB、user×Auction 3接続、user全体20接続、heartbeatなしとする。                                                        | Section 5の16 KiB案をSection 9で上書き。                                                        | AUCTION         |
| DEC-152 | 採用           | Eventに`auctionVersion`と`bidSeq`を持たせ、gap時はsnapshot再取得、重複seqは無視する。                                                          | event全再送・client time順を不採用。                                                            | AUCTION         |
| DEC-153 | 採用           | Static Assetsはasset-first、`/api/*`と`/.well-known/*`だけWorker-firstとする。                                                                 | 全request Worker-firstを不採用。                                                                | ARCH            |
| DEC-154 | 採用           | SPA shellは`/index.html`へ出力し、asset miss後のfallbackはGET／HEADのHTML navigationだけに返す。存在しないAPI・JS・CSS・画像へHTMLを返さない。 | TanStack Startの現行shell出力と安全な明示fallbackを両立し、Cloudflare汎用SPA fallbackを不採用。 | ARCH            |
| DEC-155 | 一部上書き済み | SSGは固定top／規約／privacy／help、公開動的profile・Auction・proofと認証後画面はSPAとする。                                                    | top SSGだけDEC-235で上書き。動的routeをSPAとする判断は維持する。                                | ARCH            |
| DEC-156 | 採用           | 動的公開ページのv0.2 OGPは汎用とし、個別SEOが必要な将来に限定SSRを再設計する。                                                                 | 今回のSSR追加を対象外。                                                                         | ARCH            |
| DEC-157 | 採用           | API namespaceをauth、app、public、resource、internal、oauth、well-knownへ分離する。                                                            | Server Action／Route Handler混在を廃止。                                                        | API             |
| DEC-158 | 採用           | 通常成功は`{data}`、一覧は`{data, meta}`、失敗はRFC 9457 `application/problem+json`とする。                                                    | `PromiseResult`等の後方互換を廃止。                                                             | API             |
| DEC-159 | 採用           | Server stateはTanStack Query memory cache、URL stateはtyped search params、一時UIはReact stateとする。                                         | IndexedDBへの全Query永続化を廃止。                                                              | ARCH            |
| DEC-160 | 採用           | TanStack DB、OPFS、Service Workerをv0.2で使用しない。                                                                                          | `other.md`の候補を確定仕様にしない。                                                            | ARCH            |
| DEC-161 | 採用           | 旧`/dashboard` prefixとredirectを廃止し、各subdomain直下に不変ID URLを置く。                                                                   | 旧「dashboardを残す」仕様を上書き。                                                             | ARCH            |
| DEC-162 | 採用           | 日本語／英語対応、browser言語初期値、WCAG 2.1 AA、keyboard、screen reader要件を保持する。                                                      | 新stack移行で失わない既存要件。                                                                 | POINTS, MARKETS |

## 14. Settlement・失敗回復

| ID      | Status | 決定                                                                                                                        | 上書き・撤回関係                                       | Canonical       |
| ------- | ------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------- |
| DEC-163 | 採用   | Auction close後の決済はAuctionRoom＋Markets D1 outbox＋Settlement Workflowで行う。                                          | DO Alarmだけ、Queue、疑似2PCを不採用。                 | AUCTION         |
| DEC-164 | 採用   | Markets D1に不変planを保存し、Points一括capture後にMarketsを確定する単調sagaとする。                                        | 2つのD1の分散transactionを作らない。                   | AUCTION         |
| DEC-165 | 採用   | 決済commit pointはPointsの一括captureであり、その後はplan変更、release、別winner再計算、自動refundを行わない。              | capture後rollbackを禁止。                              | POINTS, AUCTION |
| DEC-166 | 採用   | 暫定winnerごとに複数評価軸vectorを1予約へ集約し、1軸不足で予約全体をrollbackする。                                          | scalar reservationを廃止。                             | POINTS, AUCTION |
| DEC-167 | 採用   | Pointsは自身の不変Package Revision、price tick、数量から必要vectorを再計算する。                                            | Markets計算値だけを信用する初期案をSection 7で上書き。 | POINTS          |
| DEC-168 | 採用   | 予約leaseは15分、任意延長なし、1件期限切れで全件captureを拒否しroundを再開する。                                            | 無期限予約・部分captureを禁止。                        | POINTS, AUCTION |
| DEC-169 | 採用   | 確定的失敗者がいればround成功予約を全releaseし、同じclose cutoff snapshotからwinner・数量・価格を再計算する。               | 予約流用と希望数量自動減額を不採用。                   | AUCTION         |
| DEC-170 | 採用   | 一時障害では候補を除外せず同じround／keyでretryし、残高不足者だけを除外する。                                               | network障害を落選扱いしない。                          | AUCTION         |
| DEC-171 | 採用   | 全winner・全axisのcaptureをPoints D1の1 transactionで全件成功または0件にする。                                              | winnerごとの部分captureを禁止。                        | POINTS          |
| DEC-172 | 採用   | Workflow stateは正本にせず、deterministic Workflow IDとMarkets D1 outbox／reconcilerで重複起動・retention切れから回復する。 | Workflowだけを正本にしない。                           | AUCTION         |
| DEC-173 | 採用   | Points成功後にMarkets確定が失敗しても返金せず、capture receiptを照会してMarkets確定を再試行する。                           | local失敗による自動refundを禁止。                      | AUCTION         |
| DEC-174 | 採用   | v0.2ではcapture後refund APIを実装しない。将来の補償は新しい正の台帳として設計する。                                         | 旧「預けて返還」を廃止。                               | POINTS          |

## 15. 環境・Deployment・旧基盤撤去

| ID      | Status     | 決定                                                                                                                                                | 上書き・撤回関係                                        | Canonical  |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------- |
| DEC-175 | 採用       | 各appの`wrangler.jsonc` named environmentでlocal、staging、productionを分離する。                                                                   | 環境別設定fileとCloudflare account分離を不採用。        | ARCH       |
| DEC-176 | 採用       | staging／productionでWorker、D1、DO、Workflow、OAuth App／Client、Secret、Cookieを共有しない。                                                      | 共通credentialを禁止。                                  | ARCH, AUTH |
| DEC-177 | 採用       | stagingは`staging.points.freeism.app`／`staging.markets.freeism.app`をAccess保護し、productionは`points.freeism.app`／`markets.freeism.app`とする。 | `workers.dev`公開を不採用。                             | ARCH       |
| DEC-178 | 採用       | TerraformはWorker到達前のDNS、redirect、Access、WAF、Rate Limitを管理し、WranglerはWorker／binding／domain／DO／Workflowを管理する。                | 「Terraformを使わない」旧index記述を上書き。            | ARCH       |
| DEC-179 | 採用       | PRごとの公開Full-stack previewを作らず、local Workers runtimeでD1／DO／Workflow／OAuth mockを検証する。                                             | 公開Preview URL案を不採用。                             | ARCH       |
| DEC-180 | 上書き済み | staging検証済みSHAを`workflow_dispatch`＋手動Environment承認でproductionへ出す。                                                                    | DEC-181が上書き。                                       | 本書       |
| DEC-181 | 採用       | Production deployの唯一のtriggerは`main`へのpushとし、staging deploy・自動E2E成功後だけ自動productionへ進む。                                       | DEC-180を上書き。                                       | ARCH       |
| DEC-182 | 採用       | productionに`workflow_dispatch`と手動approvalを置かず、失敗時はproduction昇格を停止する。                                                           | 手動gateを廃止。                                        | ARCH       |
| DEC-183 | 採用       | 関係ない他projectだけの変更ではPoints／Marketsをdeployしない。                                                                                      | monorepo全releaseを不採用。                             | ARCH       |
| DEC-184 | 採用       | `main`は直接push、force push、delete、admin bypassを禁止し、PR、required checks、up-to-date、merge queueを必須とする。                              | 無保護mainからの自動本番を禁止。                        | ARCH       |
| DEC-185 | 採用       | 一人運用中のrequired approvalは0、二人目のmaintainer追加後は1とする。                                                                               | 現在の自己承認不能を回避。                              | ARCH       |
| DEC-186 | 採用       | 状態変更deployは`cancel-in-progress: false`で直列化し、migration途中のcancelを禁止する。                                                            | 最新pushで実行中migrationをcancelする旧workflowを廃止。 | ARCH       |
| DEC-187 | 採用       | D1 migrationは新規chainを0000から開始し、forward-only／expand-contractとする。                                                                      | Prisma／Supabase migration移植を禁止。                  | ARCH       |
| DEC-188 | 採用       | ProductionはWorkers PaidとD1 Time Travel 30日をrelease条件とし、通常rollbackにTime Travelを使わない。                                               | Free plan 7日を不採用。                                 | ARCH       |
| DEC-189 | 採用       | v0.2では定期D1 export→R2 backupを導入しない。                                                                                                       | `other.md`の長期backup案を対象外。                      | ARCH       |
| DEC-190 | 採用       | apexと`www`は旧path／queryを保持せず`https://points.freeism.app/`へ恒久redirectする。                                                               | 旧Auction URL互換を作らない。                           | ARCH       |
| DEC-191 | 採用       | Cloudflare acceptance後にVercel、Supabase、Upstash、旧画像R2、旧Secret／workflowを確認のうえ撤去する。                                              | 旧基盤併用を不採用。                                    | ARCH       |

## 16. Security・Rate Limit・Audit・Test

| ID      | Status | 決定                                                                                                                                                                                              | 上書き・撤回関係                     | Canonical                   |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------- |
| DEC-192 | 採用   | Cloudflare Edge防御、Worker認証、D1／DO不変条件を重ねる。                                                                                                                                         | Edgeだけ／appだけへの依存を不採用。  | ARCH, AUTH                  |
| DEC-193 | 採用   | Rate Limitは不正利用抑止に使うが、二重付与・retry回数等の正確性はD1／DOで保証する。                                                                                                               | 近似counterを整合性根拠にしない。    | ARCH                        |
| DEC-194 | 採用   | 初期Rate LimitはOAuth、bid、WebSocket、URL検証、CSV、Settlement retryごとにActor＋resource単位で設定する。                                                                                        | 単一IP limitを不採用。               | AUTH, AUCTION               |
| DEC-195 | 採用   | Turnstileは通常login／bid／URL検証では表示せず、rate limit接近、bot pattern、WAF challenge時だけ適応的に要求する。                                                                                | 常時CAPTCHAを不採用。                | AUTH                        |
| DEC-196 | 採用   | Web検証fetchはHTTPS／443、manual redirect最大3、timeout 5秒、1 MiB、HTML／text、no JS、public network限定とする。                                                                                 | 旧10秒／5 redirectを上書き。         | AUTH                        |
| DEC-197 | 採用   | 一般JSON bodyは64 KiB、private responseは`no-store`、重要mutationはIdempotency-Key必須とする。                                                                                                    | 無制限body／再送を禁止。             | API                         |
| DEC-198 | 採用   | Points／Markets D1にappend-only audit eventを保存し、Token、Cookie、Secret、CSV本文、取得ページ本文を記録しない。                                                                                 | sensitive logを禁止。                | AUTH, ARCH                  |
| DEC-199 | 採用   | ADMINによる虚偽FIXや複数Markets accountの共謀をv0.2で自動判定せず、不変履歴と監査を残余対策とする。                                                                                               | 未定義heuristic検知を追加しない。    | POINTS, MARKETS             |
| DEC-200 | 採用   | Better Auth／TanStack／Vite+をexact pinし、既知malicious TanStack version、High／Critical advisoryをrelease blockerとする。                                                                       | 緩いversion rangeを禁止。            | ARCH                        |
| DEC-201 | 採用   | pnpm `minimumReleaseAge` 3日、exotic dependency制限、lifecycle script allowlist、lockfile reviewを行う。                                                                                          | 新規package即時導入を抑制。          | ARCH                        |
| DEC-202 | 採用   | `pull_request_target`を使わず、GitHub Actionsをfull SHA、GITHUB_TOKEN最小権限、production Secretをdeploy job限定とする。                                                                          | mutable Action tag／広権限を禁止。   | ARCH                        |
| DEC-203 | 採用   | Workers Vitest integrationとVitest 4.1以上を使用し、Static、domain、D1、Worker contract、DO／Workflow、browser、staging、production smokeを検証する。                                             | v0.3までtestを延期する旧案を上書き。 | ARCH, AUTH, POINTS, AUCTION |
| DEC-204 | 採用   | repository全体coverage率だけでrelease可否を決めず、列挙した不変条件testの存在と成功を必須にする。                                                                                                 | 単一coverage gateを不採用。          | ARCH                        |
| DEC-205 | 採用   | 初回ProductionはGitHub ruleset、Cloudflare認証、Paid plan、Better Auth 1.7 final、dependency安全性、staging E2E、migration、DO／Workflow、reconciliation、Runbook、旧runtime通信0件を全て満たす。 | 条件未達のmain自動本番を禁止。       | ARCH, AUTH                  |

## 17. 旧文書の案・将来候補

次は情報を保持するが、v0.2の採用仕様ではない。

| ID      | Status | 内容                                                            | 理由・扱い                                                     | Canonical       |
| ------- | ------ | --------------------------------------------------------------- | -------------------------------------------------------------- | --------------- |
| DEC-206 | 未確定 | 複数のPoints管理serviceをMarketsで選択し、1 Auction内で跨ぐ。   | v0.2はDEC-148の1 service固定。将来の分散原子性課題として保持。 | 本書            |
| DEC-207 | 未確定 | `accounts.freeism.app`を外部Account統合serviceとして分離する。  | `other.md`内で分離しない結論も混在。採用しない。               | 本書            |
| DEC-208 | 未確定 | 対面決済、QR決済、店舗履歴をPointsまたはMarketsへ追加する。     | 責務案が揺れており未承認。                                     | 本書            |
| DEC-209 | 未確定 | 外部EC用random claim Token、再発行、seller検証、受渡完了POST。  | 公開落札proofとは別の詳細案。情報を将来案として保持。          | MARKETS         |
| DEC-210 | 未確定 | GitHub Issue／PRと連動してポイントを直接消費する。              | 外部write APIと運用が未確定。                                  | POINTS          |
| DEC-211 | 対象外 | 外部service向け任意debit、出品、bid、購入等のpublic write API。 | v0.2はread APIとMarkets内部OAuth Resource APIに限定。          | POINTS, MARKETS |
| DEC-212 | 対象外 | Pay-as-bid、VCG、reverse Auction、市場型報酬。                  | v0.2はuniform-price Auctionだけ。                              | MARKETS         |
| DEC-213 | 対象外 | Pointを一定期間預けて返還、消費なし、sellerへ譲渡する購入方式。 | v0.2のAuctionは消費だけ。                                      | MARKETS         |
| DEC-214 | 対象外 | Capture後refund、借入・返済台帳、条件付き代理購入。             | v0.2では不可変captureと外部運用。                              | POINTS          |
| DEC-215 | 対象外 | 限定公開の落札proof。                                           | v0.2 proofは公開・永続。                                       | MARKETS         |
| DEC-216 | 対象外 | ORCID、X、Discord、Apple等のSocial Account Provider。           | v0.2 PointsはGoogle＋GitHub、MarketsはGoogleのみ。             | AUTH            |
| DEC-217 | 対象外 | TanStack DB、OPFS、Query永続cache。                             | DEC-160により不採用。                                          | ARCH            |
| DEC-218 | 対象外 | 定期R2 DB backup、30日超の長期backup Workflow。                 | DEC-189により将来検討。                                        | ARCH            |
| DEC-219 | 対象外 | PRごとの公開Cloudflare Preview環境。                            | DEC-179により不採用。                                          | ARCH            |
| DEC-220 | 対象外 | 旧Vercel／Supabase／Upstashをfallbackとして残す。               | 後方互換不要・DEC-191により撤去。                              | ARCH            |

## 18. 既存v0.2から保持する機能要件

次は旧実装方式を保持するという意味ではなく、会話で確定した新しい責務・技術境界へ読み替えて保持する機能要件である。

| ID      | Status | 内容                                                                                                                   | 上書き・注意                                                                             | Canonical             |
| ------- | ------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------- |
| DEC-221 | 採用   | Pointsの公開プロフィール、名前／ID検索、評価軸／Package検索、認証済み外部URL表示を保持する。                           | Prisma／PostgreSQL全文検索方式は保持しない。                                             | POINTS                |
| DEC-222 | 採用   | プロフィール、評価軸残高、transfer／exchange／FIX履歴は項目ごとの公開設定を持ち、認証済み非公開APIは`no-store`とする。 | `other.md`の空欄メモではなく旧v0.2の具体要件を継承。                                     | POINTS                |
| DEC-223 | 採用   | プロフィールには外部URLを最大30件登録でき、OAuth／Web検証状態と検証日時を表示できる。                                  | 所有権判定はAUTHのepoch仕様を優先。                                                      | AUTH, POINTS          |
| DEC-224 | 採用   | 読取専用Public APIとしてPoints残高・公開ユーザー情報、Markets落札proof／Shields向け情報を提供する。                    | 外部からのwrite取引APIはDEC-211により対象外。                                            | API, POINTS, MARKETS  |
| DEC-225 | 採用   | CSV操作はfile選択button、server検証後の確認画面、全error一覧を基本とし、drag-and-dropと永続draftを使わない。           | 旧Next.js form実装は保持しない。                                                         | POINTS, MARKETS       |
| DEC-226 | 採用   | `/terms`、`/privacy`、`/help`、`/docs`を保持し、SSGで配信する。                                                        | Google Docs埋込みとNext.js依存を保持しない。                                             | ARCH                  |
| DEC-227 | 採用   | 日時は保存・APIではUTC、表示では利用者のlocal timeを用いる。                                                           | client時刻をAuction orderingには使わない。                                               | API, AUCTION          |
| DEC-228 | 採用   | 公開URLは名前ではなく不変IDを使用し、名前変更後もURLを維持する。                                                       | 旧`/dashboard` prefixだけを廃止。                                                        | ARCH, POINTS, MARKETS |
| DEC-229 | 未確定 | 一つのブラウザで複数プロフィールSessionを保持し切り替える旧機能。                                                      | 旧Cookie実装はhost-only／`storeAccountCookie: false`と未整合。機能採用を確定していない。 | 本書                  |

## 19. 実行可能性のための補完決定

| ID      | Status   | 内容                                                                                                                                                                                                                                                                                                                                                | 理由・扱い                                                                                                                                                           | Canonical             |
| ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| DEC-230 | 採用     | Terraform remote stateは専用Cloudflare R2 bucketのS3 backendに保存し、`use_lockfile=true`、bucket-scoped credential、GitHub Environment Secret、同時lock実証を必須にする。                                                                                                                                                                          | CIのlocal state・無lock applyを禁止する。アプリDBの定期R2 backupとは別用途。                                                                                         | ARCH                  |
| DEC-231 | 採用     | Markets出品CSVはPoint Package IDと不変Revision IDを必須とし、Pointsの不変Revision public APIで組合せ、構成、minimumUnit、content hashを検証してsnapshotする。                                                                                                                                                                                       | Revisionの所属Package不一致と古い可変参照を禁止する。経済計算の正本はPoints D1に残す。                                                                               | API, POINTS, MARKETS  |
| DEC-232 | 採用     | Settlement手動retryはMarketsに別ADMINを作らず、同じMarkets OAuth Client IDの専用Authorization Code + PKCE grantでPoints ADMIN＋Google freshを検証し、対象へ束縛した60秒・一回限りassertionをMarketsが消費する。                                                                                                                                     | 通常user／Refresh／M2M scopeへの管理権限混入と、PointsによるMarkets Workflow実行を禁止する。                                                                         | AUTH, POINTS, MARKETS |
| DEC-233 | 採用     | 交換比率は同格ADMIN＋Google freshがCSVで登録する有向pair別の不変Revisionとし、ACTIVEは正の整数比率、DISABLEDは比率なし、出力はtarget minimumUnitへ切り下げる。                                                                                                                                                                                      | 旧評価軸別ADMINとGUI formを廃止し、未登録／旧0比率を明示DISABLEDへ置換する。過去参照は保持する。                                                                     | POINTS                |
| DEC-234 | 採用     | FIX CSVの宛先入力は外部プロフィールURLだけとする。GitHub profile URLはvalidation時と最終commit時にGitHub APIで数値Account IDへ解決し、`identityResolvedAt=commit時刻`の不変snapshotをFIX revisionへ保存する。                                                                                                                                       | raw identity key入力を禁止し、username rename／reuse後も`providerId + accountId`で受領者を判定する。過去の`evaluationAt`時点のusername所有者を復元したとは扱わない。 | AUTH, POINTS          |
| DEC-235 | 採用     | `/`は`/index.html`へ出力する静的SPA shellからhydrateするtop routeとし、top本体のSSGとは扱わない。build-time SSGは`/terms`、`/privacy`、`/help`、`/docs`だけを明示生成する。                                                                                                                                                                         | DEC-154のshell pathを維持してDEC-155の出力衝突を解消する。自動discovery／crawlを禁止する。                                                                           | ARCH                  |
| DEC-236 | 採用     | Static Assetsは`not_found_handling=none`、`html_handling=auto-trailing-slash`、`assets_navigation_has_no_effect`とし、navigation missだけWorkerがAsset Bindingのcanonical `/`からshellを返す。                                                                                                                                                      | 新しいcompatibility dateでもasset-firstと安全なcustom fallbackを両立する。                                                                                           | ARCH                  |
| DEC-237 | 採用     | `point_ledger_entries`だけを経済正本とし、`point_accounts` projectionはledger INSERT triggerだけが更新する。消費系preconditionとreservation遷移はD1 guard triggerの`RAISE(ABORT)`でbatch全体を失敗させる。                                                                                                                                          | 条件付きUPDATE 0行を成功扱いする実装とapp側projection二重更新を禁止する。                                                                                            | POINTS                |
| DEC-238 | 採用     | 通常Points–Markets unlinkは専用Google-fresh grantでPoints側app-owned grantを先に無効化し、revocation outboxとreceiptを確定後にMarkets localを閉じる。外部失効は新規user操作だけを止め、既存reservationのM2M精算を継続する。                                                                                                                         | ACTIVE reservation中の通常unlink拒否と、既発行tokenの即時無効化を両立する。                                                                                          | AUTH, POINTS, MARKETS |
| DEC-239 | 採用     | 業務mutationのGETは禁止するが、OAuth callback GETは単回state／code消費と期限付きpending protocol state保存だけを許可し、経済状態・Workflow・grant statusは後続CSRF POSTだけが変更する。                                                                                                                                                             | OAuth callbackの安全な相関保存とGETの副作用禁止を区別する。                                                                                                          | AUTH                  |
| DEC-240 | 採用     | Web URLは環境別Cronで30日ごとに再検証し、初回失敗、3日後、7日後の3attemptをD1 leaseで実行する。claim前には評価軸別正味合計・正負件数と選択不可集合hashをpreviewし、fresh後に再確認する。                                                                                                                                                            | 利用者操作なしでも期限を進め、負を隠した選択claimと古いpreview確定を防ぐ。                                                                                           | AUTH, POINTS          |
| DEC-241 | 採用     | 一般browser JSONは64KiB、CSVは5MiB、Points–MarketsのM2M reservation status／capture／releaseだけ1MiBとする。                                                                                                                                                                                                                                        | 最大1,000 winnerを扱いつつ、用途不明な大容量bodyを許可しない。                                                                                                       | API, POINTS, MARKETS  |
| DEC-242 | 採用     | 汎用Web URLの初回所有権confirmは、そのURLに過去から蓄積した未受領の正負FIXを評価時刻にかかわらず選択不可で一括claimする。再所有者だけは3回目成功の`effectiveAt`以後へ限定する。                                                                                                                                                                     | 未登録者への先行FIXを利用者獲得戦略として成立させつつ、別人への過去FIX移転を防ぐ。DEC-076の時刻下限は再所有へ適用する。                                              | AUTH, POINTS          |
| DEC-243 | 承認対象 | Web再所有の3成功は、2回目を1回目から5日後以降、3回目を2回目から5日後以降かつ開始から14日以内とし、早すぎる成功はcountしない。                                                                                                                                                                                                                       | 会話で確定した「14日間に3回」を一意に実装するための補完値。`effectiveAt`は3回目成功時刻のまま。                                                                      | AUTH                  |
| DEC-244 | 採用     | Google step-upはOIDC `claims`で`auth_time`を必須要求し、署名／nonce／issuer／audience／subject／時刻を検証する。`prompt=login`／未掲載`max_age`へ依存せず、Better Authと実Googleのlive spike不成立時はreleaseを止めて再承認する。                                                                                                                   | DEC-082の未検証parameterを上書きし、15分freshという承認済み不変条件自体は維持する。                                                                                  | AUTH                  |
| DEC-245 | 採用     | Static AssetsとHonoへ同じCSP、nosniff、no-referrer、Permissions Policy、frame拒否、環境別HSTSを適用し、inline scriptはbuild artifactのhashだけを許可する。                                                                                                                                                                                          | scriptの`unsafe-inline`／`unsafe-eval`、環境外origin、OAuth callback cacheを禁止する。                                                                               | ARCH, AUTH            |
| DEC-246 | 採用     | OAuth後のreturn先は任意URLを保存せず、connectionは`/settings/points-connection`、Settlement retryはstate束縛済み`/settlements/{id}`へ固定し、query／fragment／別origin／separator難読化を拒否する。                                                                                                                                                 | stateへ束縛するだけのopen redirect対策を強化する。                                                                                                                   | AUTH, MARKETS         |
| DEC-247 | 採用     | Workers Logs／Traces、app別Analytics Engine、D1 `ops_alerts`、5分Cron monitor、固定Email Routing destination、Cloudflare native runtime alertを組み合わせる。観測失敗をdomain成功／失敗の根拠にしない。                                                                                                                                             | D1状態のcustom alertとCloudflare native error／usage alertを分離し、stagingでOPEN→dedupe→RESOLVEDを実証する。                                                        | ARCH, POINTS, MARKETS |
| DEC-248 | 採用     | Points–Markets linkはopaque attemptを作り、Token交換後のgrantを`PENDING_MARKETS_CONFIRMATION`に置き、Markets local保存後のM2M `CONFIRM` receiptでだけ両側をACTIVEにする。失敗時は`CANCEL`／10分TTLで新attemptだけを失効する。                                                                                                                       | cross-D1の片側だけACTIVEになる窓を閉じ、既存connectionをrollback対象にしない。                                                                                       | AUTH, POINTS, MARKETS |
| DEC-249 | 採用     | 4固定routeはURL／query／HTMLをlocale別に増やさず、同じ静的HTMLへ日本語正本と英語参照訳を全文renderする。JavaScript無効時は両方を表示し、有効時は保存値→browser言語→日本語fallbackで表示だけを切り替える。                                                                                                                                           | 4 route／5 HTMLとlocale非依存cacheを維持しながら日本語・英語要件を満たす。英語はproduction前bilingual review必須。                                                   | ARCH                  |
| DEC-250 | 採用     | listing／Auctionは作成者だけが開始前にversion付きPATCH／取消でき、`DRAFT`または`SCHEDULED`から`CANCELLED`への遷移を終端とする。bid、AutoBid、buy-now holdが1件でもあれば取消を原子的に拒否する。                                                                                                                                                    | v0.2に保持した開始前編集・取消をD1 CAS、履歴保持、DO alarm cleanupまで一意化する。                                                                                   | MARKETS               |
| DEC-251 | 採用     | AuctionRoomはD1 current revisionを正本に1 alarmだけを持ち、`startsAt`でOPEN、`endAt`でCLOSINGへCASする。WebSocket上限はuser全体20／user＋Auction 3のD1 unique slotを同じ原子commandで確保する。                                                                                                                                                     | alarm遅延、再deploy、旧revision、異なるDO間の同時接続でも状態と上限を守る。                                                                                          | MARKETS               |
| DEC-252 | 承認対象 | Settlement外部callのtimeout／attempt／最大経過をreserve 8秒×3・round 5分、status 5秒×3・30秒、capture 10秒×5・2分、release 5秒×5・2分、finalize 10秒×3・1分とし、上限時はreason付きmanual actionへ単調遷移する。                                                                                                                                    | Workflowの暗黙既定を排除する補完値。全stepはexponential backoff、確定的errorはretryしない。                                                                          | MARKETS               |
| DEC-253 | 採用     | capture時不足はM2M限定`insufficientReservationIds`でrequest内・自client所有IDだけを返し、Marketsは該当userを除外して旧ACTIVEを全releaseし同cutoffから再計算する。0価格winnerも0-vector reservation receiptをCAPTUREDにするがledgerを作らない。                                                                                                      | 負FIX後の原子capture拒否を決定的に再計算でき、0 tick uniform-priceも履歴としてsettleできる。                                                                         | API, POINTS, MARKETS  |
| DEC-254 | 承認対象 | listingはtitle 1〜120 code point／480 bytes、description 1〜4,000／16,000 bytes、canonical HTTPS外部URLちょうど1件／2,048 bytesとする。reviewはcomment 0〜2,000／8,000 bytes、completion URL 0〜1件／2,048 bytesとする。                                                                                                                            | CSV／API／UIのUnicode・D1境界を一致させる補完値。                                                                                                                    | MARKETS               |
| DEC-255 | 採用     | immutable proofからreviewを分離し、current reviewとappend-only revision履歴を別resourceにする。proofは1年immutable、review collectionは60秒＋`stale-while-revalidate=300`とする。                                                                                                                                                                   | review更新でproof body／hash／ETagを変えず、履歴とcurrent表示を両立する。                                                                                            | MARKETS               |
| DEC-256 | 承認対象 | 不変Package Revisionの履歴`status`と現在の出品可否を分離する。Marketsは最大1,000件のM2M `checkPointPackageListingEligibility`を1MiB以内で呼び、現在ACTIVEなPackageだけに30秒receiptを発行する。`currentRevisionId`一致は求めず過去の`status=ACTIVE` revisionも許可し、INACTIVE後も発行済みreceiptの期限内commit開始は許可する。                     | immutable public responseだけでは後日のINACTIVEを判定できないため。receiptはClient ID、command ID／hash、全itemへ束縛し、同じ冪等keyの再送で期限を延長しない。       | API, POINTS, MARKETS  |
| DEC-257 | 承認対象 | Packageはname 1〜60 code point／240 bytes、description 0〜500／2,000 bytes、canonical HTTPS URL 0〜1件／2,048 bytesとする。NFKC＋Unicode空白圧縮＋locale非依存小文字化した名前を状態に関係なく一意とし、Public content hashへstatus、表示field、package tick、componentの軸revision／name／displayOrder／weight／minimumUnit／buy-now可否を含める。 | CSV、D1、Public API、Markets再計算の文字・hash境界を一意化する補完値。                                                                                               | POINTS, API           |
| DEC-258 | 承認対象 | CSV exportは物理化snapshotを最大50,000行／50MiB、1行8KiB、1page最大1,000行／8MiB、作成から30分のHMAC cursorとし、100行ずつstreamしてapp bufferを2MiB以下にする。                                                                                                                                                                                    | source更新のpage混在、Workers memory過大使用、無期限cursorを防ぐ補完値。                                                                                             | POINTS                |
| DEC-259 | 承認対象 | 貢献評価代用は有向method revisionとUTC月別result revisionを分け、正規FIXだけをsourceにし、`source × similarity × exchange rate`をBigIntで計算してtarget minimumUnitへ0方向切捨てする。再計算は旧resultとの利用者和集合へ差分ledgerだけを追加する。                                                                                                  | cycle／二重付与／負値の丸め／訂正先落ちを一意にする補完方式。                                                                                                        | POINTS                |
| DEC-260 | 承認対象 | 自動分配は正FIXだけを対象に、PERCENT 0.001〜100%または固定保持額をminimumUnitへ切下げ、Package componentごとの`max(evaluationTotal,0) × weight`をscoreとする最大剰余方式で配り切る。対象者とcreditは各1,000上限、訂正は初回snapshotの同じ対象へ差分だけを追加する。                                                                                 | 浮動小数、非決定tie、暗黙上位切捨て、訂正時の対象差替えを防ぐ補完方式。                                                                                              | POINTS                |
| DEC-261 | 承認対象 | Account closeは永久OAuth ownershipをINACTIVE、ACTIVEな汎用Web epochを`endedAt`で終了し、close中の正負FIXを未受領で保留する。再開は永久主体の全保留FIXを選択不可previewし、Google fresh＋`reopenSetHash`でACTIVE化、永久ownership再有効化、正負一括claim／ledger、Session rotationを原子的に行い、汎用Webと匿名化属性は復元しない。                  | 永久主体で元userへ戻す既存方針と、close中FIX／負残高／Web再所有の扱いを閉じる補完方式。                                                                              | AUTH, POINTS          |

## 20. 文書適用規則

1. `採用`行だけをv0.2の規範として扱う。
2. `上書き済み`・`撤回`行をcanonical仕様へ併記する場合は、採用案ではなく履歴として明示する。
3. `未確定`・`対象外`行を実装計画へ入れない。
4. 旧文書と本台帳が衝突する場合は、後発の`採用`行とそのCanonical documentを優先する。
5. 新しい変更は既存行を書き換えて履歴を消さず、新しいDEC IDから上書き対象IDを参照する。
