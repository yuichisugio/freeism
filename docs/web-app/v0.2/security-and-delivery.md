# セキュリティ・テスト・デリバリー仕様

## 1. 防御層

1. Cloudflare edge: DDoS、WAF、rate limit、Access、TLS、Turnstile
2. Worker/Hono: session/OAuth検証、authorization、Origin/CSRF、input limit、idempotency
3. D1/DO/Workflow: unique/check constraint、CAS、append-only history、単調状態遷移
4. CI/supply chain: exact pin、lockfile、advisory、ruleset、署名済みartifact

いずれか1層だけを信用しない。Service Bindingも認証を省略する根拠にしない。

## 2. browser sessionとCookie

- PointsとMarketsは別Better Auth secret、別D1、別host-only Cookieを持つ。
- `Secure=true`、`HttpOnly=true`、`SameSite=Lax`、`Path=/`。
- `Domain=.freeism.app`を設定せず、cross-subdomain Cookieを無効にする。
- PointsとMarketsで異なるcookie prefixを使う。
- session/account/tokenをlocalStorageへ保存しない。
- `disableCSRFCheck=false`、`disableOriginCheck=false`。
- `trustedOrigins`は環境ごとの当該アプリ完全一致originだけとする。
- OAuth stateはDB-backed、Authorization CodeはPKCE S256、callback URLは完全一致allowlistとする。
- Points OAuthは環境別pairwise secretと`subject_type=pairwise`を標準pluginで使い、public subjectを発行しない。
- Points OAuth Providerは`disableJwtPlugin: true`でAccess Tokenをopaqueにし、標準confidential remote introspectionの`active`、issuer、audience/resource、client、scope、期限と、利用者Tokenだけのpairwise subjectを検証する。利用者用、M2M用、Settlement retry用Client IDを分け、credentialは利用するWorkerの環境別Secretだけに置いてbrowserへ出さない。JWT Access Tokenの内部Points user IDをMarketsへ公開しない。
- Client Credentialsもopaqueだが、別Clientの利用者scopeとM2M scopeを互いに素にする。利用者用Client＋pairwise `sub`あり＋利用者scopeだけを利用者principal、M2M用Client＋利用者`sub`なし＋M2M scopeだけをM2M principalへ分類し、独自token-class claim、Service Binding、Tokenの外形、emailを認可根拠にしない。
- private/認証responseは`Cache-Control: private, no-store`。

Better Authの詳細は[認証仕様](./authentication.md)を正本とする。

## 3. 重要操作のGoogle fresh session

重要操作は、Better Auth sessionのfreshnessと、Google ID tokenの`auth_time`が現在時刻から900秒以内であることの両方を要求する。

- DB sessionを再取得し、Cookie cacheだけを信用しない。
- stale時は専用Google Authorization Code flowを開始し、`claims={"id_token":{"auth_time":{"essential":true}}}`、nonce、PKCEを要求する。公式referenceにない`prompt=login`／`max_age`をfreshness保証に使わない。
- 再認証したGoogle `sub`が現在ユーザーへlink済みの`(google, accountId)`と一致することを検証する。
- email一致で通さない。
- 成功後はsessionをrotateする。

対象operation、route、条件の完全な一覧は[認証仕様6.2](./authentication.md#62-対象操作)のpolicy registryを唯一の正本とする。本書では一覧を複製しない。少なくともSocial link、OAuth／Web ownership、未受領claim、Points–Markets link／unlink／relink、全CSV commit、ADMIN変更、account close／reopen、公開範囲拡大、ADMIN CSV export、OAuth鍵、Settlement retry／reconciliationを含み、個別routeのif文で対象を増減しない。

GitHubだけで作成したPointsユーザーは、Googleを明示linkするOAuth成功を最初のfresh proofとして使える。

Settlement手動retryはMarkets内に別ADMIN roleを作らない。MarketsからPointsの専用Authorization Code + PKCE step-upを開始し、Pointsが同格ADMINとGoogle freshを検証した60秒・一回限りの対象束縛assertionを発行する。GET callbackは検証済みpending authorizationを保存するだけでWorkflowを開始せず、同じSessionからのCSRF保護POSTが`jti`、rate limit、saga CAS、deterministic retry outboxをMarkets D1で原子的に確定する。commit後dispatcherだけがWorkflowを冪等起動する。通常のuser／Refresh／M2M Tokenへ管理scopeを混ぜない。

## 4. ADMIN

- グローバルな同格`ADMIN`だけを持つ。
- owner、super admin、評価軸別admin、impersonation、`setBalance`を作らない。
- ADMINは最大50人、最後のADMINを削除できない。
- bootstrapはADMIN 0人かつSecrets指定Google `accountId`一致時に一度だけ行う。
- 公開bootstrap routeを置かない。
- ADMIN mutationはfresh session、理由、before/after、request ID、env、結果をappend-only auditへ残す。

## 5. same-origin API

- browserは各アプリの同一origin`/api/*`だけを呼ぶ。
- CORSは認証の代わりにしない。原則cross-origin browser APIを公開しない。
- mutationは`application/json`を要求し、一般bodyは最大64KiB。CSV endpointだけ5MiB、Points–MarketsのM2M Point Package Auction eligibility／reservation status／一括capture／release requestだけ1MiBとする。Auction eligibilityの1MiB上限はDEC-256で確定している。
- Origin、`Sec-Fetch-Site`等のFetch Metadata、session、authorizationを検査する。
- important mutationは`Idempotency-Key`必須。
- 同じkey・同じpayloadは同じ結果、異なるpayloadは409。
- successは`{data, meta?}`、errorはRFC 9457 Problem Detailsに統一する。
- errorへstack、SQL、token、secret、内部binding名を出さない。

### 5.1 HTTP security header

Static Assetsの5 HTML、SPA shell、navigation fallbackと、Honoが返すHTML／JSON／Problem Detailsへ同じbaselineを適用する。OAuth authorization、callback、token exchange、consent、fresh認証、ownership、link／unlink、Settlement retryのresponseは成功・失敗とも`Cache-Control: no-store`と`Pragma: no-cache`を付ける。認証済みAPIは`Cache-Control: private, no-store`とする。

deployed HTMLのCSP baselineは次のdirectiveを正本とし、`{appHost}`をbuild対象のPointsまたはMarkets staging／production hostへ置換する。

```text
default-src 'none';
script-src 'self' {artifactInlineScriptHashes};
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' wss://{appHost};
form-action 'self';
base-uri 'none';
object-src 'none';
frame-src 'none';
frame-ancestors 'none';
manifest-src 'self';
worker-src 'none';
upgrade-insecure-requests
```

- executable inline scriptが0件なら`{artifactInlineScriptHashes}`は空にする。TanStackのbuild成果物に不可避なinline scriptがある場合だけ、その成果物から計算した`sha256-...`を列挙する。`script-src 'unsafe-inline'`、`'unsafe-eval'`、wildcard originを許可しない。
- `style-src 'unsafe-inline'`はstyle属性だけに限定して受容し、外部style originを追加しない。将来nonce/hashへ狭める変更は別reviewとする。
- development server用originやWebSocketをproduction artifactへ混ぜない。各environmentのCSPはflatten済みartifactから生成する。
- GitHub avatar等の外部画像をv0.2でproxy／表示しない。外部origin追加が必要になった場合は用途別directive、情報漏洩、cacheを再reviewする。

共通headerは次のとおりとする。

| Header                      | staging                                                        | production                            |
| --------------------------- | -------------------------------------------------------------- | ------------------------------------- |
| `Content-Security-Policy`   | 上記のstaging host版                                           | 上記のproduction host版               |
| `X-Content-Type-Options`    | `nosniff`                                                      | `nosniff`                             |
| `Referrer-Policy`           | `no-referrer`                                                  | `no-referrer`                         |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | 同左                                  |
| `X-Frame-Options`           | `DENY`                                                         | `DENY`                                |
| `Strict-Transport-Security` | `max-age=86400`                                                | `max-age=31536000; includeSubDomains` |

localhost／test runtimeではHSTSと`upgrade-insecure-requests`を付けない。`_headers`が適用される静的responseとHono middleware responseを別々にcontract testし、Asset Bindingから返すshellでもheaderが失われないことを確認する。release testはCSPから意図しない外部origin、`unsafe-eval`、scriptの`unsafe-inline`を検出したら失敗する。

## 6. SSRFと外部URL

URL所有権検証は[未受領FIXと外部identity所有権](../../../projects/points-web-app/docs/v0.2/details-ja/unclaimed-fix-and-ownership.md)のruleを適用する。

- HTTPS/443、userinfoなし、public hostだけ
- redirect最大3、全体5秒、response最大1MiB
- HTML/textだけ、JavaScript実行・subresource取得なし
- IP literal、localhost、private／reserved hostnameをfetch前に拒否し、manual redirectの各hopを再検証
- `global_fetch_strictly_public`を有効にし、Cloudflareのpublic Internet egress制約を使う。Workersが公開しない実接続先IPをアプリで検査・pinningできるとは扱わない
- Cookie、Authorization、内部headerを転送しない
- 外部URLの本文をlog/監査へ保存しない

## 7. Durable Object/WebSocket

- WebSocketは購読専用。bid mutationは認証済みHTTP。
- upgradeでhost-only session、Origin、接続上限を検査し、query tokenを禁止する。
- 1 frame最大4KiB、同一user/Auction最大3接続、全体最大20接続。
- attachmentはIDとlast sequenceだけ。secret、AutoBid上限、sessionを保存しない。
- heartbeat timerを使わない。
- D1 CAS commit後だけbroadcastし、version/seq gapはHTTP snapshotでresyncする。
- seller自己入札、終了後bid、Auction economic field変更をserver/DO/D1で拒否する。

## 8. 初期rate limit

以下はv0.2の初期値であり、429率・誤検知・abuse metricを監視して変更する。変更もIaC/repositoryでreviewする。

| 操作                  | key                                   | limit                                      |
| --------------------- | ------------------------------------- | ------------------------------------------ |
| Better Auth OAuth     | IP、provider、session                 | Better Auth D1 limit + WAF managed rule    |
| bid                   | user + Auction                        | 10秒5回                                    |
| bid全体               | user                                  | 1分30回                                    |
| WebSocket upgrade     | user                                  | 1分10回                                    |
| WebSocket upgrade     | IP                                    | 1分30回                                    |
| WebSocket接続         | user + Auction                        | 同時3                                      |
| WebSocket接続         | user                                  | 同時20                                     |
| URL検証               | user + normalized URL                 | 1時間5回                                   |
| URL検証               | user                                  | 1日30回                                    |
| CSV validation/commit | ADMIN + 評価軸                        | 1分2回、1時間10回                          |
| Auction CSV           | Markets user + operation              | 1分2回、1時間10回                          |
| settlement手動retry   | Points ADMIN + Markets user + Auction | 1時間5回、single-flight、assertion 1回消費 |

idempotent retryは保存済み結果を先に返し、同じ副作用へrate limitを重ねない。

## 9. Turnstile

- 通常のlogin、bid、URL検証へ常時challengeを出さない。
- abuse threshold接近、異常IP/ASN、連続失敗等のrisk signal時だけadaptiveに要求する。
- tokenはWorkerからSiteverifyへ送ってserver-sideで検証し、hostname、action、期限、再利用を確認する。
- Turnstile失敗をauthorization成功へfallbackしない。

PointsとMarketsはenvironment別のSite Key／Secretとtoken replay tableをそれぞれ持ち、browserが別subdomainのSite Keyを流用しない。app-integrated challengeの対象operationと固定`action`は次のとおりである。

| App     | operation                             | Turnstile `action`         |
| ------- | ------------------------------------- | -------------------------- |
| Points  | Google／GitHub OAuth開始              | `points_oauth_start`       |
| Points  | GitHub／Web URL所有権検証             | `points_ownership_verify`  |
| Points  | CSV validate／commit                  | `points_csv`               |
| Points  | 未受領FIX claim confirm               | `points_claim`             |
| Markets | Google OAuth／Points link・unlink開始 | `markets_oauth_start`      |
| Markets | Auction CSV validate／commit          | `markets_csv`              |
| Markets | bid／buy-now                          | `markets_bid`              |
| Markets | WebSocket upgrade                     | `markets_ws_upgrade`       |
| Markets | Settlement手動retry confirm           | `markets_settlement_retry` |

通常requestではTurnstile tokenを要求しない。risk判定時は`428 TURNSTILE_REQUIRED`とSite Key／固定actionだけを返し、clientが取得したtokenを同じoperationへ1回だけ再送する。Siteverify成功は認証、認可、freshness、rate limit、idempotencyを代替しない。Cloudflare WAF Managed Challengeはedgeの別防御であり、appのtoken／action／replay検証を満たしたことにはしない。

## 10. CSV

- UTF-8、最大5MiB、最大1,000非空行、strict header/cell schema。
- client previewを信用せずserverで再parseする。
- server draftなし、確認後1回の原子commit。
- 小数4桁、scale 10,000、minimumUnit倍数、安全整数、指数表記/Unicodeマイナス拒否。
- 1件errorで全体0件反映。
- exportはformula injectionを無害化する。
- file本文、自由入力cell、個人情報を通常logへ出さない。

### D1 bulk write制約

CSV 1,000行とSettlementの複数winner書込みは、値を並べた巨大multi-value SQLや1行1queryで実装しない。現行D1の1 query 100 bound parameters、SQL 100KB、string／BLOB 2MB、Paid 1 invocation 1,000 queries、batch全体30秒の上限をすべて満たす。

- validation済みrowをcanonical JSON arrayへ変換し、UTF-8で1 chunk 1,500,000 bytes以下に分割する。1 rowがchunk上限を超える入力は事前に拒否する。
- 各statementはJSON chunk 1個だけをbound parameterとし、固定SQLの`json_each(?)`／`json_extract`からset-based INSERT／UPDATEする。SQL文字列を入力件数に応じて伸ばさない。
- chunkごとの各target table statement、command guard、ledger、idempotency result、auditを一つのD1 `batch()`へ入れ、projectionはledger triggerだけで更新する。1 statement／triggerでも失敗すれば全rollbackし、複数の独立`batch()`へ分割しない。
- 1 commitのstatement数を100以下に制限し、query上限1,000に余裕を持たせる。100を超えるschema設計なら行数を黙って削らず、実装を停止して計画を見直す。
- integration testは1,000行、5MiB境界、100 parameter境界、2MB chunk境界、statement数、30秒timeout、途中statement失敗時0件を実D1 runtimeで確認する。

## 11. D1不変条件

- ledger、FIX revision、claim、permanent OAuth主体、audit eventをappend-onlyにする。
- `sourceFixRevisionId`、idempotency key、Auction command/seq、settlement plan hashを一意にする。
- amountは`INTEGER`、`REAL`禁止、safe integer、minimumUnit倍数を境界とDB constraintで検証する。
- `balance = ledgerの符号付き合計`。
- `evaluationTotal = FIX起因ledgerの符号付き合計`。
- `point_ledger_entries`のINSERTだけを経済projectionの入力とし、`point_accounts.balance`／`evaluation_total`は同じtransaction内のD1 `AFTER INSERT` triggerだけが更新する。アプリケーションからprojectionを直接INSERT／UPDATEしない。
- 消費、譲渡、交換、reserve、capture、release、expiry、通常unlinkは、同じD1 `batch()`を`command PENDING INSERT -> canonical chunks INSERT -> PENDINGからVALIDATEDへのUPDATE -> domain／event／ledger write -> VALIDATEDからCOMMITTEDへのUPDATE -> idempotency result／成功audit`の順に固定する。2つのcommand transitionの`BEFORE UPDATE` triggerがprecondition、expected target count、actual event／ledger countを検査し、違反時は安定したcodeで`RAISE(ABORT, ...)`して全rollbackする。条件付きUPDATEの0行を成功として扱わない。
- ledger INSERT前triggerは現在の`point_accounts`と当該deltaを整数として検査し、`balance`または`evaluation_total`の累積結果が±`9_007_199_254_740_991`を超える場合は`RAISE(ABORT, 'SAFE_INTEGER_OVERFLOW')`とする。SQLiteのINTEGER演算がREALへ昇格した値を保存しない。
- reserveは`balance - ACTIVE reservation >= requested`を検査し、captureも全winnerの現在残高が各予約済みdebitを満たすことを同じguardで再検査する。予約後の負FIX等で1件でも不足した場合は全captureを0件へrollbackし、Marketsへ同じcutoffから不足者を除外したround再計算を要求する。残高不足時にcaptureを強行して負残高を作らない。
- 成功auditは経済batch内へ入れる。guard／認可拒否時はbatchが全rollbackした後、許可したstable codeとrequest metadataだけを別のappend-only rejection auditへ記録する。rejection audit失敗時も経済commandを再実行せず、metric／alertを残して元の失敗responseを返す。
- reservation vectorは全componentを1回に確定する。
- captureは全winner・全componentを1回に確定する。
- account closeはprofileを匿名化し、経済履歴をcascade deleteしない。

## 12. 監査

append-only audit eventへ次を記録する。

- actor type/ID、session IDまたはOAuth client ID
- operation、target type/ID
- before/afterの安全な差分
- reason、environment、request/correlation ID
- idempotency key、result、occurredAt

記録しないもの:

- password、OAuth code/token、client secret、Cookie、暗号鍵
- CSV本文、外部HTML本文、Authorization header
- AutoBid上限、private profile本文、不要な個人情報

ADMINによる不正FIX、複数アカウントの談合、seller/buyerの虚偽評価はv0.2で自動検知しない残余riskである。不変履歴と監査で追跡可能にする。

### 12.1 Observabilityと運用alert

正確性の根拠はD1／DOの不変条件とし、logやAnalytics Engine metricをtransaction成功の根拠にしない。両Workerはenvironment別に次を持つ。

- Workers Observabilityを有効化する。stagingはlogs／tracesともhead sampling `1`、productionはlogs `1`、traces `0.05`を初期値とする。productionはWorkers PaidのWorkers Logs 7日保持、stagingもPaid環境として7日保持をrelease条件にする。
- structured logは`level`、`event`、`app`、`environment`、`requestId`／`correlationId`、`operation`、`outcome`、stable `code`、`durationMs`、attempt、resource typeとsalted ID hashだけを記録する。OAuth token、Cookie、Secret、email、外部URL／HTML、CSV cell、AutoBid上限、profile本文を記録しない。
- `OPS_METRICS` Analytics Engine bindingをapp／environment別datasetへ接続する。data pointはevent type、app、environment、outcome／code、resource stateをblob、count／duration／lag seconds／attemptをdouble、非個人のresource ID hashをindexに使う。書込みは非同期であり失敗してもdomain transactionを再実行しない。保持は現行上限の3か月とし、SQL API/Grafana queryの正本をrunbookへ保存する。
- app D1に`ops_alerts`を持ち、`alertKey`、type、resource ID hash、`OPEN|RESOLVED`、first／last observed、last notified、repeat count、safe detail codeを保存する。`OPEN`は期間で削除せず、`RESOLVED`だけを`resolvedAt`から180日保持する。5分monitor内の1日1回leaseで期限到来行を削除し、cutoff、削除件数、実行結果をappend-only auditへ残す。179日23:59:59は保持し、180日ちょうどを削除対象とする。
- 各Workerの5分Cron monitorがD1の正本状態を照会し、同じ`alertKey`へ冪等upsertする。`OPEN`遷移時、継続1時間ごと、`RESOLVED`遷移時だけ固定destinationの`OPS_ALERT_EMAIL` Email Routing bindingへ通知する。宛先はverified destinationとしてWrangler/IaCで固定し、request入力から選ばない。送信失敗はalert rowを未通知のまま保持し次回再送する。
- Cloudflare native Notificationは、公式alert typeで確認できるincident／5xx率／usage threshold用とする。Worker runtime exception専用typeは捏造せずWorkers Logs／Tracesと相関し、app固有D1状態のalertはCron monitorが判定する。

初期alert条件は次を正本とする。durationはD1/server時刻で判定し、単発metric欠落だけでalertを閉じない。

| App     | Alert                            | OPEN条件                                                          | RESOLVED条件                                  |
| ------- | -------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| Points  | ownership scheduler lag          | dueから15分超未lease／未完了                                      | 次の成功または明示terminal化                  |
| Points  | command／revocation outbox stuck | `PENDING`／`VALIDATED`／未送信が5分超                             | terminal／送信receipt確定                     |
| Points  | reconciliation mismatch          | ledger、projection、reservation、claim集合が1件でも不一致         | full reconciliation一致                       |
| Points  | rejection audit failure          | rejection auditまたはalert書込みが1件失敗                         | 次のhealth probe成功。失敗event自体は消さない |
| Markets | Auction transition delay         | `startsAt`／`endAt`から2分超、期待stateへ未遷移                   | 対応stateのCAS確定                            |
| Markets | WebSocket lease／gap anomaly     | expiryから2分超のlease、または5分窓のgap resync率5%超かつ20件以上 | stale lease 0、直近5分がthreshold未満         |
| Markets | Workflow／outbox／saga stuck     | 進捗なし5分超、または仕様のretry上限到達                          | terminalまたは明示manual action state         |
| Markets | reconciliation mismatch          | plan、reservation、capture、proofが1件でも不一致                  | full reconciliation一致                       |
| 共通    | alert delivery failure           | Email binding送信失敗                                             | 保留通知の送信receipt確定                     |

staging acceptanceでは各alertをfixtureで1件ずつOPEN→dedupe→RESOLVEDへ進め、Emailは専用verified test destination、Analytics EngineはSQL API、Workers Logsはrequest／correlation IDで確認する。productionの個人宛先や実Auctionへtest alertを送らない。

## 13. 依存関係とsupply chain

### 13.1 version

2026-07-11調査baseline:

- Node `26.x`（minimum `>=24.11.0`）
- pnpm `10.33.3`
- Vite Plus `0.2.4`
- TanStack Start `1.168.27`
- Hono `4.12.28`
- Drizzle ORM `0.45.2`
- Drizzle Kit `0.31.10`
- Wrangler `4.108.0`
- `@cloudflare/vite-plugin` `1.43.2`
- `@cloudflare/vitest-pool-workers` `0.18.2`
- Better Auth一式 `1.7.0-rc.1`は開発/stagingだけ

直接dependencyは`^`、`~`、`latest`を使わず完全固定する。lockfileをcommitし、同じpackage群のBetter Auth versionを混在させない。

### 13.2 pnpm policy

- `minimumReleaseAge: 4320`分
- `blockExoticSubdeps: true`
- `onlyBuiltDependencies`を最小allowlist化
- unexpected lifecycle scriptを拒否
- high/critical advisoryはrelease blocker。例外はowner、理由、有効期限、補償controlを文書化する

### 13.3 TanStack incident

2026-05に公表されたTanStack npm supply-chain incidentのaffected versionを明示blockする。新規lockfile生成時に公式postmortem/advisory、package provenance、publish日時を再確認する。affected範囲を「現在latestだから安全」と推測しない。

## 14. GitHub Actions

- `pull_request`と`merge_group`で同じrequired CIを実行する。
- `pull_request_target`を使わない。
- Actionsはfull commit SHAへ固定し、permissionsはjob最小にする。
- fork/PR由来cache、artifact、environment値をproduction deployへ流用しない。
- production secretsはmain push workflowのproduction jobだけが参照する。
- `test/*`はGitHub Environment `web-app-staging`、`main`は`web-app-production`を参照し、Cloudflare tokenとaccount IDを分離する。
- prerender buildは追跡済み`.dev.vars.example`のdummy値だけをbuild step内へ読み込み、実Worker Secretをartifactへ渡さない。deployは別stepで実行し、dummy環境変数を引き継がない。
- OIDCまたは最小scopeのCloudflare API tokenを使い、長期global API keyを使わない。

## 15. main ruleset

2026-07-11のGitHub API調査時点では、`main`のbranch protection ruleとrepository rulesetはいずれも0件だった。本番自動deployを有効にする前に次を必須化する。

- direct push、force push、branch delete禁止
- PR必須
- required checksとbranch up-to-date
- merge queue
- admin bypassなし
- 1人運用中のrequired approvalは0。2人目のmaintainer追加時に1へ変更

## 16. CI/CD pipeline

### PR/merge queue

1. exact install/lockfile検証
2. format、lint、typecheck
3. unit/property test
4. Workers Vitest D1/DO/Workflow integration
5. OpenAPI contract/client generation差分
6. build、Static Assets routing検証
7. dependency/advisory/license policy

### `test/*` push

1. validate
2. staging artifact build (`CLOUDFLARE_ENV=staging`)
3. Points staging migration/deploy
4. Markets staging migration/deploy
5. staging smoke

### `main` push

1. production release gateとvalidate
2. production artifact build (`CLOUDFLARE_ENV=production`)
3. Points production migration/deploy
4. Markets production migration/deploy
5. production smoke

- production手動approvalを置かない。
- testとproductionは独立workflowとし、test workflowからproductionへ昇格しない。
- 両workflowは固定concurrency group、`queue: max`、`cancel-in-progress=false`で直列化し、実行中migrationをcancelしない。
- branch pushはpath filterで省略せず、`test/*`と`main`の各pushを対応環境へ反映する。
- public per-PR previewは作らない。

## 17. 環境とIaC所有権

- `local`、`staging`、`production`でWorker、D1、DO namespace、Workflow、OAuth app/client、Secretsを分離する。`staging`は共有test環境のCloudflare内部名である。
- Wrangler/Vite plugin: Worker binding、named environment、Static Assets、custom domain route、migration tag。
- Terraform: Points／Marketsのzone DNS、WAF、rate limit、Access等のedge設定。apex portalとDocsのhosting／DNSは各サイトのdelivery境界で管理する。
- 同じresourceをTerraformとWranglerで二重管理しない。
- Cloudflare Vite pluginはbuild時に`CLOUDFLARE_ENV`を選び、flatten済み設定をdeployする。
- Terraform stateは専用Cloudflare R2 bucketのS3 backendへ保存し、`use_lockfile=true`でlockingする。bucketは本体IaCとは別のbootstrapで作り、bucket-scoped Object Read & Write credentialをGitHub Environment Secretに保存する。HCL、repository、artifactへcredentialやstateを入れない。
- IaC applyを有効にする前に、stagingで2つの同時実行を起こし、片方がstate lock取得失敗になることを実証する。R2 state bucketはアプリD1の定期backupではない。

## 18. D1 migrationとrecovery

- schema変更はforward-onlyの小さい段階migrationにする。
- code deploy前後で必要な期間、旧新Workerが同じschemaを扱える順序にする。
- 状態を持つmigration後の自動down migrationを作らない。
- Workers PaidのproductionはD1 Time Travel 30日をrelease条件とし、production migration直前にbookmarkとrequest IDを保存する。
- code/assetsだけの問題は直前Worker versionへrollbackできる。
- 非互換schema/経済状態の問題はtrafficを止め、runbookに従いTime Travel restoreと対応Workerをdeployする。
- v0.2ではscheduled R2 backupを作らない。

## 19. test matrix

### unit/property

- fixed decimal、minimumUnit、safe integer
- FIX delta、balance/evaluationTotal式
- URL normalization/ownership epoch
- Auction ranking、tie、partial allocation、clearing
- state machine、idempotency key、plan hash

### Workers integration

- 実D1 migration/constraint/transaction
- Better Auth schema/session/OAuth
- Service Binding + bearer validation
- DO hibernation/eviction/CAS/WebSocket
- Workflow retry、outbox、reconciler

### browser/E2E

- Google/GitHub Points login/linkとGoogle fresh
- Markets Google login、Points明示link
- FIX CSVから未受領claim
- Auction/bid/AutoBid/WS resync
- settlement/proof/review
- public/private profile

### staging/smoke

- custom domain/TLS/Static Assets/API routing
- D1 migration version
- OAuth redirect/issuer/audience/env分離
- reconciliation一致
- Vercel/Supabase/Upstash runtime call 0

全体coverage percentageだけのgateを設けず、上記invariant testの存在と成功を必須にする。Workers Vitest integrationは`>=4.1`互換をrelease条件にする。

## 20. production release gate

- GitHub ruleset/merge queue有効
- Cloudflare API認証エラー解消
- Workers Paid plan有効
- Better Auth 1.7正式版へ完全固定し、認証回帰test成功
- affected TanStack versionなし、high/critical advisoryなし
- Google/GitHub OAuth app、Points OAuth client、redirect URI、Secretsが環境別
- staging E2E全成功
- 空D1への全migration成功
- DO hibernation/eviction、Workflow retry、settlement reconciliation成功
- Time Travel restore runbook実証
- production smoke定義済み
- Vercel/Supabase/Upstashへのruntime参照0
- `main` push以外からproduction deploy不能

## 21. 受入後の撤去

production smokeとruntime参照0を確認した後だけ実施する。

- Vercel project/deployment/domain/env/cron
- Supabase test/production project、PostgreSQL、Auth、migration、Secret
- Upstash Redis、SSE key、旧scheduled action
- 旧Cloudflare R2画像bucket/credential
- 旧Vercel/Supabase/Upstash GitHub Secrets

撤去は実装deployと同じtransactionでは行わず、inventory、承認済み対象、削除証跡を残す別checkpointとする。

## 参照

- [Better Auth Security](https://better-auth.com/docs/reference/security)
- [Better Auth User & Accounts](https://better-auth.com/docs/concepts/users-accounts)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Workers compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/)
- [Cloudflare Workers Static Assets HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)
- [Cloudflare Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Cloudflare Workers Vitest Integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [Cloudflare D1 Database `batch()`](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Cloudflare Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Cloudflare Analytics Engine limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/)
- [Cloudflare Email bindings](https://developers.cloudflare.com/workers/wrangler/configuration/#email-bindings)
- [GitHub protected branches](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
