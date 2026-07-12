# Webアプリ v0.2 横断アーキテクチャ

## 文書の位置付け

この文書は、`points.freeism.app` と `markets.freeism.app` に分割する v0.2 の横断仕様の正本である。個別機能の詳細は各アプリの `docs/v0.2/`、認証・連携契約・運用は同じディレクトリの各文書を参照する。

- v0.2 は未リリースのテスト環境を作り直すため、後方互換性を持たせない。
- Supabase PostgreSQL から D1 へのデータ移行、旧ユーザー・セッション・ポイント・オークションデータの移行は行わない。
- 旧モノリスの観測記録や未確定案は `../archive/` に保存するが、v0.2 の規範にはしない。
- 矛盾する記述がある場合は、この文書、`decision-register.md`、個別の v0.2 正本、v0.1 履歴の順に優先する。

## 1. リポジトリと文書の境界

### 1.1 アプリケーション

| プロジェクト               | 公開ドメイン          | Worker名         | 責務                                                              |
| -------------------------- | --------------------- | ---------------- | ----------------------------------------------------------------- |
| `projects/points-web-app`  | `points.freeism.app`  | `points-worker`  | 認証、評価軸、FIX、残高、台帳、予約、capture/release              |
| `projects/markets-web-app` | `markets.freeism.app` | `auction-worker` | 独立認証、商材情報を含むAuction、入札、リアルタイム配信、精算saga |

両プロジェクトは、それぞれフロントエンドとバックエンドを同じプロジェクト内で管理する。旧 `projects/web-app` は移行完了後に削除する。

### 1.2 文書

- アプリ固有仕様: `projects/points-web-app/docs`、`projects/markets-web-app/docs`
- アプリ固有実行計画: 各プロジェクトの `plan/`
- 横断仕様・API契約・設計判断: `docs/web-app/`
- 横断実行計画: `plan/web-app/`
- v0.1 の混在資料と撤回済み検討案: `docs/web-app/archive/`

仕様と実行計画を混在させない。仕様書は「何を保証するか」、planは「どの順序で、どのファイルを変更し、どう検証するか」を記載する。

## 2. 責務とデータ所有境界

### 2.1 Points

Pointsだけが次のデータを所有し、更新できる。

- PointsユーザーとBetter Authの認証・Social Account対応
- グローバルな同格ADMIN
- 評価軸、評価軸設定、公式パッケージと不変revision
- FIX評価結果、FIX revision、差分台帳、未受領FIX
- `balance`、`evaluationTotal`、予約、capture/release
- 外部URL・GitHub主体の所有権状態とownership epoch
- Marketsとの1対1連携、およびPoints OAuth Provider

Marketsはこれらを複製して正本にしない。Auction表示に必要な名称・比率・ユーザー表示情報は、不変snapshotまたはPoints APIから取得した表示用データとして保持する。

### 2.2 Markets

Marketsだけが次のデータを所有し、更新できる。

- Marketsユーザーと独立したBetter Authセッション
- 商材情報とAuction設定を統合したAuction／不変Auction revisionと公開snapshot
- bid command、bid sequence、AutoBid状態、watchlist
- AuctionRoom Durable Objectの接続状態と配信用状態
- Auctionの終了判定、winner計算、clearing price
- Settlement Workflow、outbox、精算saga状態
- 落札証明、取引完了証明、seller/buyer相互評価

### 2.3 廃止する境界

- Taskは完全廃止する。MarketsにもPointsにもTask作成機能を置かない。
- Groupと一般コミュニティメンバー管理は完全廃止する。
- 評価結果のdraft、承認待ちFIX、一般memberの権限は持たない。アップロードはFIX結果だけを受け付ける。
- 通知基盤、メール、Web Push、アプリ内通知、予約通知は廃止する。操作結果を示すtoastはUI部品として残す。
- PWA、Service Worker、offline cache、画像アップロード、Q&A、chatは廃止する。

## 3. 認証とサービス連携

詳細は [authentication.md](./authentication.md) と [points-markets-contract.md](./points-markets-contract.md) を正本とする。

- PointsとMarketsは別ユーザー・別セッション・host-only Cookieを持つ独立アプリである。
- Marketsは独立アカウントを作り、利用者が後からPointsを明示連携する。
- 有効なPoints–Markets連携は、各環境内で1対1とする。
- PointsのSocial Provider集合はGoogleとGitHubである。両方をログイン画面と既存ユーザーへの明示連携画面に同じように表示する。
- Provider単位のlink-onlyを実現する独自sign-in拒否hookは実装しない。
- 本人識別は`providerId + accountId`で行い、メール一致による暗黙linkを禁止する。
- GitHubはログインにも使えるが、外部アカウント所有権確認の対象でもある。
- 重要操作は15分以内のGoogle fresh sessionを必須とする。GitHubだけで作成したPointsユーザーは、重要操作の前にGoogleを明示linkしてstep-upを完了する。

## 4. Pointsドメイン

### 4.1 評価軸とADMIN

- v0.2はグローバルな単一の`ADMIN` roleだけを持つ。すべてのADMINは同格で、すべての評価軸と公式パッケージを管理できる。
- owner、super admin、評価軸別admin、パッケージ別admin、一般memberを作らない。
- 最後のADMINは削除・降格できない。
- 初期ADMINは、ADMINが0人のときだけ、Secretsで指定したGoogle `accountId`と一致するログインを一度だけ昇格する。公開bootstrap routeは置かない。
- 評価軸IDは不変の文字列IDとし、生成にはNano ID相当のURL-safe IDを用いる。
- 評価軸名は30文字以下、説明は200文字以下、関連URLは最大20件とする。
- プロフィールに登録する外部URLは最大30件とする。

### 4.2 固定小数点

- すべてのポイント額はD1の`INTEGER`に、表示値の10,000倍を保存する。固定scaleは`10_000`である。
- 表示値は小数点以下最大4桁まで扱い、設定可能な`minimumUnit`の最小値は`0.0001`である。
- `minimumUnit`はscale適用後に正の整数でなければならない。
- FIX、譲渡、交換、予約、capture、releaseの額は、対象評価軸の`minimumUnit`の倍数でなければならない。
- 浮動小数点`REAL`を残高・比率・価格計算に使わない。入力文字列を10進として検証した後に整数化する。
- 指数表記、Unicodeマイナス、4桁を超える小数、非有限値を拒否する。
- D1 Worker APIが`BigInt`を直接扱わないため、入力・計算途中・保存値・集計値のすべてをJavaScript安全整数範囲内で検証する。

### 4.3 不変FIX revisionと差分台帳

- FIX結果はdraftを持たず、ADMINが最終結果だけをCSVでアップロードする。
- アップロード済みFIX revisionは不変とし、修正時は新しいrevisionを追加する。
- 新revisionの各対象者・評価軸の額と直前revisionとの差分だけを台帳へ記録する。
- 台帳行は不変で、`sourceFixRevisionId`を一意にして同じrevisionの二重反映を防ぐ。
- revision内の全行、差分台帳、`balance`、`evaluationTotal`、未受領状態は1回のD1原子処理で確定し、部分成功を許可しない。
- 負のFIXを許可し、結果として負の残高も許可する。
- `balance`とは別に、FIX評価の符号付き累計`evaluationTotal`を管理する。譲渡・交換・消費・予約・releaseは`evaluationTotal`を変更しない。
- 残高不足時は、譲渡、交換、予約、落札captureなどの消費系操作をすべて拒否する。単に残高が負であること自体は履歴や受領を拒否する理由にしない。

### 4.4 未受領FIXと所有権

- 利用者が未登録でも、正規化した外部プロフィールURLまたはGitHub OAuth主体を宛先として、正負どちらのFIXも先に保存する。
- 未受領FIXは暫定ユーザー残高へ入れない。宛先と評価額を不変FIX revisionに保存し、受領時に実ユーザーの台帳・残高・`evaluationTotal`へ一括反映する。
- 所有権確認後、そのownership epochで受領可能な正負すべての未受領FIXを選択不可で一括受領する。
- 一度受領済みのFIXを別ユーザーへ移動しない。
- GitHubのOAuth主体は最初に対応したPointsユーザーへ永久固定する。所有権利用を無効化している間の新規FIXは保留し、同じ元ユーザーが明示的に再有効化した時に正負を一括受領する。
- 汎用Web URLは所有期間を持ち、再所有時は新しいownership epochを作る。FIXの評価時刻をそのepochへ割り当てる。
- Web再所有の`effectiveAt`は、再所有確認が3回成功したうち3回目の成功時刻とする。
- 自動検証のみを行い、人による手動審査は実装しない。

### 4.5 CSV

- CSVはUTF-8、最大5MiB、1回最大1,000非空行とする。
- header、列数、必須値、値域を厳密に検証し、全エラーを行番号・列名付きで返す。
- client側previewは許可するが、server側draftは保存しない。確認後は1回の原子的POSTで確定する。
- 同一requestの再送は内容hashと`Idempotency-Key`で同じ結果を返し、同じkeyで異なるpayloadは`409`にする。
- 同一ファイル内の重複行はファイル全体を失敗させ、部分反映しない。
- export時は表計算ソフトのformula injectionを無害化する。

## 5. Marketsドメイン

### 5.1 Auction作成

- Marketsで作成するのは、商材情報を内包するAuctionだけである。独立したListing aggregate、ID、revision、routeは作らない。
- Auction作成はCSV-onlyを基本とし、登録前に全件previewとvalidation結果を確認できるようにする。
- Auction cardと詳細には、Pointsの公式パッケージ名・ID、不変revision、構成評価軸、比率を表示する。
- Auctionは販売数量を持つmulti-unit方式とする。
- 入札は価格の高い順、同額は`reachedSequence`が早い順に順位付けする。
- 最後のwinnerだけ部分割当を許可し、全winnerは同じuniform clearing priceを支払う。
- clearing priceが0 tickとなる成立条件を仕様として許可し、`minimumPriceTick`の倍数だけを受け付ける。
- 即決価格、非公開のAutoBid上限、終了間際の延長をサポートする。
- AutoBidを取り消しても、すでに到達・確定した入札額は巻き戻さない。
- sellerの自己入札、終了後の入札、価格tick不一致、数量不正を拒否する。
- server時刻を正とし、clientでは利用者local timeへ変換して表示する。
- 最初の有効bid以後、価格・数量・package revisionなど結果に影響するAuction項目を変更できない。

### 5.2 入札時のPoints扱い

- 入札には有効なPoints連携を必須とするが、入札時に残高照会や予約は行わない。
- 終了時の同一cutoff集合に対し、残高不足・負残高などで予約できないbidderを除外し、winnerとclearing priceを再計算する。
- 不足判定された利用者はAuctionとMarketsユーザーの組に対して1回だけblacklistし、同一終了処理内で再試行しない。
- すべてのwinnerと評価軸は同じPoints service／Points D1に属さなければならない。複数Points serviceを1 Auctionで混在させない。

### 5.3 履歴・証明・評価

- bid、作成したAuction、落札履歴とwatchlistを提供するが、通知は送らない。
- 落札証明は公開read APIで永続的に検証できる。
- 証明にはAuction ID／Auction revision／Package revision、seller/buyer identity snapshot、winner、数量、clearing price、完了状態を含める。
- sellerとbuyerは相互に1〜5の評価、comment、`completionProofUrl`を記録できる。
- 外部EC claim token、匿名配送、対面決済の詳細はv0.2の実装確定事項ではなく将来候補として保持する。

## 6. アプリケーション構成

- Next.jsを廃止し、TanStack Start、React、Vite Plusへ移行する。
- 両アプリともSPAを基本とし、固定した公開routeだけをbuild時にSSG/prerenderする。
- runtime SSR、TanStack Start server functions、Next.js Server Actionsを使わない。
- APIは同一originのHono Workerへ`/api/*`として実装する。
- build成果物はCloudflare Workers Static Assetsで配信する。
- TanStack StartのSPA shellは`/index.html`へ出力する。`/`はbuild時に生成した静的shellからhydrateしてtop routeをclient描画するSPAであり、top route本体のSSGとは扱わない。
- build-time SSGは`/terms`、`/privacy`、`/help`、`/docs`だけに限定し、それぞれ`/terms.html`、`/privacy.html`、`/help.html`、`/docs.html`へ明示出力する。自動static route discoveryとlink crawlを無効にし、公開プロフィール、Auction、proof、認証後画面をprerenderしない。
- 4固定routeの本文正本は[`static-pages/`](./static-pages/README.md)とし、Points／Marketsへ本文を複製しない。利用規約5節とPrivacy Policy 7節は旧Next.js本文を意味損失なく移植し、framework変更と本文変更を分離する。
- 各固定routeはlocale別URL、query、redirect、別HTMLへ分岐せず、1つの静的HTMLへ日本語正本と英語参照訳の全文をrenderする。これにより4 route／5 HTMLとlocale非依存のcache keyを維持する。
- 日本語・英語のcontent containerにはそれぞれ`lang="ja"`、`lang="en"`を付ける。JavaScript無効時は両言語を閲覧可能にし、JavaScript有効時だけ、保存済みの明示選択、browser言語、日本語fallbackの順で初期表示を選ぶ。
- 日本語／Englishの明示toggleはkeyboardとscreen readerで操作でき、切替時にnavigationや追加fetchを行わない。prerender HTMLとhydrate後DOMは同じ両言語contentを保持し、表示状態だけを変更する。
- 日本語Markdownを仕様・法務上の正本、英語Markdownを意味を加減しない参照翻訳とし、その位置付けを各固定HTMLへ日本語・英語で表示する。production release前に日本語・英語のbilingual reviewを必須とし、機械翻訳または英語側の変更で日本語正本を自動更新しない。
- Workers Static Assetsはasset-first、`not_found_handling="none"`、`html_handling="auto-trailing-slash"`とする。`assets_navigation_has_no_effect` compatibility flagでasset missしたnavigationをWorkerへ到達させ、WorkerはGET/HEADのHTML navigationだけAsset Bindingのcanonical `/`からshellを取得して返す。存在しないAPI、JavaScript、CSS、画像へHTMLを返さない。
- browserから別subdomainのAPIを直接呼ばない。各アプリの同一origin BFFを通す。
- server stateはTanStack Queryのmemory cacheを使う。IndexedDB永続cache、Service Worker cache、Next.js cacheを持ち込まない。
- 静的assetはcontent hash付き長期cache、HTMLと認証済みAPIは適切な`no-store`または短い明示cacheとする。
- バックエンドORMはPrismaからDrizzleへ移行し、PostgreSQL固有型・extension・RLSに依存しない。
- API namespaceは`auth`、`app`、`public`、`resource`、`internal`、`oauth`、`well-known`へ分ける。
- 日本語・英語、WCAG 2.1 AA、keyboard操作、screen reader対応を両アプリ共通要件とする。固定公開ページはlocaleごとのcanonical Markdown content hash、両言語のsemantic content、`lang`境界、言語toggleのaccessible name／状態通知を回帰testで保証する。

2026-07-11の調査baselineは、`@tanstack/react-start@1.168.27`、`vite-plus@0.2.4`、`hono@4.12.29`、`drizzle-orm@0.45.2`、`wrangler@4.110.0`である。実装では`^`や`latest`を使わず、このbaselineまたは安全性を再確認した新しい1バージョンへ完全固定する。

## 7. リアルタイムと精算

### 7.1 AuctionRoom Durable Object

- 1 Auctionにつき1つの`AuctionRoom` Durable Objectを割り当てる。
- D1を永続的なSource of Truthとし、DO memoryを正本にしない。
- Durable Object Hibernation WebSocket APIを使う。
- WebSocketはread-only subscriptionとし、bid mutationは認証済みHTTPをHonoからDOへ送る。
- WebSocket URLのqueryへsession/tokenを入れない。upgrade時にOriginとsessionを検証する。
- attachmentへ秘密や巨大payloadを保存せず、識別子だけを保存する。
- client frameは最大4KiB、同一user・Auctionは最大3接続、全Auction合計は最大20接続とする。
- 独自heartbeatは送らず、切断・再接続・gap resyncを前提にする。
- `auctionVersion`と`bidSeq`を単調増加させ、gap検出時はHTTP snapshotを再取得する。
- D1へcommit後にbroadcastし、`(auctionId, commandId)`と`(auctionId, bidSeq)`を一意にする。

### 7.2 Settlement Workflow

- Auction終了時、またはAuctionRoomが要求全数量をlockして`BUY_NOW` plan／outboxを確定した時は、Cloudflare WorkflowsのSettlement Workflowを1件開始する。
- Markets D1のoutboxとsaga状態を正本にし、各stepを冪等・単調状態遷移にする。
- package vector、winner、price、quantityを同じcutoffから確定する。
- Marketsは`pointPackageRevisionId`、`priceTicks`、`quantity`をPointsへ渡し、Pointsが自身の不変package revisionから評価軸vectorを再計算する。
- Points予約は15分。標準introspectionでpairwise subjectを検証したopaque user delegation Access Tokenで予約し、capture/releaseはgrant／scopeを分離したopaque Client Credentials Tokenで行う。
- 1 winnerの全評価軸予約は1回のPoints D1原子処理とし、部分予約を許可しない。
- winner確定後、すべてのcapture/releaseを冪等に完了させる。capture後の自動refundやsaga巻き戻しは行わない。
- Settlement Workflowの再送・再起動は同じidempotency keyと状態から再開する。
- `BUY_NOW`のrestoreは、外部作用開始前、決定的reservation作成拒否でID 0件、または全reservation未capture＋ACTIVE分release完了という3種の証拠だけを受ける内部RPCで全数量を`FAILED_RESTORED`へ進める。結果不明はholdを維持してmanual actionとする。capture後はproof migration適用後の別内部RPCで`CAPTURED_PENDING_FINALIZE`からproofへforward finalizeし、restore／refundしない。endAt時の未終端holdは終了時planを遅延し、全hold終端後の復元済み残数で収束する。

## 8. 環境、ドメイン、デプロイ

- `local`、`staging`、`production`を分離し、D1、Durable Object namespace、Workflow、OAuth app/client、Secretsを共有しない。
- stagingは`staging.points.freeism.app`と`staging.markets.freeism.app`、productionは`points.freeism.app`と`markets.freeism.app`を使う。
- apex `freeism.app`と`www.freeism.app`は`points.freeism.app`へredirectする。
- publicなper-PR preview環境はv0.2で作らない。
- Cloudflare Vite pluginを使うbuildでは`CLOUDFLARE_ENV=staging|production`でnamed environmentを選び、生成されたflattened Wrangler設定をdeployする。`wrangler deploy --env`だけでbuild済み成果物の環境を切り替えない。
- D1 migrationは前方互換の段階migrationにし、状態migrationを伴う自動rollbackを行わない。
- v0.2では定期R2 backupを作らず、D1 Time Travelと復旧runbookを用意する。
- Vercel、Supabase、Upstashは受入完了後にdomain、env、cron、projectを撤去する。

### main pushの本番pipeline

`main`へのpushだけをproduction deployの起点とする。手動production承認は置かない。

1. validate、typecheck、unit/integration test、supply-chain検査
2. Points staging deploy
3. Markets staging deploy
4. staging E2Eと精算reconciliation
5. Points production deploy
6. Markets production deploy
7. production smoke test

staging失敗時はproductionへ進まない。Pointsだけproductionへ進んだ場合でも、旧Markets productionと互換なAPI contractを保つ順序でdeployする。production concurrencyは直列queueとし、実行中deployをcancelしない。

## 9. セキュリティ、品質、release gate

詳細は [security-and-delivery.md](./security-and-delivery.md) を正本とする。

- Cloudflare edge、Hono authn/authz、D1/DO invariantの多層防御を使う。
- browser mutationは同一origin、JSON、CSRF/Origin/Fetch Metadata検証、最大64KiBを基本とする。CSVだけは別途5MiB上限を適用する。
- Service Binding越しでもOAuth bearer tokenをPoints Worker内のBetter Auth標準Resource Clientによるin-process introspectionへ通し、`active`、issuer、audience/resource、client、scope、利用者Tokenのpairwise subjectを検証する。利用者principalはpairwise `sub`あり＋利用者scopeだけ、M2M principalは利用者`sub`なし＋M2M scopeだけから導出し、独自token-class claim、JWT Access Token、内部Points user IDをcross-app identityにしない。
- 重要mutationは`Idempotency-Key`を必須にする。
- ledger、FIX、永久OAuth主体対応、監査eventをcascade deleteしない。退会時はprofileをclosed/anonymizedにする。
- URL fetchはHTTPS/443だけを許可し、IP literal／localhost／private・reserved hostnameを入力時に拒否し、manual redirectの各hopを同じ規則で再検証する。`global_fetch_strictly_public`を有効にし、Cloudflareのpublic Internet egress制約をDNS rebinding時の接続防御に使う。Workers `fetch()`が実接続先IPを公開しないため、アプリが「接続直前のIP」を独自検査できるとは規定しない。
- 依存versionを完全固定し、lockfileをcommitする。`minimumReleaseAge`は4,320分、`blockExoticSubdeps`を有効にし、install scriptはallowlist化する。
- Better Authは開発・stagingで`1.7.0-rc.1`を完全固定し、productionは1.7正式版への更新と全認証回帰test完了をrelease条件にする。
- 2026-05のTanStack npm supply-chain incidentで影響を受けたversionをblockし、導入前に公式advisoryとlockfileを再確認する。
- GitHub Actionsはfull commit SHA、最小permissions、PR由来cacheをdeployに使わない構成にする。
- `main`はdirect push、force push、deleteを禁止し、required checks、up-to-date、merge queueを必須にする。現在1名運用中はapproval 0、2人目のmaintainer追加時に1へ変更する。
- 全体coverage率だけのrelease gateは設けず、金額、FIX、所有権、OAuth、Auction ordering、DO resync、settlement saga、migrationのinvariant testを必須にする。
- 4固定公開ページは日本語・英語のcontent hash一致、keyboard／screen reader操作、JavaScript無効時の両言語可読性、hydration不一致0を必須testとする。英語参照訳のbilingual review記録がないreleaseをproductionへ進めない。

## 採用しないもの

- Next.js、Auth.js/NextAuth、Prisma、Supabase、Vercel、Upstash Redis、SSE
- email/password、Apple、ORCIDのv0.2認証Provider
- provider別link-onlyを作る独自Better Auth sign-in拒否hook
- email一致によるaccount merge、暗黙link、手動審査
- PostgreSQL型、RLS、PGroonga、`REAL`による金額計算
- 複数Points serviceを選ぶ実装、独立accounts service、`api.points.*`の別公開domain
- reverse auction、VCG、pay-as-bid、借入、refund、外部向けwrite transaction API

## 参照した公式資料

- [Better Auth User & Accounts](https://better-auth.com/docs/concepts/users-accounts)
- [TanStack Start on Cloudflare](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [TanStack Start SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/)
- [Drizzle ORM with D1](https://orm.drizzle.team/docs/connect-cloudflare-d1)
- [Hono on Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)
