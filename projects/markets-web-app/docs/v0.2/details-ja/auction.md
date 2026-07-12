# Auction画面・API仕様

経済ruleの正本は[Marketsドメイン仕様](./markets-domain.md)、リアルタイムと精算は[リアルタイム・精算](./realtime-and-settlement.md)を参照する。

DEC-262により、出品は独立Listingの作成ではなく、商材情報を含むAuctionの作成を意味する。

## 1. URL

- 一覧: `/auctions`
- Auction CSV作成: `/auctions/import`
- Points連携・解除・再連携: `/settings/points-connection`
- 詳細・入札: `/auctions/{auctionId}`
- 自分の出品: `/me/auctions/created`
- 自分の入札: `/me/auctions/bids`
- 自分の落札: `/me/auctions/won`
- proof: `/proofs/{proofId}`
- Settlement状態・手動retry: `/settlements/{settlementId}`

`/dashboard`prefixや旧`freeism.app`のpathへ後方互換redirectを作らない。

## 2. 一覧card

- title、description要約、seller表示名
- 状態、開始・終了時刻を利用者local timeで表示
- 販売数量、現在のprovisional allocation数
- package名・ID・revision
- 構成評価軸名・ID・比率
- package price tick、現在の公開価格、即決価格の有無

画像placeholderも含め画像領域は作らない。検索はtitle、description、auction ID、package ID/nameのD1対応範囲とする。

## 3. CSV出品

> Auction商材fieldの文字／URL境界はDEC-254、Package文字／hash境界はDEC-257、現在lifecycleの30秒receiptはDEC-256で確定している。

### 主要列

- `title`
- `description`
- `externalUrl`
- `pointPackageId`
- `pointPackageRevisionId`
- `quantity`
- `startsAt`
- `endsAt`
- `buyNowPrice`: 任意
- `extensionThresholdSeconds`: 任意
- `extensionDurationSeconds`: 任意
- `maxExtensions`: 任意
- `clientRowId`: file内一意

CSVはUTF-8、最大5MiB、1,000非空行。title／description／外部URLのcode point、UTF-8 byte、HTTPS正規化境界はMarketsドメイン3.3と同じshared validatorを使う。server validation後のpreviewには、Pointsから取得したpackage component vector、計算済みpackage tick、時刻、即決、延長ruleを表示する。1件でも不正なら全件を確定しない。

確定時は参照したpackage revisionが存在し、同じcontent hashかつ履歴`status=ACTIVE`であることを再確認する。それだけを現在のAuction利用可否とは扱わず、server再parse後の全rowをPointsのM2M `checkPointPackageAuctionEligibility`へ送り、現在のPackage lifecycleがACTIVEである30秒receiptを全件分取得する。開始前PATCHも同じ条件を使う。Markets D1 commitは`serverNow < validUntil`で開始し、receipt／eligibility version／検査時刻／期限／commit開始時刻を`auctionRevision`へsnapshotする。確定後にINACTIVEとなった既存Auctionと精算は継続し、Points障害時や新規作成時に古い任意packageへfallbackしない。

1,000行の確定は巨大multi-value SQLや1行1queryを使わない。validation済みrowをUTF-8 1,500,000 bytes以下のcanonical JSON chunkへ分け、各固定SQLが1 chunkを`json_each(?)`でset-based展開する。全Auction、Auction revision、snapshot、idempotency、audit statementを100以下の同じD1 `batch()`へ入れ、1 statement失敗時は全件rollbackする。5MiB／1,000行を実D1 runtimeで30秒以内に処理できることをintegration testで固定する。

### 開始前の編集・取消

- 自分の出品画面は`DRAFT`／`SCHEDULED`かつserver時刻が`startsAt`より前の場合だけ編集・取消buttonを表示する。表示判定は利便性であり、認可と競合判定はserverで必ず再実行する。
- 編集は`PATCH /api/auctions/{auctionId}`へ完全な編集対象、`expectedAuctionVersion`、`Idempotency-Key`を送る。成功responseの新versionで画面を置き換え、409では最新snapshotを再取得する。
- 取消は確認dialogの明示操作から`POST /api/auctions/{auctionId}/cancellations`へexpected versionと理由を送る。受理済みbid、AutoBid、buy-now holdが1件でもある場合は`409 AUCTION_CANCELLATION_BLOCKED`を表示し、Auctionを画面上で取消済みにしない。
- 成功時は`CANCELLED`終端状態を表示し、bid／即決／編集操作をすべて隠す。取消は物理削除ではなく履歴とauditを保持する。

## 4. 詳細画面

- Auction revisionの商材情報、seller、package snapshot
- server基準の状態と残り時間
- 販売数量、provisional ranking/allocation
- uniform priceの説明と現在の参考値
- 自分のmanual bid、希望quantity、AutoBid上限の本人専用表示
- bid履歴。AutoBid上限は非表示
- watchlist button
- Points連携状態と、未連携時の明示link導線
- WebSocket接続状態、最終`auctionVersion`/`bidSeq`、再同期状態

通信断時も古い画面からblind bidを送らず、HTTP snapshot再取得後にexpected version付きで送る。

### Points連携画面

- `/settings/points-connection`はlink／relink／unlinkの対象Pointsアカウントと現在statusを表示する。linkとrelinkを暗黙実行せず、利用者の開始操作とcallback後の明示confirm POSTを要求する。
- unlinkは15分以内のGoogle freshを要求し、callback後はpending確認画面を表示するだけとする。明示confirm POSTが`409 ACTIVE_RESERVATION_EXISTS`なら連携をACTIVEのまま保ち、Points receipt受領後だけ`UNLINKED`を表示する。
- provider側失効による`REAUTH_REQUIRED`では既存Markets userのrelink導線を表示する。別アカウント作成やemail一致linkへ誘導しない。

## 5. bid API

### request

`POST /api/auctions/{auctionId}/bids`

```json
{
  "commandId": "cmd_01...",
  "expectedAuctionVersion": 42,
  "quantity": 2,
  "priceTicks": 15,
  "autoBidMaxTicks": 30
}
```

- manualだけなら`autoBidMaxTicks`を省略する。
- AutoBidだけでも現在到達値として`priceTicks`をserverが決定できる。
- 金額を小数JSON numberで送らず、package tick数を安全整数で送る。

### 成功

```json
{
  "data": {
    "commandId": "cmd_01...",
    "auctionVersion": 43,
    "bidSeq": 108,
    "acceptedPriceTicks": 16,
    "quantity": 2
  }
}
```

### 主なerror

- `401 AUTHENTICATION_REQUIRED`
- `403 POINTS_LINK_REQUIRED`
- `403 SELLER_CANNOT_BID`
- `409 AUCTION_VERSION_CONFLICT`
- `409 AUCTION_NOT_OPEN`
- `409 IDEMPOTENCY_KEY_REUSED`
- `422 INVALID_QUANTITY`
- `422 INVALID_PRICE_TICK`

失敗はRFC 9457 Problem Detailsとし、最新snapshotの再取得が必要な409には`currentAuctionVersion`を付ける。

## 6. AutoBid操作

- 上限設定・更新はbid APIと同じcommand列で直列化する。
- 取消APIは将来増額だけを停止し、現在到達bidを削除しないことを確認dialogに表示する。
- 上限は本人専用responseでも`Cache-Control: private, no-store`とし、WebSocket eventへ含めない。

## 7. 即決

- 即決buttonはAuctionのcurrent revisionに価格があり、AuctionがOPENで、残数量がある場合だけ表示する。
- command送信前にquantityと総package tickを確認する。
- API成功をもって確定表示せず、Settlement状態を購読し、proof発行後に完了表示する。
- 不足、競合、残数量変化時はProblem Detailsを表示してsnapshotを再取得する。
- `FAILED_RESTORED`は購入不成立かつ全数量復元済みとして表示し、同Settlementの再試行導線を出さない。結果不明の`SETTLEMENT_MANUAL_ACTION_REQUIRED`は在庫holdを維持した確認待ちとして表示し、購入不成立や数量復元を断定しない。

## 8. proof画面

> reviewの文字／URL境界はDEC-254で確定している。

- 未ログインでも閲覧できる。
- proof ID、Auction ID／Auction revision、Package revision、seller/buyer snapshot、数量、uniform price、component vector、settledAt、statusを表示する。
- secret tokenをURLへ含めず、`Cache-Control`と検索index方針を公開proof仕様に合わせる。
- seller/buyer本人だけに相互評価入力を表示する。
- proof本体とreview APIを別々に取得する。review作成・更新後もproof本体のcontent hash、ETag、immutable cacheを変更しない。
- current reviewは方向ごとに表示し、revision履歴はcursor paginationで別表示する。reviewの短期cacheを再検証してもproof本体を再生成しない。

## 9. accessibilityと時刻

- ranking、connection、winner状態を色だけで表さない。
- countdownだけでなく絶対終了日時を併記する。
- browser timezone名を表示し、server timestampはUTC/RFC 3339で受け取る。
- WebSocket updateはscreen readerへ過剰announceせず、重要状態変化だけをlive regionへ出す。

### adaptive Turnstile

- 通常のOAuth、link／unlink、bid、AutoBid、即決、Auction作成・編集操作へTurnstileを常時表示しない。Marketsのapp rate／risk signalが要求した場合だけ、APIは`TURNSTILE_REQUIRED`とoperation別actionを返し、UIがwidget tokenを取得して同じidempotency keyの操作を再送する。
- WorkerはSiteverify responseのsuccess、環境別hostname、operation別action、`challenge_ts`期限を検査し、token hashをD1で一回だけ消費する。timeout、action／hostname不一致、期限切れ、replayはfail-closedとし、Secretやraw tokenをlog／auditへ残さない。
- Cloudflare WAF managed challengeとapp Turnstileは別controlであり、一方の通過を他方の検証結果として扱わない。

## 10. 必須テスト

- CSV 1,000/1,001、package revision競合、全件rollback
- Auction title 0／1／120／121 code pointと480 byte、description 0／1／4,000／4,001 code pointと16,000 byte、emoji／結合文字、外部URL 1件／2,048 byte／HTTPS／userinfo／fragment／canonical化をCSV、PATCH、UIで一致させる
- 作成者だけの開始前編集・取消、version／startsAt競合、bid／AutoBid／buy-now holdがある取消拒否、`CANCELLED`終端
- 未ログイン、Points未連携、seller、終了後のbid拒否
- manual/AutoBid/取消/即決
- expected version競合とsnapshot再取得
- 同じcommand retryと異なるpayload conflict
- local time表示とserver endAt境界
- AutoBid上限のAPI/HTML/WebSocket/log漏えい防止
- public proofと本人だけの相互評価
- review comment 0／2,000／2,001 code pointと8,000 byte、emoji／結合文字、completionProofUrl空／HTTPS／2,048 byte／userinfo／fragmentのAPI／UI境界
- proof hash／immutable cacheがreview revision追加後も不変で、current review／revision履歴だけが更新される
- Points unlinkのGoogle fresh、callback pending、明示confirm、ACTIVE reservation 409全状態不変、receipt後UNLINKED、REAUTH_REQUIREDからrelink
- 通常操作でTurnstileなし、risk時だけwidget表示、Siteverify hostname／action／期限／replay拒否、WAF challengeと独立
