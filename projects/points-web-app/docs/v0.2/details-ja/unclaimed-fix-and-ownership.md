# 未受領FIXと外部identity所有権

## 1. 目的

Pointsに未登録の貢献者にも先にFIX結果を記録し、後から本人が登録・所有権確認した時にポイントを受け取れるようにする。これはv0.2の利用者獲得戦略の中核である。

「先に付与する」とは、未登録者用の仮ユーザー残高を作ることではない。FIX revisionへ入力された`recipientProfileUrl`、解決できたprovider主体snapshot、符号付き評価額を保存し、所有権確認後に初めてPointsユーザーの台帳・残高・`evaluationTotal`へ反映することを意味する。CSV入力はURLだけで、raw provider/account IDを受け付けない。

## 2. 対象

v0.2で所有権確認対象にするidentityは次の2種類である。

1. GitHub OAuth主体
2. HTTPSの汎用WebプロフィールURL

GitHub以外のSocial Provider、ORCID、Apple、X等はv0.2の所有権確認対象にしない。GoogleはPointsの認証とfresh step-upに使うが、未受領FIXの外部宛先には使わない。

## 3. データ分離

### `identityOwnership`

- `identityType`: `GITHUB_OAUTH`または`WEB_URL`
- `normalizedIdentityKey`
- 最初に対応した`pointsUserId`
- `status`: `ACTIVE`、`REVERIFYING`、`INACTIVE`、`LAPSED`
- `verifiedAt`、`nextVerificationAt`
- GitHubの永久対応flag
- 現在の`ownershipEpochId`

Web URLは`ACTIVE -> REVERIFYING -> ACTIVE|LAPSED`、GitHub ownership利用は`ACTIVE <-> INACTIVE`だけを使う。status用途を混同しない。

### `ownershipEpoch`

- `identityOwnershipId`
- `ownerPointsUserId`
- `effectiveAt`
- `endedAt`
- verification method、証拠hash、成功回数、request id

### `unclaimedFixEntry`

- `fixRevisionEntryId`
- `normalizedIdentityKey`
- 評価時刻
- 符号付きscale済みamount
- claim状態と`claimedByPointsUserId`

### `fixClaim`

- 所有権epoch、claim対象集合hash、正負合計、台帳batch ID
- `claimedAt`、request id、idempotency key

所有権、ownership epoch、未受領FIX、claimを同じ行へ押し込まない。

## 4. URL正規化

upload、プロフィール登録、外部ページから得たURLは同じ純粋関数で正規化する。

- schemeとhostを小文字化する。
- 国際化domainはASCII/Punycode表現へ統一する。
- default portを除去し、HTTPS以外は拒否する。
- fragmentを除去する。
- 空pathは`/`へ統一する。
- service固有の明示ruleがないqueryは保持し、tracking parameterを勝手に消さない。
- pathの意味が変わる末尾slash、`/about`、subdomainを同一視しない。
- percent encodingは同じoctetを表す安全な範囲だけ正規化する。
- credential付きURL、IP literal、localhost、private/reserved addressは拒否する。

正規化後の完全一致だけを承認し、部分一致、prefix一致、表示文字列一致、メール、ユーザー名だけの一致を使わない。

## 5. 所有権確認方式

### 5.1 GitHub OAuth/API

- Better AuthのGitHub Social Accountを使い、GitHubのstable account IDを`accountId`として確認する。
- scopeはGitHub OAuth Appの既定最小scopeを使う。email scopeを本人識別に使わない。
- GitHub OAuth tokenはD1へアプリ層暗号化して保存し、browser、session、logへ出さない。
- GitHub Social Providerはログインにも明示linkにも使える。所有権確認専用のsign-in拒否hookは作らない。
- ただし、GitHubでログインしただけでは`INACTIVE`な所有権利用を自動で`ACTIVE`へ戻さない。

### 5.2 編集可能Webページ

利用者が事前登録した外部URLをserverが取得し、次を満たすlinkだけを証拠にする。

- HTMLの許可された`a[href]`、`link[href]`、またはHTTP `Link` headerにPointsプロフィールURLがある。
- hrefを正規化した結果が、検証対象ユーザーのcanonical PointsプロフィールURLと完全一致する。
- `rel=me`が1件以上あるページでは、`rel` tokenに`me`を持つlinkだけを候補にする。
- `rel=me`がない編集可能ページでは、許可されたlink要素のhref完全一致を候補にできる。
- 本文text、code block、comment、JSON文字列、画像alt、JavaScriptが生成したDOM、iframe内は証拠にしない。
- 一時nonce、検証token、DNS TXT、`.well-known`設置を必須にしない。

利用者が検証を実行した時点で条件を満たせば自動承認する。人による手動審査、承認model、例外overrideは実装しない。

### 5.3 SSRF防御

- HTTPS、port 443だけを許可する。
- userinfo、IP literal、localhost、private、link-local、loopback、reserved、Cloud metadata addressを拒否する。
- Workersが実接続先IPを公開しないため、接続直前addressのアプリ独自検査は要件にしない。IP literal、localhost、private／reserved hostnameを入力時に拒否し、`global_fetch_strictly_public`とCloudflareのpublic Internet egress制約でDNS rebinding時の内部network到達を防ぐ。
- redirectは最大3回をserverが手動追跡し、各遷移先を同じruleで再検査する。
- 各hopは`cache: no-store`相当でCloudflare cacheをbypassし、staleなCDN responseや`Age`を所有権根拠にしない。
- timeoutは全体5秒、responseは最大1MiB、`text/html`または`text/plain`だけを受け付ける。
- Cookie、Authorization、client IP header、内部headerを転送しない。
- JavaScriptを実行せず、subresourceを取得しない。
- fetch結果・失敗理由・最終URL・content hashを秘密を含めず監査する。

`cf.resolveOverride`やTCP socketでHTTP/443を独自実装しない。redirectは`manual`、最大3回とし、各Locationを正規化してscheme、port、userinfo、hostname、IP literalをfetch前に再検証する。

## 6. GitHub主体の永久対応

### 6.1 URLから不変主体への解決

- FIX CSVの`recipientProfileUrl`が`https://github.com/{login}`という1階層の利用者プロフィールURLなら、validation時とcommit時にGitHub REST `GET /users/{username}`をOAuth Appのapplication authenticationで呼ぶ。
- responseの利用者type、数値`id`、`html_url`完全一致を検証し、`providerId=github`、10進文字列`accountId`、`identityResolvedAt=最終commit時刻`をFIX revisionへ不変snapshotする。過去の`evaluationAt`時点のusername所有者を復元したとは扱わない。
- validationとcommitの間に数値IDが変わった場合はvalidation hash不一致として全件を止め、再previewを要求する。404、429、timeout、5xxでURLだけの曖昧なentryへfallbackしない。
- username renameは同じ数値IDとして認識し、旧usernameが別Accountへ再利用された後の新FIXは新しい数値IDへ向ける。claimはBetter Authの`providerId + accountId`とsnapshotを比較し、username、メール、表示URLを本人識別に使わない。
- GitHub API credential、response本文、メールを保存・log出力しない。保存するのは入力／正規化URL、数値ID、観測時刻、必要な監査hashだけとする。
- API requestはWorker内のOAuth App Basic認証と固定API version headerを使い、request内で同じURLをdedupeする。app-global D1 rate budgetで必要distinct件数を先に確保し、最大6接続、1件3秒、全体120秒を超えた場合はファイル全体を0件にする。1,000 distinct GitHub URLを入力上限内として扱う。

### 6.2 永久対応

- GitHub `(providerId=github, accountId)`は、最初に対応したPointsユーザーへ永久固定する。
- 同じGitHub主体を別Pointsユーザーへlink、claim、merge、移動できない。
- メールが同じでも別主体を同一扱いしない。
- GitHub所有権利用の無効化時は、provider側tokenをrevokeし、保存tokenを削除し、`identityOwnership.status=INACTIVE`にする。
- 永久対応を守るためBetter AuthのGitHub Account行は物理unlinkせず、`providerId + accountId + userId`対応を保持する。
- GitHubログインで新しい暗号化tokenが保存されても、所有権利用は明示再有効化まで`INACTIVE`のままとする。
- 再有効化は、同じPointsユーザーの15分以内Google fresh session、GitHub OAuth成功、永久対応一致をすべて要求する。
- 再有効化後、無効期間中に蓄積した正負すべての未受領FIXを最新previewへ含め、同じGoogle fresh sessionのhash付きconfirmで選択不可の一括claimを行う。OAuth callbackだけではledgerへ反映しない。

GoogleとGitHubで別々に新規Pointsユーザーを作った後の自動mergeはしない。1ユーザーへまとめたい利用者は、第二Providerで別ユーザーを作る前に設定画面から明示linkする。

## 7. Web URLの所有期間

汎用Web URLは移転し得るため永久固定しない。

### 7.1 初回と定期再検証

- 初回検証成功時にownership epochを開始する。
- ACTIVEなURLは30日ごとに再検証する。
- 定期再検証に失敗した場合、最初の失敗から7日間に最大3回まで再試行できる。
- 期間内に成功すれば同じepochを継続する。
- 3回失敗または7日経過で`LAPSED`にし、以後のFIXを未受領で保留する。

定期再検証は利用者操作だけに依存させない。Points Workerの環境別Cronを15分ごとに起動し、`nextVerificationAt`到来順で最大50件をD1 leaseする。同一job keyは`ownershipEpochId + verificationCycleId + attempt`で一意にし、同じcycleの同時Cron／再deployだけを一回へ収束させる。成功時は次回時刻と新しいcycle IDを発行する。初回失敗をattempt 1、その3日後をattempt 2、最初の失敗から7日後をattempt 3とし、成功すれば次回を成功時刻＋30日に更新する。期限到来後はfetch前から`REVERIFYING`として新規FIXを保留する。Cron成功はACTIVE復帰だけを行い、保留中FIXは次回のGoogle fresh preview／confirmまでledgerへ反映しない。oldest due lagが15分を超えたら`OWNERSHIP_SCHEDULER_LAG`のOPEN alertにし、継続中はrelease前に解消する。

### 7.2 再所有

- LAPSEDなURLを同じ利用者または別利用者が取得する場合、14日間に3回の独立した成功を要求する。
- 1回目を候補開始、2回目を1回目から5日後以降、3回目を2回目から5日後以降かつ候補開始から14日以内とする。早すぎる成功はcountせず、14日を超えた候補はresetする。
- 3回目の成功時刻を新epochの`effectiveAt`とする。
- 1回目・2回目の成功時点では所有権を移さず、claimもしない。
- 14日内に3回成功しなければ回数をresetする。
- cooldown中に人が手動で短縮・免除できない。

### 7.3 FIXのepoch割当

- FIXのupload時刻ではなく評価時刻を使い、その時刻を包含するownership epochへ割り当てる。
- 正規化URLに過去のownership epochが1件もない初回検証だけはユーザー獲得用の特則とし、`effectiveAt`より前からその正規化URLに蓄積されている未claimの正負全FIXも初回ownerのpreview／claim集合に含める。すでにclaim済みのFIXは含めない。
- 過去epochが1件でもあるURLの再所有では上記特則を使わない。新epochの3回目成功`effectiveAt`以後に評価されたFIXだけを新ownerへ割り当て、それより前のFIXを同じ利用者または別利用者の新epochへ渡さない。
- すでにclaim済みのFIXを後から移動しない。
- epochのない期間のFIXは、初回特則の対象になる場合を除き、将来の有効epochが評価時刻を包含しない限り未受領のまま保持する。

## 8. 一括claim

claim確定前にread-only previewを返す。previewは評価軸ごとの正味合計、正件数、負件数、全件数と`claimSetHash`を含み、行や正負を選択するfieldを持たない。Google fresh認証後にpreviewを再取得し、利用者が一括受領を確認してから`claimSetHash`と`Idempotency-Key`を付けてPOSTする。serverは同じtransactionで対象集合とhashを再計算し、変化していれば`409 CLAIM_SET_CHANGED`で新しいpreviewを返し、古い集合を部分claimしない。

ACTIVE所有権に対するGoogle fresh済みhash付きconfirm POST時、次を同じD1原子処理で行う。

1. 対象identityとownership epochを再確認する。
2. 通常／再所有では評価時刻がepochに属する未claim全FIX、過去epoch 0件の初回所有では同じ正規化URLの蓄積分を加えた未claim全FIXの集合hashをcommand validation triggerで再検査する。
3. 正・負を区別せず全件を選択不可でclaimする。
4. FIX revisionごとの差分ledgerを追加する。
5. ledger INSERT triggerが`point_accounts.balance`と`evaluationTotal`を更新する。
6. `fixClaim`、idempotency result、audit eventを保存する。

利用者が都合のよい正のFIXだけを選べない。負の合計で残高が不足・負になってもclaim自体は成功させ、その後の消費系操作を拒否する。

並行claim、再読込、Workflow retryは同じclaim集合hashに収束し、二重台帳を作らない。

## 9. 監査と公開表示

- 所有権確認開始・成功・失敗、正規化前後URLの安全な表現、method、content hash、epoch遷移、claim件数と合計をappend-only auditへ残す。
- OAuth token、HTML本文、Cookie、認証code、FIX CSV本文を監査logへ残さない。
- publicプロフィールにはACTIVEなidentityだけを検証済みとして表示する。
- INACTIVE/LAPSEDは本人だけに理由と再検証導線を表示する。

## 10. 必須テスト

- URL正規化の同値・非同値fixture
- IP literal／private・reserved hostname、manual redirect各hop、DNS rebinding相当のprivate到達、redirect loop、巨大response、timeout、MIME不正の拒否
- `rel=me`優先、通常href完全一致、本文文字列・JS・iframeの拒否
- nonceなしで正しいlinkが承認される
- GitHub ID一致・メール相違で同じ主体を認識する
- URLだけのFIX入力からGitHub数値IDをvalidation／commitでsnapshotし、rename後は同一ID、username再利用後の新FIXは新IDとなる
- GitHub lookupの404／429／timeout／validation後ID変化で全件0反映
- 同じGitHub主体を2ユーザーが同時linkした場合は最初の永久対応だけが成功する
- GitHub loginは成功するが、INACTIVE ownershipを再有効化しない
- Google freshなしのGitHub ownership再有効化を拒否する
- 30日、7日3回、14日3回、3回目`effectiveAt`の境界時刻
- 初回Web所有権検証で`effectiveAt`前の蓄積正負FIXも選択不可一括preview／claimされる
- 旧ownerのepoch終了前後と再ownerの3回目`effectiveAt`前後を並べ、再ownerが過去分を受領せず以後分だけをclaimする
- 正負混在の全件一括claim、選択claim拒否、並行claimの二重反映防止
- claim previewの評価軸別正味合計／正件数／負件数、fresh後hash再取得、集合変化時の確定拒否
- Cronの15分起動、lease競合、同epochの連続する2つ30日cycleの`verificationCycleId`分離、3日／7日の3attempt、期限後の新規FIX保留、再deploy retry
- 所有権fetchがCloudflare cacheをbypassし、stale response／`Age`を証拠に使わない
- oldest due lag 15分超過の`OWNERSHIP_SCHEDULER_LAG` OPEN alert
- claim後のURL移転で既受領FIXが移動しない
