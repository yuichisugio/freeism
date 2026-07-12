# リアルタイム配信とSettlement

## 1. Source of Truth

- Markets D1がAuction、bid event、allocation、settlementの永続Source of Truthである。
- 1 Auctionにつき1つの`AuctionRoom` Durable Objectを使用する。
- DO memoryとWebSocket attachmentはcache/接続状態であり、eviction後にD1から再構築できなければならない。
- 状態mutationはDOで直列化し、D1 CAS commit成功後だけbroadcastする。
- Auctionの状態、current revision、次回transition時刻はMarkets D1を正本とする。Durable Object SQLiteに保存するalarm metadataは再起動時の復旧用cacheであり、D1と不一致ならD1を優先する。

## 2. HTTP mutation

```text
Browser
  -> same-origin Hono session/CSRF/validation
  -> AuctionRoom command
  -> D1 transaction/CAS
  -> commit result
  -> WebSocket broadcast
```

- Auction開始前編集・取消、bid、AutoBid、即決、watchlist、reviewは認証済みHTTPで行う。
- WebSocketはsubscription専用で、clientからdomain commandを受け付けない。
- `(auctionId, commandId)`と`(auctionId, bidSeq)`をD1 uniqueにする。
- expected`auctionVersion`が異なるcommandは409にする。

## 3. Hibernation WebSocket

### upgrade

- `GET /api/auctions/{auctionId}/events`を同一origin session付きで呼ぶ。
- query stringへaccess token、session token、client secretを入れない。
- Origin、Fetch Metadata、Auction公開可否、利用者ID、接続上限を検査する。
- `acceptWebSocket`とHibernation APIを使用する。

### attachmentと上限

- attachmentは`connectionId`、`auctionId`、`marketsUserId`、最後に送信したversion/seqだけを持つ。
- secret、AutoBid上限、session、巨大snapshotを入れない。
- 1 frameは最大4KiB。
- 同一Markets user・Auctionは最大3接続、全Auction合計は最大20接続。上限判定をAuctionRoom内memoryだけで行わず、Markets D1の`websocketConnectionLeases`へuser全体slot 1〜20とuser＋Auction slot 1〜3を同じ原子commandで確保する。各slotは一意制約を持ち、異なるAuctionRoomへの同時接続でも上限を超えない。
- D1 lease確保後にWebSocket accept／attachment保存が失敗した場合はそのleaseを解放する。正常close/error時も解放し、切断通知を受けられなかったleaseは短い期限と再接続時の所有connection ID照合で回収する。hibernation中の有効socketを期限だけで奪わない。
- heartbeat用`setInterval`を使わない。transport切断は再接続で扱う。

### event

```json
{
  "type": "auction.updated",
  "auctionId": "auc_01...",
  "auctionVersion": 43,
  "bidSeq": 108,
  "occurredAt": "2026-07-11T12:00:00.000Z",
  "data": {}
}
```

- eventは公開可能な差分だけを持つ。
- clientは`auctionVersion`または`bidSeq`のgap、逆行、未知eventを検出したら接続を信用せず、HTTP snapshotを再取得する。
- reconnect時はlast versionを送れるが、DOが完全replayを保証しない場合はsnapshotへfallbackする。

## 4. start／close coordination

- Durable Object alarmは1 Auctionにつき1件だけ使う。`SCHEDULED`ではcurrent revisionの`startsAt`、`OPEN`ではcurrent revisionの`endAt`という次の1遷移だけを`setAlarm()`し、edit／延長時は新時刻へ置き換える。
- Auction commitは`DRAFT -> SCHEDULED`とalarm配送outboxを同じMarkets D1 transactionで確定する。commit後dispatcherが`AuctionRoom.ensureRevisionSchedule(auctionId, revision, startsAt)`を呼び、binding call前後のcrashはoutboxを同じIDで再送する。
- alarmとAuction snapshot／commandの初回accessは共通の`advanceDueTransitions(serverNow)`を呼ぶ。`SCHEDULED`かつ`serverNow >= startsAt`ならcurrent revisionを再取得し、`SCHEDULED -> OPEN`のD1 CASに成功した1処理だけがtransition eventを追加し、同revisionの`endAt`へ次のalarmを設定する。
- `OPEN`かつ`serverNow >= endAt`ならcurrent revision／endAtを再確認する。`OPEN -> CLOSING`のCASに成功した1処理だけがbid cutoff snapshotを固定する。未終端`BUY_NOW` holdが0件なら同じtransactionでimmutable `END_OF_AUCTION` planとoutboxも作り、1件以上なら全hold終端までplan作成を遅延する。`CLOSING`へ進んだ後はhold restoreで残数が戻っても再OPENしない。
- `OPEN`中の即時購入はAuctionRoomが通常bidと直列化し、残数量guard、要求全数量の`buyNowHold`、immutableな`BUY_NOW` settlement plan、settlement outbox、監査event、冪等responseを同じMarkets D1 transactionで確定する。hold数量は利用可能残数から除外し、commit後dispatcherがWorkflowを直ちに起動する。
- `BUY_NOW`の内部`restoreBuyNowHold` CASは、外部作用開始前のD1 preflight、同じidempotency keyの決定的reservation作成拒否でID 0件、または存在する全reservationの未capture status＋ACTIVE分release receipt完備、という相互排他的な3種のevidenceだけでhold全数量を`FAILED_RESTORED`へ進める。結果不明／retry中はholdを維持する。capture後は`CAPTURED_PENDING_FINALIZE`としてrestoreせず、proof確定後に別の内部`settleBuyNowHold` CASで`SETTLED`へ進める。
- 2つの内部CAS RPCはpublic HTTP／WebSocket commandではない。restoreは上記evidence、settleはcapture receipt＋proof ID／content hashを受け、同じoutcomeのretryは同じreceipt、反対outcomeはprotocol failureとする。restoreはproof schemaに依存しないTaskで先に実装し、settleはproof migration適用後に実装する。endAt前は全hold終端後に残数0ならAuction終了、残数ありなら`OPEN`維持とし、endAt後は最後のhold終端transactionで復元済み残数を使って終了時plan／outboxを一度だけ作るか、残数0なら終了する。
- alarmが遅延しても初回accessがdue transitionを進める。alarmと複数accessが同時でもCAS loserはcurrent snapshotを返す。Worker再deploy、DO eviction、alarm retry後もD1から再構築し、延長／編集済みの旧revisionはeconomic stateを変更せず最新revisionの次のalarmだけを再設定する。
- `CANCELLED`はalarmを削除してno-opとし、Settlement Workflowを作らない。取消commit後のalarm削除通知が失敗しても、次のalarm／accessがD1の終端状態を確認して収束する。
- planはcutoff、eligible bid IDs、ranking input hash、package revision、quantity、algorithm versionを持つ。

## 5. Settlement Workflow

### 状態

`PLANNED -> RESERVING -> RESERVED -> CAPTURING -> CAPTURED -> FINALIZING -> SETTLED`

failureはretryable、`SETTLEMENT_MANUAL_ACTION_REQUIRED`、またはBUY_NOW専用の`FAILED_RESTORED`へ単調に進め、capture済みを予約状態へ戻さない。

### step

1. `END_OF_AUCTION | BUY_NOW`を含むimmutable planとcurrent auction revisionを検証する。`BUY_NOW`ではhold ID、要求全数量、固定即決価格、残数量snapshotも照合する。
2. cutoff集合からprovisional allocationを決定する。
3. `END_OF_AUCTION`はwinner候補ごと、`BUY_NOW`はcommandを送った1 buyer／要求全数量だけについて、user delegation tokenで15分vector reservationを作る。
4. `END_OF_AUCTION`で残高不足・負残高という確定的失敗者が1人でもいれば、そのroundで成功したreservationも全件releaseする。`BUY_NOW`の確定的reservation作成拒否はID 0件のfailure hash、作成済みなら全IDの未capture status＋ACTIVE分release receiptをrestore evidenceとし、代替buyerを選ばず`restoreBuyNowHold`で全数量を一度だけ`FAILED_RESTORED`へ進める。
5. `END_OF_AUCTION`だけが確定的失敗者を除外し、同じcutoffからquantityを勝手に縮小せずallocation/clearingを最初から再計算し、新plan hashで全件再予約する。`BUY_NOW`をこの再計算へ入れない。
6. 全winner・全評価軸を1回のPoints capture APIで原子的に確定する。
7. `END_OF_AUCTION`のcaptureが`INSUFFICIENT_BALANCE`と`insufficientReservationIds`を返した場合は、Markets D1でそのroundのreservation IDからMarkets userを解決し、その利用者だけを除外する。旧roundのACTIVE reservationをすべてM2M releaseし、同じcutoffからallocation/clearingを再計算して新roundへ戻る。`BUY_NOW`で同じ応答を受けた場合はcapture 0件を確認済みとして対象buyerを除外集合／blacklistへ追加せず、ACTIVE reservationのrelease receipt確認後にhold全数量を`FAILED_RESTORED`へ進める。
8. Markets D1へallocation、商材snapshotと`SETTLED` completion statusを含むproof、settlement結果を確定する。`BUY_NOW`はproof確定後に内部CAS commandでholdを`SETTLED`へ進める。これは個別Settlementの`SETTLED`であり、Auction自体はendAt前なら未終端hold 0かつ残数0の場合だけ終了し、残数ありなら`OPEN`を維持する。endAt後は再OPENせず、最後のhold終端時に終了時planへ接続する。
9. 未使用のACTIVE reservationをM2M tokenでreleaseする。
10. outboxを完了にする。

各外部副作用は決定論的idempotency keyを持つ。Workflow retry、Worker再deploy、timeout後の再実行で二重予約・二重capture・二重proofを作らない。

### Paid plan上限と1,000 winner処理

- Settlement WorkflowはWorkers Paidを前提とし、Wranglerで`limits.steps=25000`、`limits.subrequests=10000000`、`limits.cpu_ms=300000`を明示する。deploy前testはflattened staging／production configの値を検証し、Free/default limitへ暗黙fallbackしない。
- winnerごとにWorkflow stepを作らず、1 reservation roundを1つの決定的stepにする。step名は`reserve-round-{roundOrdinal}`、`status-round-{roundOrdinal}`、`release-round-{roundOrdinal}`のようにappend-only ordinalを含め、同一instance内で別処理へ再利用しない。`reserve-round`のWorkflow step timeoutは5分、総attemptは3、1秒exponentialとするが、D1のround `retryDeadlineAt=firstAttemptAt+5分`をretry間で引き継ぐため総経過を5分より延長しない。
- 1 roundは最大1,000 winner。Points Service Bindingへの同時外向き接続は1 invocationあたり6件というWorkers制約に合わせて最大6件のpoolで処理し、response bodyを必ず読取またはcancelする。7件目以降を無制限`Promise.all`へ積まない。
- step resultへToken、response body、全vectorを保存せず、reservation ID、Markets user参照、status、request ID、hashだけを決定的sortで返し、1 MiBのstep result上限を超えない。詳細はMarkets D1を正本にする。
- Workflow開始前に、candidate数、round数、DEC-252の総attemptからsteps／subrequestの保守的上限を計算する。設定済み上限または5分deadline内に安全に完了できない入力はWorkflow外部副作用を開始しない。`END_OF_AUCTION`は`SETTLEMENT_MANUAL_ACTION_REQUIRED`、`BUY_NOW`は外部副作用0を確認して内部CAS commandでholdを全restoreし`FAILED_RESTORED`へ進める。
- 利用者予約は既存11-operation契約の`createPointReservation`を維持し、最大値対応だけを理由にbulk M2M reserve APIを追加しない。各callは決定的idempotency keyを持ち、step全体retryでも同じ結果へ収束する。

### Workflow instanceと手動retry

- 初回instance IDは`settlement:{settlementId}:revision:{settlementRevision}:attempt:0`とし、100文字上限をtestする。業務上の`settlementRevision`とimmutable plan hashはretryで変更しない。
- 手動retryを受理するたびにMarkets D1で`workflowAttempt`を単調増加し、同じtransactionで一意なretry outboxを作る。dispatcherは`attempt:{workflowAttempt}`を含む新しいinstance IDを起動し、既存完了／失敗instance IDのduplicate成功を「再試行済み」と誤認しない。
- 同じ手動retry command／`jti`／idempotency keyの再送は同じ`workflowAttempt`とoutbox receiptを返し、新しいinstanceを増やさない。

### 明示retry budget

> 本節のtimeout、attempt、delay、最大経過はDEC-252で確定している。

Cloudflare Workflowsの暗黙defaultへ依存せず、Workflow round／外部作用の`step.do` policyと、step内の個別HTTP call policyを分離して両方を明示する。`reserve-round` stepは5分timeout／総3attempt／1秒exponential、各winnerのreservation HTTP callは下表の8秒timeout／総3attemptを使う。step retryはwinnerごとのattempt／idempotency keyをD1から再開し、個別attempt数やround deadlineをresetしない。status／capture／release／finalizeもstep全体の最大経過をD1 `firstAttemptAt`／`retryDeadlineAt`で強制し、個別HTTP clientには下表のAbortSignalを設定する。

| 個別HTTP call                  | 1 attempt timeout | 総attempt | 初期delay／backoff |   step全体の最大経過 | 上限時reason                       |
| ------------------------------ | ----------------: | --------: | ------------------ | -------------------: | ---------------------------------- |
| winnerごとのreservation create |               8秒 |         3 | 1秒／exponential   | 各45秒、round全体5分 | `POINTS_RESERVE_RETRY_EXHAUSTED`   |
| reservation/capture status照合 |               5秒 |         3 | 1秒／exponential   |                 30秒 | `POINTS_STATUS_RETRY_EXHAUSTED`    |
| all-winner capture             |              10秒 |         5 | 2秒／exponential   |                  2分 | `POINTS_CAPTURE_RETRY_EXHAUSTED`   |
| ACTIVE reservation release     |               5秒 |         5 | 2秒／exponential   |                  2分 | `POINTS_RELEASE_RETRY_EXHAUSTED`   |
| Markets D1 forward finalize    |              10秒 |         3 | 1秒／exponential   |                  1分 | `MARKETS_FINALIZE_RETRY_EXHAUSTED` |

- retry対象はtimeout、network error、429、502／503／504だけとし、429の`Retry-After`がdeadlineを超える場合は再実行しない。validation、scope、ownership、hash、idempotency conflict、確定的残高不足を同じstepでretryしない。
- reservation／captureの応答が曖昧な場合は、次のcreate／captureより先にstatus照合を行う。statusで成功済みなら同じreceiptからforwardへ進み、未確定なら同じidempotency keyだけを再送する。
- reservation leaseがcapture前に切れた場合はretry budget exhausted扱いにせず、旧roundのACTIVEを全releaseし、同じcutoffの新roundをappendする。leaseを延長せず、過去roundへ戻らない。
- 最大attemptまたは最大経過へ達したら、まずstatus照合結果をD1へ確定する。`BUY_NOW`でcapture未成立が確認でき、ACTIVE reservationのreleaseも確認できた場合だけhold全数量を内部CASでrestoreして`FAILED_RESTORED`へ終端し、手動retryを受け付けない。capture済みならrestoreせずforward finalizeへ進む。結果不明、status照合不能、release結果不明、または`END_OF_AUCTION`はsagaを`SETTLEMENT_MANUAL_ACTION_REQUIRED`へ単調CASし、BUY_NOW holdを維持する。いずれも上表reason、最後の安全なHTTP class、attempt数、deadline、request IDをfailure／auditへappendし、metric／alertを1件だけ発火して自動retry loopを停止する。token、残高、reservation vector、response bodyをaudit／alertへ含めない。

## 6. Points呼出し

- Service Bindingの`fetch()`でPoints Hono APIを呼ぶ。
- Service Bindingを信頼境界の代わりにせず、OAuth bearer token、issuer、audience/resource、client ID、scope、利用者Tokenのpairwise `sub`を検証する。
- opaque user token: 標準introspectionで`active`、issuer、pairwise subject、audience/resource、client、scopeを検証したbalance read、reservation create。
- opaque Client Credentials Token: 利用者`sub`が存在せずM2M scopeだけであることを標準introspectionで検証したreservation status、capture、release。利用者scopeと混在させず、利用者subjectとして扱わない。
- Marketsはcomponent額を正本にせず、`pointPackageRevisionId`、`priceTicks`、`quantity`を送り、Pointsが不変revisionからvectorを再計算する。
- すべてのwinner/axisは同じPoints D1で1回にcaptureする。

## 7. 失敗処理

- `END_OF_AUCTION`の残高不足/負残高: bidderを1回だけ除外し、blacklist eventを1件記録し、そのroundの成功予約を全releaseして再計算する。
- `BUY_NOW`の残高不足／負残高／grant失効／確定的reservation conflict: 代替winner、blacklist、clearing再計算へ入れず、reservation ID 0件の決定的failure、または全IDの未capture status＋ACTIVE分release receiptを確認後にhold全数量を一度だけ`FAILED_RESTORED`へ進める。
- OAuth user grant失効: 新規reservationは確定的失敗だがblacklistにはせず、そのroundの成功予約を全releaseする。既存reservationのstatus/capture/releaseはM2M grantで継続できる。
- timeout/429/5xx: bidderを除外せず、status APIで結果を照合してから同じround/keyでretryする。
- capture前にreservationが1件でも期限切れなら全件captureを拒否し、そのroundのACTIVE reservationをreleaseして同じcutoffからroundを再開する。leaseを延長しない。
- capture時の残高再検査で不足した場合、Pointsはcaptureを0件のままM2M Problem Detailsの`insufficientReservationIds`だけを返す。`END_OF_AUCTION`はrequestに含めた自Client所有IDだけであることを照合し、該当Markets userを1回だけ除外して旧roundのACTIVE reservationを全releaseし、同じcutoffから再計算する。`BUY_NOW`は同じID検査でcapture 0件を確認し、release receipt後に全数量を`FAILED_RESTORED`へ進め、代替者へ再配分しない。IDが空、未知、別round、request外ならprotocol failureとして候補を変えずholdを維持する。
- `insufficientReservationIds`、Points残高、評価軸別不足量をbrowser response、public API、HTML、WebSocket、logへ出さない。利用者向けには精算進行中または一般化した失敗状態だけを返す。
- user OAuth grantが外部失効しても、すでに作成済みのreservationをblacklist理由にせず、所有Markets Client IDのM2M tokenでstatus／capture／releaseを継続する。失効後の新規reservationだけを拒否する。
- Points capture成功後にMarkets finalize失敗: refund/releaseせず、reconcilerがMarketsをforward finalizeする。
- capture前に永久失敗: `END_OF_AUCTION`はACTIVE reservationをreleaseしてmanual actionへ進める。`BUY_NOW`は外部作用前、決定的reservation拒否でID 0件、または全reservation未capture＋ACTIVE分release完了のいずれかを確認できた場合だけ`restoreBuyNowHold`で全数量を`FAILED_RESTORED`へ進め、結果不明ならholdを維持したmanual actionへ進める。
- 自動rollbackでD1経済履歴やWorkflow stepを削除しない。

### Settlement状態read

- same-origin browserは`GET /api/settlements/{settlementId}`で進行状態をpollできる。Markets sessionと対象Auction／Settlementへの閲覧権限を再検証し、request bodyやqueryのuser IDを信用しない。
- responseはsettlement kind、一般化したsaga state、progress、manual action可否、updatedAt、request IDだけを返す。Points reservation ID、残高、評価軸、内部Points user ID、Token、raw failure response、除外候補を返さない。
- seller、自身が関係するbuyer、stateへ束縛済みのretry flowを開始した同一Markets session以外は拒否する。Points ADMIN step-upは対象外Settlementの閲覧権限を追加しない。
- 即時購入のHTTP responseはこのrouteへのsettlement IDとpending状態を返し、hold作成だけを購入完了として表示しない。capture後のproof確定、確認済み未capture＋release後の`FAILED_RESTORED`、または結果不明でholdを維持するmanual actionへ単調に進む。

## 8. outboxとreconciler

- Auction closeとoutbox insertを同じMarkets D1 transactionで確定する。
- scheduler/reconcilerは未開始outbox、停滞saga、Points status不一致を走査する。
- 同じAuctionのWorkflowはsingle-flightにする。Marketsに独自ADMIN roleを作らず、手動retryはPointsの同格ADMINと15分以内Google freshを専用Authorization Code + PKCEで検証する。
- `BUY_NOW`の手動retryは結果不明でholdを維持している`SETTLEMENT_MANUAL_ACTION_REQUIRED`だけを対象にし、status照合から再開する。`FAILED_RESTORED`、`CAPTURED`以降、反対outcomeを要求するretryを拒否する。
- 専用scopeは`points.admin.settlement.retry`だけとし、通常user／Refresh／Client Credentials grantへ混ぜない。assertionはAuction、Settlement、reason hash、Markets Sessionへ束縛し、最大60秒とする。
- GET callbackは検証済みclaimsを`PENDING`として`jti`一意で保存するだけで、Workflowを開始しない。同じSessionからのCSRF保護POSTが期限内`jti`を一回だけ`USED`へ進め、rate limitとsingle-flightを再検証し、`workflowAttempt`を増分した新しいretry outboxを確定してからretryする。
- link／unlink／relinkの`returnTo`はqueryなしの固定`/settings/points-connection`、Settlement retryはstateへ対象を束縛したqueryなしの固定`/settlements/{settlementId}`とする。caller指定interfaceを作らず、query、fragment、userinfo/credential、scheme/host、`//`始まり、rawまたはpercent decode後のbackslash／control文字、複数回decodeで意味が変わる入力を拒否する。callback queryの`returnTo`を遷移先に使わない。
- reconciliationはplan hash、Markets state、Points reservation/capture status、proofを比較し、修復は単調なforward actionだけを行う。

## 9. observability

- Cloudflare Workers Logs／Tracesをrequest単位の診断正本、Analytics Engine `OPS_METRICS`を時系列集計、Markets D1 `ops_alerts`をalert dedupe／delivery状態の正本とする。5分Cronが[横断セキュリティ・配信仕様](../../../../../docs/web-app/v0.2/security-and-delivery.md)のthresholdを評価し、Email Routingで運用alertを送る。
- correlation ID: Auction ID、settlement ID、Workflow instance ID、plan hash、Points request ID。
- logへOAuth token、AutoBid上限、Cookie、CSV本文、個人情報bodyを出さない。
- metric／alert対象はAuction open／close遅延、stale WebSocket lease／gap resync、Workflow／outbox／stuck saga、manual retry、reconciliation mismatchとする。
- retry budget上限はstep／reason別counterと最古停滞時間を持ち、同じsaga／reasonのalertはdedupe keyで1件へ収束させる。
- Email配送失敗は`ALERT_DELIVERY_FAILED`としてD1、log、metricへ記録し、同じEmail channelを再帰的にalertしない。economic transactionはobservability障害でrollbackしない。
- append-only auditにactor、operation、before/after state、reason、request ID、結果を残す。

## 10. 必須テスト

- D1 commit前にbroadcastしない
- 同時command、CAS conflict、command/seq重複
- DO hibernation、eviction、再起動後のD1復元
- frame 4KiB、token query、hostile Origin拒否、cross-DO同時接続の20／3 slot競合、20使用済みから2同時接続で1件だけ成功、accept失敗／close／hibernation後のlease整合
- version/seq gapからHTTP resync
- `DRAFT -> SCHEDULED`配送、startsAt alarm、同時初回access、alarm遅延、endAt alarm、再deploy／eviction復旧、旧revision／`CANCELLED` no-op
- Workflow各stepでのcrash/retry
- reserve／status／capture／release／finalize各stepのtimeout、総attempt、exponential backoff、最大経過、429 deadline、上限時の単調manual state／audit／dedupe alert
- 不足者除外後の同cutoff再計算
- user tokenとM2M tokenのscope逆用拒否
- capture成功・Markets finalize失敗からforward recovery
- capture時不足IDから該当userだけを除外し、旧ACTIVE全release後に同cutoff再計算。未知IDとbrowser／public漏えいを拒否
- capture後refundなし、未使用reservation release
- reconciler多重起動で結果が1件に収束
