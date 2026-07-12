# Points–Markets連携契約

## 1. 境界

PointsはOAuth Authorization Server兼Resource Server、MarketsはOAuth Client兼Settlement Orchestratorである。両者は同じrepositoryにあっても、DB、session、Secret、domain model、runtime型を共有しない。

- Points D1をMarketsから直接参照しない。
- Markets D1をPointsから直接参照しない。
- Service Bindingの`fetch()`でHTTPS相当のHono API contractを呼ぶ。
- Pointsが所有するOpenAPIを正本にし、Marketsは生成clientを使う。MarketsがPoints backend sourceやHono RPC型を直接importしない。

## 2. 1対1連携

1つの環境内で次を保証する。

- 1 Markets userにACTIVEなPoints連携は1件だけ。
- 1 Points issuer/subjectにACTIVEなMarkets userは1件だけ。
- link開始stateは現在のMarkets session、固定`/settings/points-connection`のhash、PKCE challenge、nonce、期限へserver-sideで束縛する。
- link／unlink／relinkのreturn URLはqueryなしの固定`/settings/points-connection`、Settlement retryはstateへ束縛したqueryなしの固定`/settlements/{settlementId}`とする。callerが任意return URLを指定するinterfaceを公開しない。fragment、query、userinfo/credential、scheme/host、`//`始まり、rawまたはpercent decode後のbackslash／control文字、複数回decodeで意味が変わる値を拒否する。Pointsへはraw URLではなく完全一致redirect URIと固定return URL hashを渡し、callback queryのreturn URLを遷移先に使わない。
- request bodyの任意`marketsUserId`を信用しない。
- browser authorization前にMarkets WorkerがClient CredentialsでPointsへlink-attemptを登録する。Pointsはopaque attempt IDをClient ID、Markets user、state hash、PKCE challenge、redirect URI、scope、期限へ束縛し、authorization／code／app-owned grantが同じattemptを参照する。
- link完了時に`pointsIssuer`、pairwise `pointsSubject`、scope、grant metadataを保存する。Pointsのemailや表示名をlink keyにしない。
- Points D1でも`PENDING_MARKETS_CONFIRMATION`／`ACTIVE`を対象に`(clientId, marketsUserId)`と`(clientId, pointsUserId)`を各1件に制限し、競合時は新しいcode／token familyを発行しない。Token交換直後のgrantはpendingでResource APIを拒否する。Markets local pending保存後のM2M finalizationでだけACTIVEにし、cancel／10分TTLで新attempt由来grantだけをrevokeする。既存grantを変更しない。
- ACTIVEなreservationが1件でもある間は、通常のPoints–Markets unlink/relinkを拒否する。利用者がprovider側でgrantを外部失効させた場合でも、既存reservationとsettlementはM2Mでstatus/capture/releaseでき、新規balance read/reservationは拒否する。
- 通常unlinkは専用Authorization Code + PKCEと`points.connection.unlink`でGoogle freshを証明した後、Pointsの`deactivatePointsConnection`を呼ぶ。Pointsはapp-owned grantを認可の正本とし、ACTIVE reservation 0件のguard、grant `UNLINKED`化、revocation outbox、receipt、auditを1つのD1 transactionで確定する。Marketsは成功receipt後だけlocal rowを閉じる。
- 外部失効はapp-owned grantを`REAUTH_REQUIRED`へ進め、標準tokenの期限が残っていてもResource middlewareのlive status/version検査でuser APIを拒否する。M2M APIはgrant statusではなく既存reservationの所有Client IDを検査してsettlementを継続する。

## 3. OAuth Client

### 3.1 Client ID

- environmentごとに1つのMarkets OAuth Client IDを発行する。
- Pointsは標準pairwise subjectを使い、Markets clientを`subject_type=pairwise`で静的登録する。public subjectを許可せず、environment／別client間で同じsubjectを共有しない。
- 同じClient IDに`authorization_code`、`refresh_token`、`client_credentials`を許可する。
- grantごとに互いに素なscope allowlistを分離する。標準introspectionへ独自`token_class`／`grant_type` claimを追加しない。
- stagingとproductionでClient ID、secret、redirect URI、issuer、JWKS、audience/resourceを共有しない。
- Client secretはMarkets Worker Secretsにだけ保存し、D1、browser、repository、build artifactへ入れない。

同じsecretの漏えいが両grantへ影響し得る残余riskを受容する。分離を維持する主防御は互いに素なscope、audience、pairwise `sub`の有無から導出するprincipal class、reservation ownership、idempotencyである。

### 3.2 Authorization Code + Refresh Token

- server-side BFFでAuthorization Code + PKCE S256を使う。
- redirect URIは完全一致allowlistとする。
- user consentを省略しない。
- `offline_access`でRefresh Tokenを発行する。
- Better Auth OAuth Providerは`disableJwtPlugin: true`とし、利用者Access Tokenをopaqueに固定する。JWT Access TokenをResource APIへ発行しない。
- confidential Markets clientのID TokenはBetter Auth標準のClient Secret署名をOIDC用途でだけ検証し、Points Resource APIのBearerまたは連携keyにしない。
- user Access TokenとRefresh TokenはMarkets D1へアプリ層暗号化して保存する。
- browserへAccess/Refresh Tokenを返さず、Markets host-only sessionだけを使う。
- Marketsは標準`/api/auth/oauth2/introspect`で`active=true`、issuer、pairwise subject、Client ID、scope、audience/resource、期限を検証する。Token文字列をJWTとしてdecodeせず、Points内部user IDを連携keyにしない。

許可scope:

- `openid`
- `profile`
- `points.connection.read`
- `points.balance.read`
- `points.reservations.create`
- `offline_access`

通常unlink用の`points.connection.unlink`は上記Refresh Tokenへ追加しない。同じClient IDの専用Authorization Code + PKCEでだけ発行し、Google fresh、対象grant、Markets Session、固定`/settings/points-connection`、nonce、期限へ束縛した一回限りのtokenとする。

### 3.3 Client Credentials

- Markets WorkerだけがToken endpointを呼ぶ。
- user subject、redirect URI、`offline_access`を持たせない。
- `disableJwtPlugin: true`によりM2M Access Tokenもopaqueとするが、利用者Tokenとはscopeと利用者`sub`の有無を分離する。
- M2M tokenは短命、memory cache可能だが永続平文保存しない。標準introspectionで利用者`sub`が存在しないこととM2M scopeだけであることを必須にし、利用者subjectとして解釈しない。

許可scope:

- `points.connection.link-attempt.create`
- `points.connection.link-attempt.finalize`
- `points.packages.auction-eligibility`
- `points.reservations.status`
- `points.reservations.capture`
- `points.reservations.release`

### 3.4 Settlement管理step-up

Settlementの手動再試行だけは通常の利用者grant、Refresh Token、Client Credentialsを使わない。Markets BFFは同じClient IDで専用Authorization Code + PKCE flowを開始し、`points.admin.settlement.retry`だけを要求する。

- PointsはACTIVEな1対1連携、同格ADMIN、15分以内のGoogle freshを確認する。
- stateはMarkets Session、Auction ID、Settlement ID、reason hash、固定`/settlements/{settlementId}`へserver-sideで束縛する。
- code交換後に発行する署名assertionはMarkets Settlement管理resourceだけをaudienceとし、対象ID、reason hash、pairwise subject、`jti`、`iat`、`exp`を含める。
- assertionの有効期間は最大60秒、Refresh Tokenなし、一回限りとする。
- MarketsのGET callbackはassertion検証後にraw Tokenを破棄し、対象とSessionへ束縛した期限内`PENDING` authorizationを`jti`一意で保存するだけにする。Workflowは開始しない。
- 同じMarkets SessionからのCSRF保護POSTだけが`jti`を`USED`へ原子的に進め、対象Settlementのstate、single-flight、rate limit、idempotencyとdeterministic retry outboxを同じMarkets D1 transactionで確定する。commit後のdispatcherがoutbox IDをWorkflow instance IDとして起動し、D1 commitとWorkflow binding callの間のcrashをoutbox再送で回復する。
- Pointsは権限を証明するだけで、Markets D1を更新せず、Settlement Workflowを実行しない。

### 3.5 Resource Server検証

Points Resource APIは同じWorker内のBetter Auth instanceを渡した標準`oauthProviderResourceClient(auth)`／標準server APIでin-process introspectionし、Resource Server専用Client Secretを追加しない。Marketsがlink完了等でremote `/api/auth/oauth2/introspect`を呼ぶ場合だけ、Markets confidential Client ID／Secretを使う。各requestで`active=true`、`iss`、`aud/resource`、`exp`、存在する場合の`nbf`、`client_id`、scope、利用者Tokenのpairwise `sub`を検証する。opaque Tokenを未検証decodeせず、独自Token形式・独自introspection endpoint・内部user IDをpairwise subjectへ上書きするcustom claimを作らない。

- user tokenはpairwise `sub`が存在し、scopeが利用者allowlistだけである場合に限って利用者委任principalへ分類し、ACTIVEなapp-owned connectionを照合する。MarketsへPoints内部user IDを返さない。
- M2M tokenは利用者`sub`が存在せず、scopeがM2M allowlistだけである場合に限ってM2M principalへ分類し、Client IDと既存reservation所有権も検証する。標準introspectionの`token_type=Bearer`は分類根拠にしない。
- 利用者／M2M scopeの混在、`sub`有無との矛盾、未知scope、分類不能を拒否する。Better Authの標準responseだけでこの分類が成立しない場合は独自claimへfallbackせずreleaseを停止する。
- user tokenでcapture/release/statusを実行できない。
- M2M tokenで任意ユーザーのbalance readやreservation createを実行できない。
- staging tokenをproductionが受け付けず、逆も同様とする。
- Service Bindingから来たことだけで検証を省略しない。
- Better Auth `1.7.0-rc.1`と正式`1.7.0`のlive spikeでopaqueなAuthorization Code／Refresh／Client Credentials、pairwise introspection、revocation、resource、scope分離を検証し、標準APIで成立しなければ独自実装へfallbackせず停止する。

## 4. Token保存とrefresh

- Better AuthのOAuth token暗号化機能または同等のversioned envelope encryptionを使う。
- encrypted payloadはkey version、nonce、ciphertext、auth tagを持つ。
- key ringはWorkers Secretsで環境・アプリ別に管理し、current encrypt keyと旧decrypt-only keyを持つ。unknown versionを拒否し、read／Refresh CASでlazy rewrapする。旧version ciphertext 0件を確認するまで旧keyを削除しない。
- tokenをCookie、localStorage、session payload、Problem Details、log、auditへ出さない。
- Refresh Token rotationは、`pointsConnectionId`単位のD1 lease/CASでsingle-flightにする。
- lease owner、lease expiry、account token versionを条件付きUPDATEし、同時refreshはwinnerの結果を再読込する。
- 401時は明示refreshを1回だけ行い、同じAPI requestを1回だけ再試行する。`Idempotency-Key`必須操作では同じkeyを使い、read-only操作へkeyを追加しない。
- `invalid_grant`は連携を`REAUTH_REQUIRED`にし、無限retryしない。

## 5. 共通HTTP contract

### 5.1 headers

- `Authorization: Bearer {token}`
- `Idempotency-Key: {opaque-id}`は7章のoperation matrixで「必須」とした操作だけで必須とする。GET、balance-check、reservation-statusでは要求しない
- `Content-Type: application/json`
- `X-Request-Id`はcallerが設定可能。未指定時はPointsが発行する
- private responseは`Cache-Control: private, no-store`
- Point Package Auction eligibility／reservation status／一括capture／releaseは1,048,576 bytes、それ以外のJSON POSTは65,536 bytesをrequest body上限とし、超過時はbodyをparseせず`413`を返す。Auction eligibilityへの1MiB適用はDEC-256で確定している

### 5.2 response

成功:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_01..."
  }
}
```

失敗はRFC 9457 Problem Detailsと機械判定用`code`を返す。

```json
{
  "type": "https://points.freeism.app/problems/insufficient-balance",
  "title": "Insufficient point balance",
  "status": 409,
  "code": "INSUFFICIENT_BALANCE",
  "requestId": "req_01..."
}
```

同じidempotency keyと同じpayload hashは初回HTTP statusとdomain結果へ収束する。初回が`201`ならreplayも`201`とする。成功時の`data`または失敗時のProblem Details domain結果は保持するが、transport observabilityの`meta.requestId`／`requestId`は再試行ごとに再発行してよい。同じkeyで異なるpayloadは`409 IDEMPOTENCY_KEY_REUSED`を返す。

### 5.3 OpenAPI共通schema

- Task 4 OpenAPIのJSON objectはすべて`additionalProperties: false`とする。
- opaque ID／keyはprefixをwire validationへ固定しないnon-empty stringとする。通常のID／keyは最大255文字、`reservationKey`だけは最大512文字とする。
- SHA-256 hashは`^sha256:[0-9a-f]{64}$`、UTC instantはOpenAPI `string`／`date-time`とし、実装はUTCのRFC 3339を返す。
- `priceTicks`はinteger `0..9007199254740991`、`quantity`、`weight`、`totalWeight`、`packageTick`、各versionはinteger `1..9007199254740991`、`displayOrder`はinteger `0..9007199254740991`とする。
- scale済みamount／balanceはJSON numberではなくASCII整数文字列`^-?(0|[1-9][0-9]*)$`とする。必要額は非負整数文字列`^(0|[1-9][0-9]*)$`とし、文字列をparseした境界でJavaScript安全整数範囲を検証する。
- bodyを返すsuccess envelopeは`data`と`meta`をrequiredにし、`meta.requestId`をrequired non-empty stringとする。public revisionの`304`はbodyを返さない。
- RFC 9457 Problem Detailsは`type`、`title`、`status`、`code`、`requestId`をrequired、`detail`と`instance`をoptionalとする。validation `errors` itemは`code`をrequired SCREAMING_SNAKE_CASE、`row`をoptional non-negative integer、`field`をoptional string、`message`をoptional safe stringとし、秘密値を含めない。
- protected responseのexact cache値は`Cache-Control: private, no-store`とする。public Point Package Revisionだけは7.0のimmutable cacheを例外とする。

共通Problem `code`は`MALFORMED_REQUEST`、`AUTHENTICATION_REQUIRED`、`INVALID_ACCESS_TOKEN`、`INSUFFICIENT_SCOPE`、`RESOURCE_NOT_FOUND`、`CONTENT_TYPE_UNSUPPORTED`、`REQUEST_BODY_TOO_LARGE`、`VALIDATION_FAILED`、`IDEMPOTENCY_KEY_REQUIRED`、`IDEMPOTENCY_KEY_REUSED`、`RATE_LIMITED`、`INTERNAL_ERROR`、`DEPENDENCY_UNAVAILABLE`とする。operation固有の`code`は`POINT_PACKAGE_AUCTION_INELIGIBLE`、`LINK_ATTEMPT_ALREADY_FINALIZED`、`ACTIVE_RESERVATION_EXISTS`、`INSUFFICIENT_BALANCE`、`POINT_RESERVATION_NOT_ACTIVE`、`POINT_RESERVATION_EXPIRED`、`RESERVATION_VECTOR_HASH_MISMATCH`、`SETTLEMENT_PLAN_HASH_MISMATCH`だけを正本とし、このTaskで実装内部error codeを追加しない。

## 6. 金額とvector

- JSONの小数numberを金額contractに使わない。
- package価格は安全整数の`priceTicks`、数量は安全整数の`quantity`で渡す。
- Pointsは`pointPackageRevisionId`から自身のD1にある不変componentと`minimumUnit`を取得し、scale済みvectorを再計算する。
- Marketsから送られた表示用component snapshotを経済計算の正本にしない。
- すべてのcomponent amount、合計、途中値をJavaScript安全整数範囲内で検証する。

## 7. Endpoint wire正本

OpenAPI `operationId`は次へ固定し、Points handlerとMarkets生成clientで別名を作らない。body上限はbyte数であり、GETはrequest bodyなしとする。

| Method／path                                                     | operationId                           | Success | Body上限        | `Idempotency-Key` |
| ---------------------------------------------------------------- | ------------------------------------- | ------- | --------------- | ----------------- |
| `GET /api/v1/point-package-revisions/{pointPackageRevisionId}`   | `getPublicPointPackageRevision`       | 200/304 | なし            | 不要              |
| `POST /api/v1/point-package-auction-eligibility-checks`          | `checkPointPackageAuctionEligibility` | 201     | 1,048,576 bytes | 必須              |
| `POST /api/v1/oauth/link-attempts`                               | `createPointsLinkAttempt`             | 201     | 65,536 bytes    | 必須              |
| `POST /api/v1/oauth/link-attempts/{linkAttemptId}/finalizations` | `finalizePointsLinkAttempt`           | 200     | 65,536 bytes    | 必須              |
| `GET /api/v1/me/connection`                                      | `getPointsConnection`                 | 200     | なし            | 不要              |
| `POST /api/v1/me/connection-deactivations`                       | `deactivatePointsConnection`          | 200     | 65,536 bytes    | 必須              |
| `POST /api/v1/me/balance-checks`                                 | `checkPointBalance`                   | 200     | 65,536 bytes    | 不要              |
| `POST /api/v1/me/point-reservations`                             | `createPointReservation`              | 201     | 65,536 bytes    | 必須              |
| `POST /api/v1/point-reservations/status`                         | `getPointReservationStatus`           | 200     | 1,048,576 bytes | 不要              |
| `POST /api/v1/settlements/{settlementId}/capture`                | `capturePointSettlement`              | 200     | 1,048,576 bytes | 必須              |
| `POST /api/v1/point-reservations/release`                        | `releasePointReservation`             | 200     | 1,048,576 bytes | 必須              |

### 7.0 不変Point Package Revision

`GET /api/v1/point-package-revisions/{pointPackageRevisionId}`

- token: 不要。読取専用public API
- response:

```json
{
  "data": {
    "pointPackageId": "pkg_01...",
    "pointPackageRevisionId": "ppr_01...",
    "status": "ACTIVE",
    "name": "Example package",
    "description": "Example description",
    "relatedUrl": "https://example.com/package",
    "totalWeight": 1,
    "packageTick": 1,
    "contentHash": "sha256:...",
    "components": [
      {
        "evaluationCriterionId": "evc_01...",
        "evaluationCriterionRevisionId": "evr_01...",
        "name": "Example criterion",
        "displayOrder": 0,
        "weight": 1,
        "minimumUnitScaled": "1",
        "buyNowEnabled": true
      }
    ]
  },
  "meta": {
    "requestId": "req_01..."
  }
}
```

- `weight`は最大公約数で正規化した正の安全整数、`totalWeight`はその安全整数合計とする。比率は厳密な`weight / totalWeight`で、固定scaleへ近似しない
- `packageTick`はJavaScript安全整数、金額である`minimumUnitScaled`はASCII整数文字列とし、小数JSON numberを返さない。Marketsは文字列をparseする全境界で安全整数を検証する
- `contentHash`は`contentHash`自身とresponse envelopeを除く`data`をRFC 8785 JSON Canonicalization SchemeでUTF-8化し、SHA-256のlowercase hexへ`sha256:`を付ける。componentsはhash前に`displayOrder`昇順、同値なら`evaluationCriterionId`昇順へ並べる
- hash対象fieldは`pointPackageId`、`pointPackageRevisionId`、`status`、`name`、`description | null`、`relatedUrl | null`、`totalWeight`、`packageTick`と、各componentの`evaluationCriterionId`、`evaluationCriterionRevisionId`、`name`、`displayOrder`、`weight`、`minimumUnitScaled`、`buyNowEnabled`に固定する。未知fieldを黙ってhash対象へ追加しない
- revisionは不変で、strong `ETag`に`contentHash`を使い、`Cache-Control: public, max-age=31536000, immutable`を返す。`If-None-Match`一致時は`304`とする
- MarketsのAuction CSVは`pointPackageId`と`pointPackageRevisionId`の両方を必須とし、responseの組合せが一致しなければ確定しない
- responseの`status`は当該不変revision作成時の履歴状態であり、Packageの現在状態を表さない。新規Auctionと開始前PATCHは`status === "ACTIVE"`を確認したうえで、次のM2M Point Package Auction eligibility receiptも必須とする
- Marketsは`weight / totalWeight`と`minimumUnitScaled`から`packageTick`を独立再計算し、responseの`packageTick`と一致した場合だけ取得結果と`contentHash`を`auctionRevision`へsnapshotする。予約／capture時の経済計算はPoints D1のrevisionを正本とする
- success `200`の`data`は上記exampleの全fieldをrequiredとする。`description`と`relatedUrl`はrequired nullable、`status`は`ACTIVE | INACTIVE`、`components`は`minItems: 1`とし、各componentの全example fieldもrequiredとする。`304`は`If-None-Match`一致時だけ許可する

### 7.0a 現在のPackageのAuction利用可否receipt

> 本節のAPI、30秒lease、過去ACTIVE revisionを許可する規則はDEC-256で確定している。

`POST /api/v1/point-package-auction-eligibility-checks`

- token: Client Credentials
- scope: `points.packages.auction-eligibility`
- `Idempotency-Key`と`Content-Type: application/json`を必須とし、request bodyは1MiB、`items`は1〜1,000件に制限する
- request:

```json
{
  "auctionCommandId": "acmd_01...",
  "auctionCommandHash": "sha256:...",
  "items": [
    {
      "auctionItemId": "row_0001",
      "pointPackageId": "pkg_01...",
      "pointPackageRevisionId": "ppr_01...",
      "contentHash": "sha256:..."
    }
  ]
}
```

- `auctionItemId`はrequest内一意とし、CSVでは`clientRowId`、開始前PATCHでは変更command内の安定IDからMarketsが作る。Points user、seller、title等のMarkets private fieldは送らない
- successは`201`とし、本節に示すrequest／success response exampleの全fieldをrequiredにする。`items`は`minItems: 1`、`maxItems: 1000`、request内の`auctionItemId`はuniqueとする
- `auctionCommandHash`はserver再parse後のAuction batchまたは開始前PATCH command全体と、Public Revision APIから検証した全snapshot／`contentHash`を含むcanonical hashとする。receiptはClient ID、command ID／hash、`auctionItemId`順へ正規化した全itemへ束縛する
- Pointsは1つのD1原子処理で、全revisionが指定Packageに属すること、requestの`contentHash`と保存済み不変hashが一致すること、各revision作成時の`status`が`ACTIVE`であること、各Packageの現在`lifecycleStatus`が`ACTIVE`であることを検査する。1件でも不適格ならreceiptを0件とし、`409 POINT_PACKAGE_AUCTION_INELIGIBLE`と`auctionItemId`昇順の`errors`だけを返す。各item error objectはrequiredの`auctionItemId`と`code`の2 fieldだけを持ち、`code`は`POINT_PACKAGE_NOT_FOUND | POINT_PACKAGE_REVISION_NOT_FOUND | POINT_PACKAGE_REVISION_MISMATCH | POINT_PACKAGE_REVISION_INACTIVE | POINT_PACKAGE_INACTIVE | CONTENT_HASH_MISMATCH`に限定する。残高、Points user、内部row ID、private metadataを返さない
- 現在の`pointPackages.lifecycleStatus`、`currentRevisionId`、`eligibilityVersion`は最新の不変Package Revision追加と同じPoints D1 transactionで更新する。新規Auctionでの利用可否は`lifecycleStatus`へ従うが、指定revisionが`currentRevisionId`と一致する必要はない。現在ACTIVEなら過去の`status=ACTIVE` revisionも利用でき、過去の`status=INACTIVE` revisionは利用できない
- 全件成功時だけ次を返す:

```json
{
  "data": {
    "pointPackageAuctionEligibilityReceiptId": "paer_01...",
    "auctionCommandId": "acmd_01...",
    "auctionCommandHash": "sha256:...",
    "items": [
      {
        "auctionItemId": "row_0001",
        "pointPackageId": "pkg_01...",
        "pointPackageRevisionId": "ppr_01...",
        "contentHash": "sha256:...",
        "packageEligibilityVersion": 7
      }
    ],
    "checkedAt": "2026-07-11T00:00:00.000Z",
    "validUntil": "2026-07-11T00:00:30.000Z"
  },
  "meta": {
    "requestId": "req_01..."
  }
}
```

- `pointPackageAuctionEligibilityReceiptId`は、Auction全体のvalidation完了ではなく、指定したPoint Package revisionをそのAuction作成／開始前編集で利用できることだけをPointsが確認したreceiptである
- receipt発行transactionを線形化点とし、`validUntil = checkedAt + 30秒`で固定する。Marketsは`serverNow < validUntil`の間にD1 commitを開始した場合だけreceiptを使用でき、ちょうど`validUntil`以後の開始を拒否する。commit開始後に期限を跨いでもよい
- receipt発行後にPackageがINACTIVEになっても、期限内に開始したMarkets commitは許可する。この最大30秒のleaseをv0.2の明示的なrace境界とし、発行済みreceiptの取消、2PC、consume callbackを追加しない
- 同じIdempotency-Key／同じcanonical payloadは成功receiptまたは失敗responseを元の`checkedAt`／`validUntil`のまま再生し、期限を延長しない。同じkey／異なるpayloadは`409 IDEMPOTENCY_KEY_REUSED`とする。期限切れ後のretryは同じcommand ID／hashを保ち、新しいIdempotency-Keyで全itemを再検査する
- CSV previewでも可否を表示できるが、preview時のreceiptはcommitへ再利用しない。確定時はCSVをserver再parseし、Public Revision hashを再検証した後にfresh receiptを取得する。開始前PATCHも同じ手順を使う
- Marketsはreceipt ID、command ID／hash、itemごとのPackage ID／Revision ID／content hash／eligibility version、`checkedAt`、`validUntil`、commit開始時刻を`auctionRevision`へ保存する。確定済みAuctionと既存精算はreceipt期限切れや後のINACTIVE化で変更しない

### 7.1 連携status

`GET /api/v1/me/connection`

- token: user
- scope: `points.connection.read`
- success `200`の`data` required: `pointsConnectionId`、`issuer`、`subject`、`status`、`grantedScopes`、`grantVersion`、`linkedAt`
- `status`は`ACTIVE | REAUTH_REQUIRED`、`grantedScopes`はuniqueで通常user allowlistの`openid | profile | offline_access | points.connection.read | points.balance.read | points.reservations.create`だけを許可する。email、表示名、Points内部user IDは返さない

### 7.1a link attempt作成

`POST /api/v1/oauth/link-attempts`

- token: Client Credentials
- scope: `points.connection.link-attempt.create`
- request required: `marketsUserId`、`stateHash`、`pkceChallenge`、`redirectUri`、`requestedScopes`、`expiresAt`、`returnUrlHash`
- `pkceChallenge`はS256 base64url 43文字、`requestedScopes`はuniqueかつ`minItems: 1`で、通常user allowlistの`openid | profile | offline_access | points.connection.read | points.balance.read | points.reservations.create`だけを許可する
- success `201`の`data` required: `linkAttemptId`、`expiresAt`。Markets Session ID、PKCE verifier、raw stateは返さない
- attemptは一回限り、最長10分、Client ID、state／hash、PKCE、redirect URI、scopeへ束縛し、authorization requestから任意fieldで上書きできない
- Pointsのconsent POSTがapp-owned 1対1 uniqueを確定するまでtoken familyを発行しない

### 7.1b link attempt finalization

`POST /api/v1/oauth/link-attempts/{linkAttemptId}/finalizations`

- token: Client Credentials
- scope: `points.connection.link-attempt.finalize`
- request required: `outcome`、`marketsPointsConnectionId`、`attemptPayloadHash`。`outcome`は`CONFIRM | CANCEL`とする
- success `200`の`data` required: `linkAttemptFinalizationReceiptId`、`linkAttemptId`、`marketsPointsConnectionId`、`outcome`、`grantStatus`、`finalizedAt`。`CONFIRM`は`grantStatus: ACTIVE`、`CANCEL`は`grantStatus: CANCELLED`に対応する
- Token交換後のgrantは`PENDING_MARKETS_CONFIRMATION`で、CONFIRM receiptまでuser Resource APIを拒否する
- CONFIRMはgrantをACTIVEへ進めimmutable receiptを返す。Marketsはreceipt後だけlocal rowをACTIVEへ進める
- CANCELまたは10分TTL reaperは新attempt由来grant／token familyだけをrevocation outboxへ入れ、既存connectionを変更しない
- 同じoutcomeの再送は同じreceipt、異なるoutcomeは`409 LINK_ATTEMPT_ALREADY_FINALIZED`とする

### 7.2 連携解除

`POST /api/v1/me/connection-deactivations`

- token: 通常unlink専用の一回限りtoken
- scope: `points.connection.unlink`
- request required: `pointsConnectionId`、`reason`、`deactivationKey`。`deactivationKey`は`Idempotency-Key` headerと完全一致する
- success `200`の`data` required: `connectionDeactivationReceiptId`、`pointsConnectionId`、`status`、`grantVersion`、`reason`、`deactivatedAt`。`status`は`UNLINKED`とし、revocation outboxやTokenは返さない
- Pointsはtokenのsubject／client IDから対象app-owned grantを解決し、bodyだけを信用しない
- D1 guardはgrantが`ACTIVE`でACTIVE reservationが0件であることを再確認する。1件でもあれば`409 ACTIVE_RESERVATION_EXISTS`で何も変更しない
- 成功時はgrant `UNLINKED`、grant version増加、標準consent／token family revocation outbox、immutable receipt、auditを同じtransactionへ入れる。標準OAuth tableを直接UPDATEしない
- 同じkey／payloadの再送は同じreceipt、異なるpayloadは`409 IDEMPOTENCY_KEY_REUSED`とする
- Marketsはreceiptを保存した後だけlocal connectionを`UNLINKED`にする

### 7.3 残高

`POST /api/v1/me/balance-checks`

- token: user
- scope: `points.balance.read`
- request required: `pointPackageRevisionId`、`priceTicks`、`quantity`
- success `200`の`data` required: `pointPackageRevisionId`、`priceTicks`、`quantity`、`vectorHash`、`components`、`canReserve`、`checkedAt`
- responseの`components`は`minItems: 1`かつ`evaluationCriterionId`昇順とし、各item requiredは`evaluationCriterionId`、`evaluationCriterionRevisionId`、`requiredAmountScaled`、`availableBalanceScaled`、`sufficient`とする。`requiredAmountScaled`は非負整数文字列、`availableBalanceScaled`はsigned integer文字列とする
- read結果だけで残高を確保しない。Auction bid時にはこのendpointを呼ばない

### 7.4 vector reservation作成

`POST /api/v1/me/point-reservations`

- token: user
- scope: `points.reservations.create`
- request:

```json
{
  "reservationKey": "stl_01...:winner_01...:revision_3",
  "marketsUserId": "musr_01...",
  "auctionId": "auc_01...",
  "settlementId": "stl_01...",
  "planHash": "sha256:...",
  "pointPackageRevisionId": "ppr_01...",
  "priceTicks": 12,
  "quantity": 2,
  "leaseSeconds": 900
}
```

- requestは上記9 fieldすべてをrequiredとし、`leaseSeconds`は`const: 900`とする
- success `201`の`data` required: `pointReservationId`、`reservationKey`、`status`、`auctionId`、`settlementId`、`planHash`、`pointPackageRevisionId`、`priceTicks`、`quantity`、`vectorHash`、`components`、`leaseSeconds`、`createdAt`、`expiresAt`
- responseの`status`は`ACTIVE`、`leaseSeconds`は900とする。`components`は`minItems: 1`で、各item requiredは`evaluationCriterionId`、`evaluationCriterionRevisionId`、`amountScaled`とし、`amountScaled`は非負整数文字列とする

- Pointsはtoken subjectとACTIVEな1対1 connectionから利用者を解決し、bodyの`marketsUserId`だけを信用しない。
- 全componentを同じPoints D1原子処理で予約する。部分予約を返さない。
- leaseは15分固定。caller指定が異なれば拒否する。
- 需要が供給以下でuniform clearing priceが0 tickになるwinnerは、全componentの`amountScaled: "0"`を含むreservationを作成できる。0 vectorでも状態は`ACTIVE`、lease、所有client、settlement、plan hashを通常どおり保存し、「予約なし」や空の`components`へ省略しない。

### 7.5 reservation status

`POST /api/v1/point-reservations/status`

- token: M2M
- scope: `points.reservations.status`
- requestはexactly one of `{ lookupBy: "POINT_RESERVATION_ID", pointReservationIds: string[] }`または`{ lookupBy: "RESERVATION_KEY", reservationKeys: string[] }`とする。配列は`minItems: 1`かつuniqueとし、1MiB上限以外の件数上限を追加しない
- success `200`の`data` required: `items`。各item requiredは`pointReservationId`、`reservationKey`、`status`、`auctionId`、`settlementId`、`planHash`、`vectorHash`、`createdAt`、`expiresAt`、`terminalAt`、`terminalReceiptId`
- `status`は`ACTIVE | CAPTURED | RELEASED | EXPIRED`とする。`terminalAt`と`terminalReceiptId`はrequired nullableで、ACTIVEでは両方`null`、terminal状態では`terminalAt`を必須値とし、receiptのないEXPIREDでは`terminalReceiptId: null`とする
- 同じMarkets Client IDが作成したreservationだけを返す。unknownまたはother-clientのresourceは存在を開示しない`404 RESOURCE_NOT_FOUND`へ収束させる

### 7.6 settlement capture

`POST /api/v1/settlements/{settlementId}/capture`

- token: M2M
- scope: `points.reservations.capture`
- pathの`settlementId`とrequest対象は一致を必須とする
- request required: `auctionId`、`planHash`、`reservations`。`reservations`は`minItems: 1`で、各item requiredは`pointReservationId`と`expectedVectorHash`、`pointReservationId`はrequest内uniqueとする
- success `200`の`data` required: `captureReceiptId`、`settlementId`、`auctionId`、`planHash`、`status`、`reservations`、`capturedAt`、`contentHash`。`status`は`CAPTURED`、responseのreservation item requiredは`pointReservationId`、`vectorHash`、`status: CAPTURED`とし、`pointReservationId`昇順で返す
- 同一settlementの全winner・全評価軸を1回のPoints D1原子処理でcaptureする
- 1件でもACTIVEでない、期限切れ、所有client不一致、hash不一致ならcaptureを1件も行わない
- 全reservationの所有client／status／hash検査に成功した後、capture時点の残高再検査で1件でも不足すればcaptureを0件のまま`409 INSUFFICIENT_BALANCE`を返す。Problem Details extension `insufficientReservationIds`は、requestに含まれ、同じMarkets Client IDが所有し、残高不足になったreservation IDを重複なしの昇順配列で返す。空配列を返さない
- `insufficientReservationIds`はこのM2M endpointだけで返し、user token、browser API、public APIへ返さない。残高、評価軸ID、必要額、Points user IDを含めず、所有client検査より前のerrorへ付けない
- capture operationで許可するoperation固有Problem Details extensionは、`409 INSUFFICIENT_BALANCE`の`insufficientReservationIds`だけとする
- 0 vector reservationは通常どおり`ACTIVE -> CAPTURED`へ進め、capture receiptへ含める。Point ledger entryは0件、全残高と`evaluationTotal`は不変とし、ledger 0件を理由にtransaction guardを失敗させない
- 成功後は同じrequestを何度送っても同じcapture resultを返す

capture時残高不足の例:

```json
{
  "type": "https://points.freeism.app/problems/insufficient-balance",
  "title": "Insufficient point balance",
  "status": 409,
  "code": "INSUFFICIENT_BALANCE",
  "requestId": "req_01...",
  "insufficientReservationIds": ["prv_01...", "prv_02..."]
}
```

Marketsは配列の全IDが送信したcurrent roundに属することを検証し、対応するMarkets userだけを除外する。旧roundのACTIVE reservationをすべてreleaseしてから、同じcutoffでwinner／quantity／clearingを再計算する。空、未知、別round、request外のIDはprotocol failureとし、candidateを除外しない。

### 7.7 reservation release

`POST /api/v1/point-reservations/release`

- token: M2M
- scope: `points.reservations.release`
- request required: `pointReservationId`、`reason`、`planHash`
- success `200`の`data` required: `releaseReceiptId`、`pointReservationId`、`status`、`reason`、`planHash`、`releasedAt`、`contentHash`。`status`は`RELEASED`とする
- ACTIVEだけをRELEASEDへ進める。CAPTUREDをrelease/refundしない
- 同じclientが作成したreservationだけを操作できる

## 8. Reservation状態

```text
ACTIVE -> CAPTURED
ACTIVE -> RELEASED
ACTIVE -> EXPIRED
```

- terminal状態から別状態へ移らない。
- lease期限だけでD1行を削除せず、statusと台帳を保持する。
- expirationはD1/server時刻で判定する。
- captureとexpiryが競合した場合は条件付きUPDATEのwinnerだけが成功し、他方は現在状態を返す。
- settlement capture対象のreservationが1件でもEXPIRED/RELEASEDなら、全winner captureを0件にしてMarketsへround再開を要求する。
- capture済みの経済台帳はMarkets finalize失敗を理由に戻さない。

## 9. Settlementの責務

1. MarketsがAuction終了cutoff、またはAuctionRoomで全数量をlockした`BUY_NOW` commandからimmutable settlement planを確定する。
2. user tokenでwinner候補を同じroundとして予約する。
3. 残高不足・負残高の確定的失敗者がいれば、そのroundの成功予約も全releaseする。
4. 確定的失敗者だけを除外し、同じcutoffからwinner/quantity/clearingを再計算して新roundを予約する。一時障害では除外しない。
5. M2M tokenで全winnerを1回にcaptureする。
6. Marketsをforward finalizeし、proofを作る。
7. 未使用ACTIVE reservationをreleaseする。

PointsはAuction rankingを再計算せず、Marketsはpoint vectorを独自再計算しない。

`BUY_NOW`も同じ11-operation契約を使い、hold作成だけで完了扱いにしない。Marketsのrestore evidenceは、外部作用開始前のD1 preflight、同じidempotency keyの決定的reservation作成拒否でreservation ID 0件、または存在する全reservationの未capture status＋ACTIVE分のrelease receipt完備、という相互排他的な3種だけを許可する。いずれかを満たすterminal failureだけ内部`restoreBuyNowHold` CASで全数量を`FAILED_RESTORED`へ進め、結果不明はholdを維持してmanual actionとする。capture後は`CAPTURED_PENDING_FINALIZE`からrestore／refundせずproofを確定し、proof migration適用後の`settleBuyNowHold` CASで`SETTLED`へ進める。endAt時の未終端holdは終了時planを遅延し、全hold終端後の復元済み残数で作る。

## 10. Rate limit

- OAuth開始/Callback/Token endpointはBetter AuthのD1 rate limitとCloudflare WAFを併用する。
- Point Package Auction eligibilityはclient IDとAuction command IDをkeyにし、同じIdempotency-Keyの保存済み結果をrate countより先に返す。
- reservation createはsubject、Markets client、Auction、settlementをkeyに制限する。
- capture/releaseはclient IDとsettlementをkeyにし、retryを壊さないようidempotency cacheを先に確認する。read-onlyのstatusは同じrate keyを使うが`Idempotency-Key`やidempotency cacheを要求しない。
- rate limit responseは`429`と`Retry-After`を返す。

## 11. Contract test

- OpenAPI schemaと生成Markets clientの差分0
- Package ID／Revision IDの一致、immutable response、ETag／content hash、Markets snapshotを検証する
- Point Package Auction eligibilityは1〜1,000 item、現在ACTIVE／INACTIVE、過去ACTIVE revision、1件不適格時receipt 0件、Client／command／全item束縛、30秒境界、INACTIVE race、同じ冪等keyの期限非延長、Markets snapshotを検証する
- user/M2M scopeの正逆両方
- introspection `active=false`、issuer/audience/client/env不一致
- PKCE、state、redirect URI、code再利用
- Refresh Token同時更新とrotation
- plaintext tokenがD1 export、session、browser、logにない
- 1対1 connectionの同時link競合
- client-authenticated link-attempt、別Markets user／同Points userの競合、別Points user／同Markets userの競合、pending grantのResource拒否、confirm crash recovery、cancel／TTLで新attemptだけのcompensating revoke
- 通常unlinkのGoogle fresh、一回限りscope、ACTIVE reservation guard、Points receipt後のMarkets local close、revocation outbox retry、外部失効後のuser拒否／既存M2M継続
- reservationの全component原子性、15分境界、expiry/capture競合
- 0 tick winnerの0 vector reservation、`ACTIVE -> CAPTURED` receipt、ledger 0件、残高／`evaluationTotal`不変
- all-winner captureの1件不正で全rollback
- capture時不足の`insufficientReservationIds`がM2M／所有client／request内IDへ限定され、該当userだけの除外、旧ACTIVE全release、同cutoff再計算へ収束する。未知ID、空配列、browser／public漏えいを拒否する
- idempotency retryとpayload conflict
- capture後release/refund拒否
- Service Binding経由でもOAuthなしを拒否
- Settlement管理scopeを通常user／Refresh／M2M grantが取得できない
- Settlement管理assertionのADMIN／Google fresh、対象束縛、60秒期限、`jti`一回消費
- link／unlink／relinkの固定`/settings/points-connection`、Settlement retryのstate-bound固定`/settlements/{settlementId}`、全flowのquery／fragment／credential／別host／`//`／raw・encoded backslash／control文字／double-decode拒否
