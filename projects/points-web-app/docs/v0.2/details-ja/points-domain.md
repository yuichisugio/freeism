# Pointsドメイン仕様

## 1. 責務

Pointsは、評価結果を不変のFIXとして取り込み、評価軸別の残高・履歴・予約を管理する。商材、Auction、Task、Group、一般community memberは管理しない。

### 所有する主なaggregate

- `pointsUser`、`profile`、`socialAccount`、`externalIdentity`
- `adminMembership`
- `evaluationCriterion`、`evaluationCriterionRevision`
- `pointPackage`、`pointPackageRevision`、`pointPackageComponent`
- `fixResult`、`fixRevision`、`fixRevisionEntry`
- `pointLedgerEntry`、利用者・評価軸ごとの`pointAccount`
- `unclaimedFixEntry`、`identityOwnership`、`ownershipEpoch`、`fixClaim`
- `pointReservation`、`pointReservationComponent`
- `pointsMarketsConnection`、OAuth client/token metadata
- append-only `auditEvent`

経済履歴は退会時にも削除しない。プロフィールを`CLOSED`かつ匿名化し、台帳、FIX、予約、永久OAuth主体対応、監査eventは保持する。

## 2. ユーザーとプロフィール

### 2.1 IDと公開URL

- PointsユーザーIDは不変のURL-safe文字列とする。表示名を変更してもIDとプロフィールURLは変わらない。
- canonical URLは`https://points.freeism.app/profiles/{pointsUserId}`とし、`/dashboard`を含めない。
- publicプロフィールは未ログインでも閲覧できる。
- プロフィール自体を非公開にした場合は検索結果へ出さず、直接URLでも存在を開示しない。

### 2.2 表示項目

- ユーザーID
- 表示名: 1〜100文字
- 説明: 0〜500文字
- Google/GitHub Social Accountの表示名、provider内ID、プロフィールURL、検証状態、連携日時
- 所有権確認済みの汎用Web URL、検証方式、検証日時、次回検証期限
- 公式パッケージ一覧。0件を許可し、複数件を登録・並べ替えできる
- 公開設定をONにした評価軸の`balance`と`evaluationTotal`
- 公開設定をONにしたFIX・譲渡・交換履歴

メールは公開プロフィールへ出さず、本人識別にも使わない。

### 2.3 検索

- 公開プロフィール、評価軸、パッケージを、名前と不変IDで検索できる。
- 非公開またはclosedプロフィールを結果へ含めない。
- D1/SQLiteで実現できる検索だけを使い、PGroongaやSupabase extensionへ依存しない。
- headerの共通検索欄から検索結果へ遷移できる。

### 2.4 公開設定

- プロフィール自体は初期値`PUBLIC`とする。
- 各評価軸の`balance`、`evaluationTotal`、FIX履歴、譲渡履歴、交換履歴は5つの独立した`PUBLIC | PRIVATE`を設定する。残高だけを評価軸revisionの公開初期値から作り、`evaluationTotal`と履歴系の初期値は`PRIVATE`とする。
- 交換履歴はsource・target両軸が公開を許可した時だけ表示する。片方の軸ID、額、比率の部分表示で非公開軸を推測させない。
- profile全体または軸別flagの`PRIVATE -> PUBLIC`を1つでも含むrequestはGoogle freshを必須とし、公開範囲の縮小だけなら通常sessionで許可する。
- 自分のプロフィールだけに編集導線を表示する。権限判定はserverでも行う。

## 3. ADMIN

- roleはグローバルな`ADMIN`だけで、全ADMINは同格である。
- ADMINはすべての評価軸、パッケージ、FIX CSV、reconciliation、settlement手動再試行を管理できる。
- 評価軸owner、評価軸別ADMIN、パッケージowner、super admin、一般member、impersonation、任意残高設定APIを作らない。
- ADMIN総数の上限は50人とする。最後の1人を削除できない。
- ADMIN変更は15分以内のGoogle fresh sessionとappend-only auditを必須とする。

## 4. 評価軸

### 4.1 基本属性

- 不変ID: Nano ID相当のURL-safe文字列
- 名前: 必須、1〜30文字
- 説明: 必須、1〜200文字。URLは安全にlink化できる
- 関連URL: 最大20件
- `minimumUnit`: `0.0001`以上。最大4桁の小数
- 譲渡可否、交換可否、残高公開初期値
- 即決価格利用可否
- revision番号、作成日時、更新日時

評価軸の経済計算へ影響する属性を更新するたびに不変`evaluationCriterionRevision`を作る。過去のFIX、交換、予約、Auction snapshotは当時のrevisionを参照する。

### 4.2 登録・更新

- ADMINだけがCSVで登録・更新できる。一般利用者向けGUI入力フォームは作らない。
- 1回のCSVは最大20評価軸とする。関連URLの複数行は同じ論理評価軸として数える。
- server validation後、確定直前のpreviewを表示し、利用者が確認してから原子的に確定する。
- 同じ名前の重複、URL上限超過、無効な`minimumUnit`、既存revisionの上書きを拒否する。

### 4.3 交換比率revision

- 交換比率は交換元から交換先への有向pairごとに管理し、逆方向へ暗黙適用しない。
- 同格ADMINだけが15分以内のGoogle fresh sessionでCSV登録できる。GUI入力form、評価軸owner専用権限、一般利用者による比率登録を作らない。
- CSVは共通仕様どおりUTF-8、最大5MiB、最大1,000非空行、server validation、preview、confirm、全件原子確定とする。
- 列は`sourceEvaluationCriterionId`、`targetEvaluationCriterionId`、`expectedRevision`、`status`、`numerator`、`denominator`とする。
- `status=ACTIVE`では`numerator`と`denominator`を正のJavaScript安全整数として必須にし、最大公約数で正規化する。sourceとtargetが同じ行、0、負数、指数表記、範囲超過を拒否する。
- `status=DISABLED`では比率を空にし、新規交換だけを停止する。比率0を無効化の代用にしない。
- 初回は`expectedRevision`を空、更新・無効化は現在revision番号を必須とし、競合は`409`にする。
- 作成、変更、無効化は既存rowを更新せず、不変`exchangeRateRevision`を追加する。過去の交換・代用結果は参照したrevisionを保持する。
- 出力額は正の入力に対してtargetの`minimumUnit`倍数へ常に切り下げ、理論値との差を整数の余りとして台帳へ保存する。丸め後が0なら交換を拒否する。

## 5. 公式パッケージ

- 1つ以上の評価軸componentと正の安全整数`weight`から構成する。
- 作成・更新CSVは1回最大20 Packageとし、componentの複数行は同じ論理Packageとして数える。
- component weight全体を最大公約数で割って正規化し、`totalWeight = SUM(weight)`を安全整数として保存する。各componentの厳密な比率は`weight / totalWeight`であり、固定scaleへ近似しない。
- 同一評価軸を同じrevisionへ重複登録しない。
- economic fieldの変更は不変`pointPackageRevision`を追加し、既存revisionを更新しない。
- プロフィールへ0件以上の公式パッケージを登録できる。profileは重複のない`pointPackageId`と連続した`displayOrder`だけを持ち、複数登録・登録解除・並べ替えを同じD1原子処理で行う。関係の削除はPackage本体やrevisionを削除しない。
- Packageのname、description、URL、正規化名の一意性、Public content hashの対象と新revision条件は[評価軸とパッケージの管理](evaluation-criteria-management.md)を正本とする。
- Markets Auctionは必ず不変`pointPackageRevisionId`とPublic `contentHash`をsnapshotし、確定直前にPointsのM2M Point Package Auction eligibility receiptを取得する。不変revisionの履歴`status`だけを現在のAuction利用可否として扱わない。

## 6. 金額表現

- 保存scaleは`10_000`である。APIの金額は小数文字列とscale済み安全整数文字列を明確に分け、曖昧なJSON numberを契約へ出さない。
- D1には`INTEGER`だけを保存し、残高、価格、比率、FIXへ`REAL`を使わない。
- 全amountは対象評価軸のscale済み`minimumUnit`の倍数でなければならない。
- JavaScriptへ渡す値は`Number.isSafeInteger`を満たすことを各境界で確認する。
- parse・乗除算では一時的な`BigInt`をoverflow検出に使ってよいが、D1 bind前とAPI返却前に安全整数範囲を検証する。最終値または保存対象が範囲を超えたら処理全体を拒否する。

## 7. FIX revisionと差分台帳

### 7.1 入力

FIX CSVの1行は最低限次を持つ。

- `recipientProfileUrl`。入力は外部プロフィールURLだけとし、provider ID、account ID、内部Points user IDを入力列にしない
- 評価軸ID
- 符号付き評価額
- 評価期間: UTCの年月は必須、日・時刻は任意
- 評価軸内管理ID: 任意
- memo: 任意、200文字以下
- 既存`fixResultId`: 修正時だけ指定

URLは1行1件とし、1セル内のカンマ区切り複数URLは使わない。

`recipientProfileUrl`が正規化後に`https://github.com/{login}`という1階層のGitHub利用者プロフィールURLへ分類される場合、validationと最終commitの両方でGitHub REST `GET /users/{username}`を再実行する。OAuth Appのapplication authenticationはWorkers SecretのClient ID／SecretによるBasic認証と固定GitHub API version headerをWorker内だけで構成し、browser、CSV、URL query、logへ出さない。

- responseの`type`が利用者、`html_url`の正規化値が入力URLと完全一致し、数値`id`が有効であることを要求する。
- 入力には数値IDを書かせず、FIX revisionへ`recipientProviderId=github`、10進文字列の`recipientAccountId`、正規化URL、`identityResolvedAt=最終commit時刻`を不変snapshotする。過去の`evaluationAt`時点のusername所有者を復元したとは扱わず、`evaluationAt`はFIXの評価期間とWeb ownership epoch割当だけに使う。
- validation request内では同じ正規化URLを1回だけ解決するが、server draftやcross-request correctness cacheを作らない。commitは常に再解決し、previewのvalidation hashと数値IDが変わった場合は全件を`409 VALIDATION_CHANGED`で止める。
- 404、429、rate limit枯渇、timeout、5xx、schema不正は当該行だけをURL文字列へfallbackせず、ファイル全体を`GITHUB_IDENTITY_LOOKUP_UNAVAILABLE`または入力errorで0件反映にする。GitHubの`Retry-After`／rate resetは安全な範囲でcallerへ伝える。
- distinct URL数をapp-global D1 rate budgetへ先に予約し、GitHub responseのrate-limit headerで補正する。必要数を確保できない場合は外部call前に全件を429とする。lookupは最大6接続、1件3秒、全体120秒のpoolで行い、deadline／Abort時はdomain writeを0件にする。1,000 distinct GitHub URLも許可範囲であり、重複URLだけのtestで代替しない。
- username変更後の新URLは新しいlookupで同じ数値IDへ、旧usernameが別Accountに再利用された後の新FIXは新しい数値IDへ向く。claim時はBetter AuthのGitHub `accountId`とrevision snapshotの数値IDを比較し、username、メール、現在URLだけで判定しない。

GitHub以外のURLはprovider/account snapshotを持たず、Web所有権epochで受領者を決定する。

### 7.2 不変性

- 初回取込で安定した`fixResultId`を発行する。
- 修正は同じ`fixResultId`へ新しい`fixRevision`を追加する。既存revisionをUPDATE/DELETEしない。
- revisionの同一性は内容hash、source file hash、ADMIN、評価軸、request idで監査できる。
- 新旧revisionの差を対象者・評価軸ごとに計算し、差分0は台帳を増やさない。
- 同じrevisionを再送しても`sourceFixRevisionId`一意制約により二重反映しない。
- 対象者が未登録なら`unclaimedFixEntry`へ、登録済みなら台帳へ反映する。

### 7.3 原子性

1ファイルのvalidationがすべて成功した後、次を1つのD1原子処理で確定する。

1. FIX result/revision/entry
2. 旧revisionとの差分
3. ledger entryまたはunclaimed entry
4. ledger INSERT triggerによる`point_accounts.balance`／`evaluation_total` projection
5. idempotency result
6. audit event

部分成功・行単位retry・server draftを許可しない。

## 8. 台帳、残高、evaluationTotal

- append-only ledgerを経済データのSource of Truthとする。
- `point_ledger_entries`をappend-onlyの経済データSource of Truth、`point_accounts`を利用者・評価軸ごとの`balance`／`evaluation_total` projectionとする。
- `point_accounts`の経済列は同じtransaction内の`point_ledger_entries AFTER INSERT` triggerだけが更新する。client、別Worker、application repositoryからprojectionを直接INSERT／UPDATEするAPIを作らない。
- `balance = SUM(ledger.deltaAmount)`を満たす。
- `evaluationTotal = SUM(FIX起因ledger.deltaAmount)`を満たす。
- 負のFIX、差し戻し、過去revisionとの差分により、`balance`と`evaluationTotal`は負になってよい。
- 負残高を0へ丸めない。履歴を削除して帳尻を合わせない。

定期reconciliationは上記式、reservation合計、claimed/unclaimed合計を再計算し、不一致を監査eventとして記録する。自動で不変台帳を書き換えない。

消費系commandは、canonical payload hashを持つ`point_mutation_commands`をD1 `batch()`の先頭で`PENDING` INSERTし、chunkを登録してから`VALIDATED`へ進める。`PENDING -> VALIDATED`のtriggerが対象行の存在、version、available balance、reservation status／所有client／期限／hashとexpected target countを検査し、domain／event／ledger write後の`VALIDATED -> COMMITTED` triggerがactual event／ledger countを検査する。違反時は安定したcodeで`RAISE(ABORT, ...)`し、0行の条件付きUPDATEを成功とみなさず、command、domain write、ledger、idempotency result、成功auditを同じbatchで全rollbackする。

ledger INSERT前triggerは、現在のaccountとdeltaを加算した`balance`／`evaluationTotal`が±`9_007_199_254_740_991`内であることを行ごとに検査し、超過時は`SAFE_INTEGER_OVERFLOW`でabortする。同じbatch内の複数entryも各trigger時点の更新済みprojectionを使い、SQLiteのREAL昇格を許さない。guard拒否の監査はrollback後の別append-only rejection auditへstable codeだけを記録し、監査write失敗を理由に経済commandを再実行しない。

## 9. 消費・譲渡・交換

### 9.1 共通

- すべてCSV-only、server validation後preview、利用者確認後に原子的に確定する。
- 実行者、対象評価軸、額、宛先、rate/revision、idempotency keyをledgerに残す。
- `availableBalance = balance - activeReservationAmount`が必要額未満なら拒否する。
- 現在残高が負または0の場合、さらに残高を消費する譲渡・交換・予約は拒否する。
- FIXによる追加の負評価は残高不足に関係なく受け付ける。
- available balance検査は譲渡・交換・予約で行い、capture時にも全winnerの現在残高が各予約済みdebitを満たすことを再検査する。予約後の負FIXで1件でも不足した場合は全captureを0件へrollbackし、Marketsが同じcutoffから不足者を除外してroundを再計算する。残高不足のcaptureを強行して負残高を作らない。

### 9.2 譲渡

- 評価軸が譲渡可の場合だけ実行できる。
- CSVは評価軸ID、譲渡額、譲渡先PointsユーザーIDを持つ。
- 送信者の負deltaと受信者の正deltaを同一D1原子処理で記録する。
- `evaluationTotal`は両者とも変更しない。

### 9.3 交換

- 交換元・交換先の両評価軸が交換可で、有効な不変交換比率revisionがある場合だけ実行できる。比率は整数`numerator / denominator`で保持し、`REAL`へ変換しない。
- CSVは交換元評価軸ID、交換元額、交換先評価軸ID、交換先額を持つ。元額・先額の少なくとも一方を必須とし、片方から固定小数点で他方を計算する。
- rate、rounding、minimumUnitの結果が一意にならない入力は拒否する。出力側`minimumUnit`へ切り下げ、参照rate revision、rounding rule、整数の余りを台帳へ記録する。
- burnとmintを同一原子処理にし、`evaluationTotal`は変更しない。

### 9.4 貢献評価代用

> 本節の計算式、UTC月別revision、非再帰source、0方向切捨て、訂正差分方式はDEC-259で確定している。

- 代用methodは有向`sourceEvaluationCriterionId -> targetEvaluationCriterionId`ごとの不変`substitutionMethodRevision`とする。method CSV列は`sourceEvaluationCriterionId`、`targetEvaluationCriterionId`、`expectedRevision`、`status`、`similarityNumerator`、`similarityDenominator`、`exchangeRateRevisionId`とする。
- `ACTIVE`の類似度は`0 < similarityNumerator <= similarityDenominator`の正の安全整数とし、最大公約数で正規化する。`exchangeRateRevisionId`は同じ有向pairのACTIVEな正の整数`numerator / denominator`を指す。`DISABLED`は類似度とrateを持たず新規実行を停止する。0、負数、逆方向の暗黙利用、`REAL`への変換を禁止する。
- 実行CSV列は`sourceEvaluationCriterionId`、`targetEvaluationCriterionId`、`evaluationMonth`、`methodRevisionId`、`expectedResultRevision`とする。`evaluationMonth`はASCII `YYYY-MM`で、UTCの月初00:00:00以上・次月月初00:00:00未満の評価時刻を対象にする。ADMIN + Google fresh + reason + `Idempotency-Key`を必須とする。
- resultのbusiness keyは`sourceEvaluationCriterionId + targetEvaluationCriterionId + evaluationMonth`であり、method revisionを変えて二重付与する別keyを作らない。初回は`expectedResultRevision`を空、再計算は直前result revisionを必須とし、競合を`409 REVISION_CONFLICT`にする。
- 各Pointsユーザーの`sourceTotalScaled`は対象UTC月の正規FIXとその訂正差分のみを集計する。`SUBSTITUTION_FIX`、自動分配、譲渡、交換、予約・captureをsourceに使わない。この非再帰規則により有向pair間のcycleがあっても代用結果を再入力できない。
- 各利用者の理論値は`sourceTotalScaled * similarityNumerator * exchangeNumerator / (similarityDenominator * exchangeDenominator)`とし、中間計算はBigIntだけを使う。targetの`minimumUnitScaled`倍数へ絶対値を切り下げて符号を戻す、すなわち0方向の切捨てとする。負sourceは負の代用結果、0または`minimumUnit`未満は0結果とし、範囲超過は全体を拒否する。
- 対象userは対象月のsource正規FIXを持つ`pointsUserId`と直前resultに存在した`pointsUserId`の和集合とする。close状態でも経済履歴の訂正先は同じuserのままとする。新resultの利用者別理論値、丸め値、source FIX revision集合hash、method／rate／source／target criterion revision、月境界、実行cutoffを不変snapshotする。
- 再計算は旧resultを更新せず新revisionを追加し、利用者ごとの`newRoundedAmount - previousRoundedAmount`だけを`SUBSTITUTION_FIX`の`affectsEvaluationTotal=true`な差分ledgerへ追加する。新結果0・旧結果非0の利用者には全額取消差分を作り、二重付与や対象落ちを防ぐ。

### 9.5 自動分配

> 本節の保持額、score、最大剰余、1,000件上限、訂正snapshot方式はDEC-260で確定している。

- プロフィールへ公式パッケージを1件以上登録した場合だけ有効化できる。
- 初期値はOFF。ON時はUIに「自動分配を設定中」と表示する。
- 設定は`POST /api/settings/auto-distribution/csv/validate`と`POST /api/settings/auto-distribution/csv/commit`を使うCSV-only操作とする。commitは本人の通常Sessionに加えて15分以内のGoogle freshと`Idempotency-Key`を要求し、server再検証後に不変setting revisionを原子的に追加する。validationだけでは設定を保存しない。
- 分配前に本人へ残す額は`PERCENT | FIXED`のどちらか1つとする。`PERCENT`のCSV入力はASCII十進の`retentionPercent`で、0.001%〜100%を小数3桁以下で受け、`retentionRatePpm = retentionPercent * 10_000`の整10〜1,000,000としてD1に保存する。`FIXED`はASCII十進の`retentionAmount`を0以上・scale `10_000`の安全整数で保存し、反対側のfieldを空にする。`REAL`を使わない。
- 正のsource FIX amountを`A`、その評価軸の`minimumUnitScaled`を`M`とする。`PERCENT`は`floor((A * retentionRatePpm / 1_000_000) / M) * M`、`FIXED`は`floor(min(A, retentionAmountScaled) / M) * M`を本人保持額`R`とし、`D = A - R`を分配額とする。乗除算はBigIntで行い、`R`と`D`は`M`の倍数にする。
- 正のFIXだけを分配対象にする。負または0のFIXは元の本人へそのまま反映し、分配snapshotを作らない。本人のFIX ledgerは常に全額`A`を`affectsEvaluationTotal=true`で記録し、分配時だけ本人から`-D`、受取人へ合計`+D`の`affectsEvaluationTotal=false`台帳を追加する。これにより本人の`evaluationTotal`は評価額全体、本人の`balance`は`R`だけ増え、受取人の`evaluationTotal`は変更しない。
- weight cutoffはsource FIX revisionの評価期間のUTC終端を含まない`weightCutoffExclusive`とする。月だけの入力なら次月月初00:00:00Z、日／時刻がある場合はその正規化期間終端を使う。
- candidateはsnapshot時にACTIVEなPointsユーザーのうちsource FIX本人を除いた利用者とする。Package revisionのcomponent `c`とcandidate `u`ごとに、cutoff前の差分ledgerから`positiveEvaluationTotal(u,c) = max(evaluationTotalScaled(u,c), 0)`を再構成する。`score(u) = SUM(positiveEvaluationTotal(u,c) * componentWeight(c))`とし、複数軸の評価を加算する。`totalWeight`による共通の除算は相対scoreで打ち消し合うため行わない。中間値はBigInt、保存scoreはJavaScript安全整数範囲を必須とする。
- `score(u) > 0`の対象者だけを分配集合に入れる。対象者が0件または全score合計が0なら、分配debit／creditを作らず正のFIX全額を本人の`balance`へ残し、snapshotに`NO_ELIGIBLE_WEIGHT`を記録する。
- 固定小数点の最大剰余方式で配分し、余りのtieはPointsユーザーID昇順で決定する。
- 分配は`unitCount = D / M`を整数unitとし、各対象者へ`floor(unitCount * score(u) / totalScore)`unitを配る。残りunitは除算の余りが大きい順、同値はPointsユーザーID昇順で1unitずつ与える。0unit行はledgerを作らない。`minimumUnit`未満の額を作らず、対象者がいる時は余りを本人やsystemへ残さず常に合計`D`を配り切る。
- 1 source FIXの対象者上限は1,000件、1つのFIX commit command内の分配credit合計上限も1,000行とする。いずれかを超えるpreview／commitは`AUTO_DISTRIBUTION_TARGET_LIMIT_EXCEEDED`で全FIX commandを0件へrollbackし、部分分配や上位1,000件の暗黙抽出をしない。
- 対象Package revision、残額rule revision、source FIX revision／評価期間・`A/R/D/M`、cutoff、component軸revision／weight、candidate状態、利用者ごとのcomponent evaluation total／score／商／余り／配分unit、tie-break順を不変snapshotする。
- 同じsource FIX revisionを二重分配しない。最初の正のrevisionでsnapshotを作り、後の訂正は設定、対象者、score、tie-breakを再取得せず同じsnapshotで新配分額を再計算し、旧配分との利用者別差分だけをledgerへ追加する。正から0／負への訂正は元の分配を同じsnapshotで全取消し、受取人残高が負になってもFIX訂正として反映する。初回の正のrevisionが後の訂正で現れた場合はその時点で初めてsnapshotを作る。

## 10. Points予約

- reservationは評価軸vector全体を1つのaggregateとして扱う。
- `pointPackageRevisionId`、`priceTicks`、`quantity`からPoints自身がcomponent amountを再計算する。
- 全componentのavailable balanceを同一D1原子処理で検査し、1つでも不足すれば何も予約しない。
- 不変header／component、append-only `point_reservation_events`、現在値projection `point_reservation_states`を分ける。`CREATED`／`CAPTURED`／`RELEASED`／`EXPIRED` eventの`BEFORE INSERT` triggerが旧state、expected version、期限、Client ID、plan／vector hashを検査し、`AFTER INSERT` triggerだけがstate projectionを更新する。
- leaseは15分。現在状態は`ACTIVE`、`CAPTURED`、`RELEASED`、`EXPIRED`の単調遷移だけを許可し、条件付きUPDATE 0行へ依存しない。
- capture後はrelease/refundしない。capture/release/expiryは`evaluationTotal`を変更しない。
- Markets由来の同一reservation key、plan hash、winnerに対する再送は同じ結果を返す。
- 利用者Tokenで予約を作る時はACTIVEなPoints–Markets connectionに保存した利用者用Client IDから対応M2M用Client IDを解決し、既存のreservation `marketsClientId`所有列へ保存する。後続status／capture／releaseはこのM2M `client_id`との一致を必須とし、Task 13のschema名は変更しない。
- capture時は全winnerのACTIVE、未期限、所有Client、plan／vector hashと現在残高をcommand guardで再検査してからCAPTURED eventとledger debitを同じbatchへ入れ、1件でも不正／不足ならevent／state／ledger／account projection／receiptを0件へrollbackする。
- Marketsのclearing priceが0 tickなら、Pointsが再計算した全component amountが0のvector reservationも有効とする。不変header／0 component vectorとACTIVE stateを作り、captureは`ACTIVE -> CAPTURED`のeventと不変receiptを作るがledgerは0件、`balance`／`evaluationTotal`は不変とする。command postconditionは`expectedLedgerCount=0`と`actualLedgerCount=0`の一致を成功とし、0を欠落または未処理と扱わない。

## 11. Public read API

- 公開プロフィール、公開設定された残高と`evaluationTotal`
- 評価軸・パッケージ・revisionの公開情報
- Shields.io等で使える短い残高表示
- Marketsの公開落札証明へのcanonical link

v0.2では、第三者が任意ユーザーのポイントを直接増減する公開write API、外部出品・入札・購入APIを提供しない。Markets精算だけが承認済みOAuth scopeとService Bindingを通じて予約・capture/releaseできる。

## 12. UIと共通要件

- 日本語と英語を用意し、browser言語が日本語なら日本語、それ以外は英語を既定にする。
- 一括設定はCSVへ寄せるが、ファイル選択ボタン、preview、確認dialog、toast、必要最小限のfilterは置いてよい。
- drag-and-drop前提、全画面animation、過度なwizardは作らない。
- `/terms`、`/privacy`、`/help`、`/docs`を固定公開ページとしてbuild時にSSGし、認証・外部URL・公開プロフィール・経済履歴の保持方針を明記する。`/`は`/index.html`の静的SPA shellからhydrateするtop routeで、top本体のSSGとは扱わない。
