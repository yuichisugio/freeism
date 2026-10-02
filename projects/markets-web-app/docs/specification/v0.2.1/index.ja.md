# Freeism Markets v0.2.1 仕様

- [Freeism Markets v0.2.1 仕様](#freeism-markets-v021-仕様)
  - [言語](#言語)
  - [v0.2.1：実装する理由](#v021実装する理由)
  - [v0.2.1：基本方針](#v021基本方針)
  - [要件](#要件)
    - [5.1 Auction作成](#51-auction作成)
    - [5.2 入札時のPoints扱い](#52-入札時のpoints扱い)
    - [5.3 履歴・証明・評価](#53-履歴証明評価)
    - [7.1 AuctionRoom Durable Object](#71-auctionroom-durable-object)
    - [7.2 Settlement Workflow](#72-settlement-workflow)
    - [branch pushのdeploy pipeline](#branch-pushのdeploy-pipeline)
  - [9. セキュリティ、品質、release gate](#9-セキュリティ品質release-gate)
  - [採用しないもの](#採用しないもの)

## 言語

日本語（本ページ）| [English](./index.en.md)

## v0.2.1：実装する理由

1. 無料主義ドキュメントv3に、大幅な仕様変更があったため

## v0.2.1：基本方針

1. `v0.2.1`**は、「実用性」・「移植性」・「仕様理解の簡単さ」を優先する**
   - 説明
     - 本質的な機能のみ実装する
     - `ver0.1`はポートフォリオ的にいろいろな機能を実装したが、`ver0.2`は本質的な機能のみ残す
     - 他者がコードを読んで、「無料主義の仕様・したいこと」を理解してもらう必要がある
2. **設計の大原則**
   1. 疎結合
      - 評価軸、評価ロジック、データ取得元が、いつでも簡単に差し替えられるように設計
      - ファイルもタスクごとではなく、評価軸ごとに分けた
      - 「評価ロジック」、「評価軸」のフォルダごと削除しても、他は通常通り動作するよう設計
      - 冗長的な部分があるが、疎結合さを優先
   2. 可読性
      - 可読性のために、シェルスクリプトはファイルを分ける。
   3. 簡潔さ
      - より多くの人に理解してもらうために、堅牢性を求めず、簡単にすぐ理解できて短い必要最小限のコードにする
      - リッチな機能は提供せず、簡単に素早く理解できるようにシンプルな機能のみにする
      - アプリとして実用するのではなく、どんなサービスか体験してもらうだけ
      - リッチなUIは不要
3. **バンドルサイズを小さくする**
   - サービスを早く表示するため、バンドルサイズを可能な限り小さくする。
   - 未使用コードを残さず、HTTP caching、ETag、長期キャッシュ、filename hashingによって、変更されていないscriptを再転送しない。
   - サイズが大きいSVGは`<img>`として読み込む。
   - 参考記事は[catnose99の記事](https://zenn.dev/catnose99/articles/nani-translate)とする。
4. **定数管理**
   - 説明
     - それぞれのパラメータは、すぐに変更できるように、定数ファイルを作成して管理する
5. **できる限りサーバーの負荷をかけず、サーバーのアクセス回数も減らす設計**
   - 説明
     - 可能な限りキャッシュを行い、できる限りState管理で最終タイミングのみサーバーへリクエストして登録する
6. **商品発送・住所の管理などは不要**
   - 説明
     - モノの発送が必要な場合は、他サービスを使用して行う。
     - その発送の証拠のみをアプリ内のレビュー画面で記載するのみ
7. **後方互換性は不要**
   - 説明
     - データ移行、後方互換性は不要
8. **注意**
   - 説明
     - ここに記載されていない仕様に関しては、無料主義アプリv0.1と同じ仕様

## 要件

- Marketsは、複数のポイント管理サービスと連携して、それぞれのポイントを使用できるようにしたい
  - 決済時に、自由に選べるようにしたい。
  - さらに、複数のポイント管理サービスから選択できるようにしたい

- EC
  - ECもしたい訳では無い。外部ECと連携できるようにしたい
  - なので、その外部連携APIが欲しい
  - ECは別サービスととして切り出す。それで他ECがAPIと同じ方法でやり取りするのを
  - ECや他のあらゆる取引に必要なAPIを用意する

- Cloudflare Durable Objectを使用して、リアルタイム更新する
  - 使わない状態を実現するために、setTimeout/setIntervalしない
  - Upstash Redis Pub/Subとは違い、接続数ではなく時間で課金される。なので課金数が少なくなるよう実装する。
    - また、ハートビートも不要
  - WebSocketで実装する
  - Workersからアクセスする場合は常にれRequestsを消費する
    - さらに、クライアントからサーバーへWebSocket通信する場合は20ぶn20分の1のRequestsを消費する
  - Durationは、処理中にメモリを使用した時間

| `projects/markets-web-app` | `markets.freeism.app` | `auction-worker` | 独立認証、商材情報を含むAuction、入札、リアルタイム配信、精算saga |

- Marketsユーザーと独立したBetter Authセッション
- 商材情報とAuction設定を統合したAuction／不変Auction revisionと公開snapshot
- bid command、bid sequence、AutoBid状態、watchlist
- AuctionRoom Durable Objectの接続状態と配信用状態
- Auctionの終了判定、winner計算、clearing price
- Settlement Workflow、outbox、精算saga状態
- 落札証明、取引完了証明、seller/buyer相互評価

### 5.1 Auction作成

- Marketsで作成するのは、商材情報を内包するAuctionだけである。開始前の編集もAuction IDだけを使う。
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

- すべてのwinnerと評価軸は同じPoints service／Points D1に属さなければならない。複数Points serviceを1 Auctionで混在させない。

### 5.3 履歴・証明・評価

- bid、作成したAuction、落札履歴とwatchlistを提供するが、通知は送らない。
- 落札証明は公開read APIで永続的に検証できる。
- 証明にはAuction ID／Auction revision／Package revision、seller/buyer identity snapshot、winner、数量、clearing price、完了状態を含める。
- sellerとbuyerは相互に1〜5の評価、comment、`completionProofUrl`を記録できる。
- 外部EC claim token、匿名配送、対面決済の詳細はv0.2の実装確定事項ではなく将来候補として保持する。

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

- Auction終了時に、Cloudflare WorkflowsのSettlement Workflowを1件開始する。
- Markets D1のoutboxとsaga状態を正本にし、各stepを冪等・単調状態遷移にする。
- package vector、winner、price、quantityを同じcutoffから確定する。
- Marketsは内部の`priceTickCount`へsnapshot済み`packageTick`を乗じ、安全整数のscale済み`priceTicks`へ変換してから`pointPackageRevisionId`、`quantity`とともにPointsへ渡す。Pointsは自身の不変package revisionから評価軸vectorを再計算する。
- Settlement Workflowの再送・再起動は同じidempotency keyと状態から再開する。

1. `minimumReleaseAge: 4320`を使う
2. Better Auth のメール一致 implicit link は禁止し、本人は `providerId + accountId` で識別する。
3. OSSライセンスのページを用意する
4. Google/GitHubのOAuth認証を login/linkで用意する
5. PointsとMarketsの落札精算は利用者認可だけを使う。Accounts照合でクライアント資格情報が必要な場合は、その連携の仕様に従う。
6. named env の routes は staging/production domain を `custom_domain: true` で所有する。Terraform 側には同じ custom domain resource を書かない。
7. `main`の直接更新は行わず、branch／PR／merge queue経由で反映する。
8. 後方互換、旧 URL/API/schema/session fallback、旧データ移行を実装しない。
9. runtime SSR、TanStack server functions、Next Server Actions を使わない。
10. Static Assetsは次の形にし、Cloudflareの既定値に暗黙依存せず`not_found_handling: "none"`を明示する。汎用`single-page-application` fallbackは使わない。
11. Better Authは公式の`better-auth/minimal` entrypointを使い、未使用のKysely adapterをWorker bundleへ含めない。
12. 日本語と英語に対応する
    - 言語切替は同一originの`localStorage` key `freeism.fixed-page-language.v1`へ`ja|en`だけを保存する。
    - 初期値resolverは、JavaScript有効時は、同一originに保存済み有効値、`navigator.languages`内で最初に現れる`ja|en`、`en`の順で決定し、URL／query／Cookie／server content negotiation/未知／破損した保存値は参照しない。
13. Task/Group/一般 member/notification/PWA/image upload/Next.js/Auth.js/Prisma/Supabase/Upstash/SSE を新実装へ持ち込まない。
14. Points と Markets は別 Better Auth、別 host-only Cookie、別 D1、別 user ID、別 session を持つ。

- 廃止する機能
  - Taskは完全廃止する。MarketsにもPointsにもTask作成機能を置かない。
  - Groupと一般コミュニティメンバー管理は完全廃止する。
  - 評価結果のdraft、承認待ちFIX、一般memberの権限は持たない。アップロードはFIX結果だけを受け付ける。
  - 通知基盤、メール、Web Push、アプリ内通知、予約通知は廃止する。操作結果を示すtoastはUI部品として残す。
  - PWA、Service Worker、offline cache、画像アップロード、Q&A、chatは廃止する。

- Next.jsを廃止し、TanStack Start、React、Vite Plusへ移行する。
- 両アプリともSPAを基本とし、固定した公開routeだけをbuild時にSSG/prerenderする。
- runtime SSR、TanStack Start server functions、Next.js Server Actionsを使わない。
- APIは同一originのHono Workerへ`/api/*`として実装する。
- build成果物はCloudflare Workers Static Assetsで配信する。
- TanStack StartのSPA shellは`/index.html`へ出力する。`/`はbuild時に生成した静的shellからhydrateしてtop routeをclient描画するSPAであり、top route本体のSSGとは扱わない。
- build-time SSGは`/terms`、`/privacy`、`/help`、`/docs`だけに限定し、それぞれ`/terms.html`、`/privacy.html`、`/help.html`、`/docs.html`へ明示出力する。自動static route discoveryとlink crawlを無効にし、公開プロフィール、Auction、proof、認証後画面をprerenderしない。
- Workers Static Assetsはasset-first、`not_found_handling="none"`、`html_handling="auto-trailing-slash"`とする。`assets_navigation_has_no_effect` compatibility flagでasset missしたnavigationをWorkerへ到達させ、WorkerはGET/HEADのHTML navigationだけAsset Bindingのcanonical `/`からshellを取得して返す。存在しないAPI
- browserから別subdomainのAPIを直接呼ばない。各アプリの同一origin BFFを通す。
- server stateはTanStack Queryのmemory cacheを使う。IndexedDB永続cache、Service Worker cache、Next.js cacheを持ち込まない。
- 静的assetはcontent hash付き長期cache、HTMLと認証済みAPIは適切な`no-store`または短い明示cacheとする。
- バックエンドORMはDrizzleを使用する
- WCAG 2.1 AA、keyboard操作、screen reader対応

- 認証とサービス連携
  - PointsとMarketsは別ユーザー・別セッション・host-only Cookieを持つ独立アプリである。
  - Marketsは独立アカウントを作り、利用者が後からPointsを明示連携する。
  - 有効なPoints–Markets連携は、接続先ごとに1対1とする。Markets利用者は複数のPoints互換提供先へ個別に連携できる。
  - PointsのSocial Provider集合はGoogleとGitHubである。両方をログイン画面と既存ユーザーへの明示連携画面に同じように表示する。
  - Provider単位のlink-onlyを実現する独自sign-in拒否hookは実装しない。
  - 本人識別は`providerId + accountId`で行い、メール一致による暗黙linkを禁止する。
  - PointsのGitHubログインと、Accountsの外部アカウント所有権証明は、それぞれのサービスが管理する。
- 共有test環境は既存のCloudflare named environment `staging`を内部名として使い、`staging.points.freeism.app`と`staging.markets.freeism.app`で公開する。productionは`points.freeism.app`と`markets.freeism.app`を使う。
- apex `freeism.app`は`projects/main-web-app`の独立ポータルを配信し、`docs.freeism.app`、`points.freeism.app`、`markets.freeism.app`、`accounts.freeism.app`へ通常のHTTPSリンクで案内する。`www.freeism.app`はapexへ正規化する。
- ポータルとドキュメントのhosting／DNSはPoints／Markets v0.2 migrationのdeploy対象に含めず、それぞれの独立した公開境界として扱う。DNS／redirectの範囲では、Wranglerが`freeism.app`と`docs.freeism.app`のWorker custom domainおよびapex DNSを所有し、Terraformはproxied `www.freeism.app`と`https://freeism.app/`への301正規化だけを所有する。Access、WAF、rate limit、通知はTerraformが所有する。
- 廃止したapex／`www`からPointsへのredirectを再作成しない。`www`正規化ではsource pathとqueryを破棄する。
- Cloudflare Vite pluginを使うbuildでは`CLOUDFLARE_ENV=staging|production`でnamed environmentを選び、生成されたflattened Wrangler設定をdeployする。`wrangler deploy --env`だけでbuild済み成果物の環境を切り替えない。
- D1 migrationは前方互換の段階migrationにし、状態migrationを伴う自動rollbackを行わない。
- v0.2では定期R2 backupを作らず、D1 Time Travelと復旧runbookを用意する。
- Vercel、Supabase、Upstashは受入完了後にdomain、env、cron、projectを撤去する。

### branch pushのdeploy pipeline

`test/*`へのpushは共有test環境だけ、`main`へのpushはproduction環境だけを更新する。testからproductionへの自動昇格と手動production承認は置かない。

`test/*` pipeline:

1. validate、contract、unit/integration test
2. `CLOUDFLARE_ENV=staging`でPoints／Markets artifactを個別build・検証
3. Points staging D1 migration、Markets staging D1 migration
4. Points staging deploy、Markets staging deploy
5. Points staging smoke

`main` pipeline:

1. production release gate、validate、contract、unit/integration test
2. `CLOUDFLARE_ENV=production`でPoints／Markets artifactを個別build・検証
3. Points production D1 migration、Markets production D1 migration
4. Points production deploy、Markets production deploy
5. Points production smoke

両pipelineは別の固定concurrency groupで直列queueにし、`queue: max`かつ`cancel-in-progress: false`として実行中migrationをcancelしない。test artifact／credentialをproductionへ流用しない。Pointsだけproductionへ進んだ場合でも、旧Markets productionと互換なAPI contractを保つ順序でdeployする。

## 9. セキュリティ、品質、release gate

- Cloudflare edge、Hono authn/authz、D1/DO invariantの多層防御を使う。
- browser mutationは同一origin、JSON、CSRF/Origin/Fetch Metadata検証、最大64KiBを基本とする。CSVだけは別途5MiB上限を適用する。
- Points Resource APIは標準JWKSでJWT署名を検証し、issuer、Points API audience、期限、Client ID、scope、Client有効状態を照合する。利用者Tokenの`sub`はPoints auth user IDとする。落札精算に、利用者のいないサービス権限トークンは使わない。- 重要mutationは`Idempotency-Key`を必須にする。
- ledger、FIX、Pointsログイン用の永久OAuth主体対応、監査eventをcascade deleteしない。退会時はprofileをclosed/anonymizedにする。
- 依存versionを完全固定し、lockfileをcommitする。`minimumReleaseAge`は4,320分、`blockExoticSubdeps`を有効にし、install scriptはallowlist化する。
- 2026-05のTanStack npm supply-chain incidentで影響を受けたversionをblockし、導入前に公式advisoryとlockfileを再確認する。
- GitHub Actionsはfull commit SHA、最小permissions、PR由来cacheをdeployに使わない構成にする。
- `main`はdirect push、force push、deleteを禁止し、required checks、up-to-date、merge queueを必須にする。現在1名運用中はapproval 0、2人目のmaintainer追加時に1へ変更する。
- 全体coverage率だけのrelease gateは設けず、金額、FIX、Accounts照合、OAuth、Auction ordering、DO resync、settlement saga、migrationのinvariant testを必須にする。
- 4固定公開ページは日本語・英語のcontent hash一致、keyboard／screen reader操作、JavaScript無効時の両言語可読性、hydration不一致0を必須testとする。英語参照訳のbilingual review記録がないreleaseをproductionへ進めない。

## 採用しないもの

- Next.js、Auth.js/NextAuth、Prisma、Supabase、Vercel、Upstash Redis、SSE
- email/password、Apple、ORCIDのv0.2認証Provider
- provider別link-onlyを作る独自Better Auth sign-in拒否hook
- email一致によるaccount merge、暗黙link、手動審査
- PostgreSQL型、RLS、PGroonga、`REAL`による金額計算
- `api.points.*`の別公開domain

1. ブラウザから同一originのAPIを利用できる  
   `points.freeism.app/api/*`、`markets.freeism.app/api/*`という構成にでき、UIから別サブドメインへ通信する必要がありません。

2. CORSとCookie共有を前提にしなくてよい  
   `points.freeism.app`から`api.points.freeism.app`を呼ぶ構成では、CORS、Origin許可、credential付きrequestなどの管理が増えます。1 Workerならhost-only session Cookieのまま同一origin BFFを利用できます。現在の仕様にも「browserから別subdomainのAPIを直接呼ばない」と明記されています。

3. PointsとMarketsの独立的に運用する
   - 別アプリとして同じようなアプリとの連携をする前提で設計したいため
   - 疎結合にする対象は「UIとAPI」ではなく「PointsとMarkets」です。アプリ間はOAuth・OpenAPI契約・登録済みoriginへの外部HTTPS通信で連携し、各アプリ内部はFull-stack Workerとして簡潔に保つ、という整理です。
