# Marketsドメイン仕様

## 1. 責務

Marketsは、商材情報を含むAuctionの作成、入札、配分、精算進行、落札証明を管理する。Taskを作成せず、評価軸、FIX、ポイント残高を所有しない。「出品」はAuctionを作成して公開予定にする利用者操作を指し、独立したListing resourceは持たない。

### 主なaggregate

- `marketsUser`とMarkets自身のBetter Auth session/account
- `pointsConnection`と暗号化OAuth token metadata
- `auction`、`auctionRevision`、`pointPackageSnapshot`、`bid`、`autoBid`
- `settlementPlan`、`settlementSaga`、`settlementFailure`、`outbox`
- `allocation`、`auctionProof`、`tradeReview`、`watchlist`
- `idempotencyResult`、append-only `auditEvent`

Markets D1とPoints D1は完全分離し、相手DBを直接queryしない。

## 2. MarketsアカウントとPoints連携

- Markets自身のログインはGoogle OAuthだけとする。email/password、Apple、GitHubログインはv0.2で実装しない。
- MarketsアカウントはPointsアカウントから独立して作成する。
- 利用者が後からPoints OAuth Providerへ明示同意し、Markets–Pointsを1対1で連携する。
- `status = ACTIVE`行だけを対象にしたpartial unique index `(marketsUserId)`と`(pointsIssuer, pointsSubject)`により、各側に有効な連携を1件だけ許可する。解除・再連携後も過去行は履歴として保持する。
- Markets user tokenとClient Credentials tokenをbrowserへ出さない。
- 入札時には有効なPoints連携を必須とする。
- 通常unlinkは専用のPoints Authorization Code + PKCEとGoogle freshを経てPointsのapp-owned grantを先に無効化する。Pointsのimmutable receiptを取得する前にMarkets local rowや暗号化user tokenを削除しない。receipt取得後だけlocal rowを`UNLINKED`へCASし、失敗時は同じidempotency keyでreceiptを再取得して収束させる。
- provider側の外部失効は`REAUTH_REQUIRED`とし、新規balance read／reservationを行わない。unlink前に作成済みのreservationは、user grantと分離したM2M tokenでstatus／capture／releaseを継続する。
- `/settings/points-connection`は`PENDING_CONFIRMATION`、`ACTIVE`、`REAUTH_REQUIRED`、`UNLINKED`を表示し、明示link、unlink、relinkの唯一の利用者向け画面とする。通常unlinkは15分以内のGoogle freshを確認するAuthorization Code + PKCEを開始し、GET callbackではpending authorizationだけを保存する。同じMarkets SessionからのCSRF保護POSTを利用者が明示実行するまで解除しない。
- unlink confirm時にACTIVE reservationが1件でもあれば`409 ACTIVE_RESERVATION_EXISTS`とし、Points grant、Markets connection、暗号化tokenを一切変更しない。Pointsのimmutable receiptを得た後だけMarketsを`UNLINKED`へ進める。`REAUTH_REQUIRED`は既存Markets userのまま明示relinkを開始し、別user作成やemail一致linkへfallbackしない。

## 3. Auction作成と不変revision

DEC-262により独立Listingを廃止し、以下の商材fieldとAuction条件を単一Auction aggregateへ統合する。

### 3.1 作成方式

- CSVの同じ1行からAuction 1件と最初の不変`auctionRevision` 1件を作成する。一般利用者向けGUI一括入力formを作らない。
- UTF-8、最大5MiB、1,000非空行、全件validation、preview、confirm、全件原子確定を共通ruleとする。
- Auctionの作成者だけが開始前に編集・取消できる。ただし受理済みbid、AutoBid、buy-now holdが1件でもあれば取消できない。
- 最初の有効bid以後、結果へ影響するeconomic fieldを変更できない。
- title、description、外部URL、seller snapshot、Package snapshot参照、数量、開始・終了時刻、即決価格、延長rule、Package利用可否receipt metadataは`auctionRevision`へ保存する。別の商材／Listing IDやversionを作らない。

### 3.2 開始前の編集と取消

- browser BFFは`PATCH /api/auctions/{auctionId}`と`POST /api/auctions/{auctionId}/cancellations`を提供する。request bodyのseller IDを信用せず、Markets Sessionの作成者IDと`expectedAuctionVersion`を必須にする。
- 編集はserver時刻が`startsAt`より前で、Auctionが`DRAFT`または`SCHEDULED`である場合だけ許可する。入力をCSV作成時と同じruleで再検証し、既存rowを上書きせず新しい`auctionRevision`と、必要なら`pointPackageSnapshot`を追加する。
- 取消は作成者、開始前、`DRAFT`または`SCHEDULED`、受理済みbid 0件、AutoBid 0件、buy-now hold 0件を同じD1 CAS guardで再確認する。成功時はAuctionを同じtransactionで`CANCELLED`へ進め、取消event、idempotency result、auditを追加する。物理削除しない。
- startsAt到来、同時編集、同時取消、初回bidとの競合はexpected versionとD1 guardで1件だけを成功させる。条件付きUPDATEが0行の場合を成功扱いにせず、version競合は`409 AUCTION_VERSION_CONFLICT`、開始済みは`409 AUCTION_ALREADY_STARTED`、bid／AutoBid／buy-now hold存在時の取消は`409 AUCTION_CANCELLATION_BLOCKED`を返す。
- 取消commit後にAuctionRoomへ最新revisionを通知し、残っているalarmを削除する。通知失敗時もD1の`CANCELLED`を正本とし、outbox再送または次回accessで収束させる。

### 3.3 必須項目

> 本節のAuction商材fieldの文字／URL境界はDEC-254、Package文字／hash境界はDEC-257、現在lifecycleの30秒receiptはDEC-256で確定している。

- 不変Auction ID
- title: NFC正規化・前後空白除去後1〜120 Unicode code point、UTF-8で最大480 bytes。改行とcontrol文字を許可しない
- description: NFC正規化・CRLFをLFへ統一後1〜4,000 Unicode code point、UTF-8で最大16,000 bytes。LFとtab以外のcontrol文字を許可しない
- 外部参照URL: v0.2はAuctionごとにちょうど1件。UTF-8で最大2,048 bytes、`https`だけを許可し、userinfo、fragment、control文字を拒否する。scheme／IDNA変換後hostは小文字、default portは除去し、pathのdot segmentとpercent encodingを標準URL parserで正規化して保存する
- seller Markets user IDと公開identity snapshot
- Points issuer/resource
- `pointPackageId`と不変`pointPackageRevisionId`
- 新規作成／開始前編集時点で、Public Revisionの履歴`status=ACTIVE`かつPointsの現在`lifecycleStatus=ACTIVE`であるPackage。確定直前のM2M Point Package Auction eligibility receiptを必須とし、確定後にINACTIVEへ変わっても既存Auction snapshotは継続する
- package名、構成評価軸ID/名前、比率、各`minimumUnit`のsnapshot
- Point Package Auction eligibility receipt ID、Auction command ID／hash、Package eligibility version、検査時刻、有効期限、Markets D1 commit開始時刻のsnapshot
- 販売数量: 1〜1,000の安全整数
- Auction開始・終了時刻
- 最小package price tick
- 即決価格: 任意。ただしpackageを構成する全評価軸revisionが即決を許可する場合だけ設定できる
- 終了延長rule: 任意。threshold、extension duration、最大延長回数を開始前に固定する

文字数はUTF-16 code unitではなくNFC正規化後のUnicode code pointで数え、bytesは保存する正規化済みUTF-8で別に検査する。CSV、PATCH API、client previewは同じshared validatorを使い、emoji／結合文字／4-byte文字でも境界を変えない。URLの表示labelへraw HTMLを使用せず、遷移時も保存済みcanonical HTTPS URLだけを使う。

v0.2は画像を保存・表示しない。Auctionの商材詳細はtextと安全な外部URLで表現する。

## 固定公開ページ

`/`は`/index.html`の静的SPA shellからhydrateするtop routeで、top本体のSSGとは扱わない。`/terms`、`/privacy`、`/help`、`/docs`だけをbuild時に`terms.html`、`privacy.html`、`help.html`、`docs.html`へprerenderする。Auction、proof、履歴などの動的routeはSPAとする。

## 4. package price tick

Package revisionは正規化済みの正の整数`weight`と`totalWeight`を持つ。Points componentへ展開した時、`packageTick * weight / totalWeight`がすべての評価軸の`minimumUnit`倍数になる最小の正の安全整数を`packageTick`としてGCD／LCMで決定する。`1:2`等の比率を固定scaleへ近似しない。

Auctionのbid価格は`packageTick`の個数である安全整数`priceTicks`で表す。component amountは`priceTicks * quantity * packageTick * weight / totalWeight`で決定する。

- Auction revision確定時にtickを計算し、`auctionRevision`へsnapshotする。
- 計算途中と結果がJavaScript安全整数範囲を超えるpackageはAuctionに使用できない。
- bid、AutoBid上限、即決、clearing priceはpackage tickの整数倍だけを受け付ける。
- browserの浮動小数点でcomponent vectorを計算しない。

## 5. Auction lifecycle

### 状態

```text
DRAFT -> SCHEDULED -> OPEN -> CLOSING -> SETTLING -> SETTLED
DRAFT -> CANCELLED
SCHEDULED -> CANCELLED
```

`CANCELLED`は精算を開始しない終端状態である。失敗は`SETTLEMENT_RETRYABLE`または`SETTLEMENT_MANUAL_ACTION_REQUIRED`へ単調遷移し、過去状態へ戻さない。取消は上記3.2のguardを満たす`DRAFT/SCHEDULED`だけで許可する。

### 時刻

- server時刻を正とする。
- client時刻は表示にだけ使い、利用者local timezoneへ変換する。
- CSV確定はAuctionを`DRAFT -> SCHEDULED`へ進め、最新revisionの`startsAt`をAuctionRoomへ配送するoutboxを同じD1 transactionへ保存する。
- AuctionRoomは1件だけ持てるalarmを`SCHEDULED`なら`startsAt`、`OPEN`なら`endAt`へ設定する。`startsAt`到来時はcurrent revisionを再確認して`SCHEDULED -> OPEN`をD1 CASし、成功後に同revisionの`endAt`へalarmを置き換える。
- alarm遅延中の初回HTTP accessも同じdue-transition処理を実行する。alarmと同時accessが競合してもD1 CASの1件だけがtransition eventを作る。
- endAt以後のbid commandを拒否する。
- 終了間際に受理され、公開価格を更新したbidだけがimmutable extension ruleを満たす場合にendAt revisionを進める。閲覧、拒否bid、価格を変えない更新では延長しない。
- edit、延長、再deploy、eviction後はD1のcurrent revisionを再取得してalarmを再設定する。旧startsAt／endAt向けalarmはrevision不一致を検出してeconomic stateを変更せず、最新revisionの次の時刻だけを再予約する。

## 6. bid

### command

- bid mutationは認証済み`POST /api/auctions/{auctionId}/bids`だけで受け付ける。
- commandは`commandId`、`expectedAuctionVersion`、quantity、manual priceまたはAutoBid上限を持つ。
- `(auctionId, commandId)`を一意にし、retryは同じ結果を返す。
- WebSocketからbid commandを受け付けない。

### validation

- AuctionがOPENである。
- bidderがseller本人ではない。
- 有効な1対1 Points連携がある。
- quantityが1以上で販売数量以下の安全整数である。
- priceが0以上でpackage tickの倍数である。
- Auctionのcurrent revisionが参照するpackage revisionとbid対象が一致する。
- 現在の有効価格を引き下げず、受理済みbidを撤回しない。
- 入札時にはPoints残高照会、予約、減算をしない。

### ordering

- 高い有効単価を優先する。
- 同額はそのpriceへ最初に到達した`reachedSequence`が小さい順とする。
- serverがAuction内で`bidSeq`と`reachedSequence`を単調増加させる。client timestampで先着を決めない。
- 同一利用者の新しい有効bidは現在の到達価格・数量・AutoBid状態を更新するが、監査用bid eventは不変で残す。

## 7. AutoBid

- 利用者は非公開の最大package priceと希望数量を設定できる。
- 公開するのは現在到達価格、順位に必要なevent、quantityだけで、最大値を配信・logへ出さない。
- 新しい競合bidごとに必要最小tickだけを進め、上限を超えない。
- priceへ到達した瞬間に`reachedSequence`を確定する。
- AutoBid取消後は将来の自動増額だけを停止し、すでに到達した有効bidを巻き戻さない。
- 同時AutoBidはAuctionRoomで決定論的に処理し、同じcommand集合から同じevent列を生成する。

## 8. winnerとuniform clearing price

### allocation

1. 有効bidを単価降順、`reachedSequence`昇順で並べる。
2. 各bidderの希望quantityを順に割り当てる。
3. 残数量より希望quantityが多い最後のwinnerだけ部分割当する。
4. 残量が0になった後のunit demandをlosing demandとする。

### clearing price

- losing demandがない場合、uniform clearing priceは0 tickとする。
- highest losing unit priceとlowest winning unit priceが同じ場合、tieは先着順で解決済みなので、その同じpriceをclearing priceとする。
- lowest winning unit priceがhighest losing unit priceより高い場合、clearing priceは`highest losing unit price + 1 package tick`とする。ただしlowest winning priceを超えないことを検証する。
- すべてのwinnerが同じclearing priceを支払う。pay-as-bid、VCG、multi-priceは使わない。

このruleにより、需要が供給以下で0入札だけの場合は0のまま成立し、機械的に1 tickを課さない。

## 9. 即決

- Auctionのcurrent revisionに即決価格がある場合だけ利用できる。
- packageを構成する全評価軸revisionが即決を許可し、即決価格がpackage tickの倍数、0以上、安全整数でなければならない。
- 即決commandは通常bidと同じ認証・seller拒否・Points連携・冪等性を通る。
- 即決で要求したquantityは全量成功または全量失敗とし、残数量と同じAuctionRoom command内で直列化してoversellと部分即決を防ぐ。
- 即決対象も終了時精算と同じPoints reservation/capture契約を使い、browserから直接Pointsを操作しない。
- AuctionRoomは同じD1 transactionで要求全数量を`buyNowHold`へ移し、immutableな`BUY_NOW` settlement plan、settlement outbox、監査event、冪等responseを作る。hold中の数量は利用可能残数から除外し、HTTP responseは購入完了ではなく精算開始済みのpending状態を返す。
- commit後dispatcherが`BUY_NOW` Settlement Workflowを直ちに起動する。終了時精算と同じuser reservation、M2M status／capture／release、Markets forward finalize、proof作成を使い、別の直接debit経路を作らない。
- `buyNowHold`は`PENDING -> CAPTURED_PENDING_FINALIZE -> SETTLED`または`PENDING -> FAILED_RESTORED`の単調状態を持つ。restore evidenceは、外部作用開始前のD1 preflight、同じidempotency keyの決定的reservation作成拒否でID 0件、または存在する全reservationの未capture status＋ACTIVE分release receipt完備、という相互排他的な3種だけを許可する。内部`restoreBuyNowHold` CASはこのいずれかでhold全数量を`FAILED_RESTORED`へ一度だけ戻す。timeout、証拠欠落、status照合不能、capture結果不明の間は`SETTLEMENT_MANUAL_ACTION_REQUIRED`としてholdを維持し、restoreしない。
- 即時購入の失敗buyerをAuction終了時のblacklist／除外集合へ追加せず、別bidderへの再割当、clearing price再計算、quantity縮小を行わない。同じ`BUY_NOW` planは全数量captureまたは全数量restoreのどちらか一方へ収束する。
- capture成功後はholdを`CAPTURED_PENDING_FINALIZE`へ進め、数量をrestore、release、refundしない。Markets finalizeだけが失敗した場合はreconcilerがforward finalizeし、不変proofを1件へ収束させた後、proof migration適用後の内部`settleBuyNowHold` CASで`SETTLED`へ進める。同じholdへの同一outcome再送は同じreceipt、反対outcomeはprotocol failureとする。
- 利用可能残数は`総数量 - Σ(PENDING | CAPTURED_PENDING_FINALIZE | SETTLED hold.quantity)`とし、各buy-now holdを一度だけ控除する。hold作成時だけ減算、`FAILED_RESTORED`への遷移時だけ全数量を加算し、`PENDING -> CAPTURED_PENDING_FINALIZE -> SETTLED`では変化させない。別holdを無視してclose判定せず、projection値とこの式の再計算値が違えばcommandを停止する。endAt前は未終端holdがあって利用可能残数0でもAuctionを`OPEN`のまま保持して新しいbid／AutoBid／即決を残数guardで拒否する。全hold終端後、利用可能残数0ならAuctionを終了し、残数があれば`OPEN`を維持する。
- endAt到来時に未終端holdがあれば`OPEN -> CLOSING`とbid cutoff snapshotだけを原子的に確定し、`END_OF_AUCTION` plan／outbox作成を遅延する。以後再OPENせず、全holdが`SETTLED | FAILED_RESTORED`へ終端した同じ内部CAS transactionで、復元済み残数が0ならAuctionを終了し、残数があれば固定済みcutoffとその残数から終了時plan／outboxを一度だけ作る。複数holdのcapture／restore順が変わっても同じ数量とplanへ収束する。

## 10. 終了時の不足者除外

- close cutoff時点のbid集合を不変snapshotにする。
- provisional winner順にPoints vector reservationを試みる。
- 残高不足または負残高で必要vectorを予約できないbidderは、`auctionId + marketsUserId`で1回だけblacklist eventを記録する。
- network error、Points 5xx、timeout、OAuth一時障害はblacklist理由にしない。
- 不足者を除いた同じcutoff集合からwinner、allocation、clearing priceを最初から再計算する。
- 除外後の結果で必要額が変わった場合、古い予約をreleaseし、新plan hashのvectorを予約する。
- 一部評価軸だけの予約・captureを許可しない。

## 11. 履歴とwatchlist

- 公開Auction event、bid履歴、Marketsユーザー本人の出品・入札・落札履歴を提供する。
- watchlistへの追加・削除を提供するが、終了・価格変化の通知は送らない。
- AutoBid上限、OAuth token、非公開Points情報、内部failure detailは公開履歴へ出さない。

## 12. 落札証明と相互評価

> reviewの文字／URL境界はDEC-254で確定している。

- settle完了時に公開・永続的なproof IDとcanonical URLを作る。
- proofはAuction ID／Auction revision／Package revision、Auction revisionから固定した商材snapshot、seller/buyer identity snapshot、allocation quantity、uniform price、component vector、`SETTLED` completion status、settlement timestamp、plan hashを持つ。
- seller/buyerの外部identityはsettle時snapshotを表示し、後の名前変更で証明内容を改変しない。
- 通常proofは全員が閲覧できる。seller/buyer限定proofはv0.2で実装しない。
- immutable proof本体とmutable reviewを別resourceにする。`GET /api/v1/proofs/{proofId}`のcontent hash、ETag、`Cache-Control: public, max-age=31536000, immutable`はreviewを含めず、review作成・更新で変化させない。
- sellerとbuyerは相互に1〜5、任意comment、任意`completionProofUrl`を記録できる。commentはNFC／LF正規化後0〜2,000 Unicode code pointかつUTF-8最大8,000 bytes、LFとtab以外のcontrol文字を拒否する。`completionProofUrl`は0件または1件、最大2,048 UTF-8 bytesのcanonical HTTPS URLとし、userinfo／fragment／control文字を拒否する。空文字は`null`へ正規化する。本人の取引だけに方向ごと1件のcurrent reviewを持ち、更新はappend-only revisionを追加してcurrent pointerを進める。proof rowを更新しない。
- `GET /api/v1/proofs/{proofId}/reviews`は方向ごとのcurrent review、current revision ID、updatedAtを返し、review内容から生成したETagと`Cache-Control: public, max-age=60, stale-while-revalidate=300`を使う。`GET /api/v1/proofs/{proofId}/review-revisions?cursor=...`はrevision ID、方向、rating、comment、`completionProofUrl`、createdAtをcursor順で返し、collectionは同じ短期cacheとする。revision ID単体の不変responseを提供する場合だけ1年immutable cacheを使用する。
- review responseへMarkets内部user ID、email、Points情報、token、非公開failure detailを含めない。

## 13. Public read API

- Auction一覧と詳細
- 公開event・allocation・settlement状態
- immutable公開落札証明`GET /api/v1/proofs/{proofId}`、mutable current review`GET /api/v1/proofs/{proofId}/reviews`、append-only review履歴`GET /api/v1/proofs/{proofId}/review-revisions`
- Marketsユーザーの公開出品・落札履歴

外部からAuction作成、bid、購入、通知を行うpublic write APIはv0.2で提供しない。

## 14. 実装しないもの

- Task、Group、一般member、draft評価
- 画像、R2 upload、Q&A、chat、通知、PWA
- 入札中のポイント交換
- 一定期間預ける、消費なし、sellerへのポイント譲渡
- reverse auction、Pay-as-bid、VCG、COST、借入・返済
- 複数Points serviceを同じAuctionで選択・混在する機能
- 外部EC claim token、匿名配送、対面決済の確定実装
