# v0.2 認証・外部ID・サービス間認可仕様

## 1. 目的と適用範囲

本書は、`points.freeism.app`、`markets.freeism.app`、およびPointsが提供するOAuth 2.1 Provider／Resource APIの認証・認可・外部ID所有権を定める正本である。

次の3種類を混同しない。

1. **アプリへのログイン**：PointsまたはMarketsの利用者セッションを作る。
2. **外部ID・URLの所有権確認**：未受領FIXの受領先を決める。
3. **Points–Markets間の認可**：Marketsが利用者の同意を得て残高参照・予約を行い、サービス権限で既存予約を確定・解放する。

メールアドレス、表示名、ユーザー名、プロフィールURLは変更可能な属性であり、本人識別の正本にしない。

## 2. アプリと認証データの境界

| 対象               | ログインProvider                            | 本人識別                 | セッション・認証DB                  |
| ------------------ | ------------------------------------------- | ------------------------ | ----------------------------------- |
| Points             | Google、GitHub                              | `providerId + accountId` | Points専用D1・Points専用Cookie      |
| Markets            | Googleのみ                                  | `providerId + accountId` | Markets専用D1・Markets専用Cookie    |
| Points–Markets連携 | Pointsが発行するpairwise `issuer + subject` | `issuer + subject`       | Markets D1の暗号化済みOAuth Account |

両アプリで次を禁止する。

- メール・パスワード認証
- Appleその他の未承認Provider
- メール一致による暗黙のAccount link・ユーザー統合
- PointsとMarketsのBetter Authテーブル、Secret、Cookieの共有
- `.freeism.app`をDomain属性とする共通Cookie
- Google ID、GitHub ID、メールアドレスを使ったPoints–Markets間の暗黙対応

MarketsはPointsをログインProviderにしない。MarketsへGoogleでログインした後、独立した操作としてPointsを明示連携する。

## 3. Better Auth共通設定

PointsとMarketsは、それぞれ独立したBetter Auth instanceを持つ。共通の規則は次のとおりである。

- `providerId + accountId`に一意制約を持たせる。

Account linkingとOAuth state／Cookieの正本設定形は次とする。各optionをtop-levelへ置かず、Better Authの`account`／`account.accountLinking`配下へ設定する。

```ts
account: {
  storeStateStrategy: "database",
  storeAccountCookie: false,
  accountLinking: {
    enabled: true,
    disableImplicitLinking: true,
    trustedProviders: [],
    allowDifferentEmails: true,
    updateUserInfoOnLink: false,
    allowUnlinkingAll: false,
  },
}
```

- OAuth Tokenはアプリケーションレベルで暗号化してD1へ保存する。
- OAuth TokenをAccount Cookieへ保存せず、OAuth stateはD1-backed storageへ保存する。
- Authorization Code flowではPKCE S256を必須とする。
- CSRF検査とOrigin検査を無効化しない。
- `trustedOrigins`は環境ごとの完全一致originだけを列挙する。
- 認証済み・非公開レスポンスは`Cache-Control: no-store`とする。

明示linkではProviderのメールが既存ユーザーと異なっていてもよい。ただし、メールが一致していても自動linkしない。Providerから取得した名前、メール、画像で既存Pointsプロフィールを上書きしない。

## 4. PointsのGoogle・GitHubログインと明示連携

### 4.1 共通Provider集合

PointsではGoogleとGitHubを同じSocial Provider集合として扱う。

2026-07-11にBetter Auth公式のSocial Provider／Account Linking optionsを確認した範囲では、Provider単位で「`linkSocial`は許可するが`signIn.social`は禁止する」標準optionを確認できなかった。したがって独自hookで経路を分岐せず、次の同一集合を正本とする。将来標準optionが追加されても、v0.2の仕様変更として別途承認されるまでは自動でProvider集合を分岐しない。

- ログイン画面にはGoogleとGitHubの両方を表示する。
- ログイン済みユーザーの連携画面にもGoogleとGitHubの両方を表示する。
- `signIn.social`と`linkSocial`で異なるProvider許可リストを作らない。
- Provider別にログインだけを拒否する独自hookは実装しない。
- Google・GitHub以外はv0.2のログイン／Social Account Linking対象外とする。

GoogleとGitHubで別々のPointsユーザーを作成した後、それらをメール一致で統合しない。あるProvider Accountがすでに別のPointsユーザーに属する場合、そのAccountを別ユーザーへlinkできない。同一Pointsユーザーとして使いたい場合は、第二のProviderで別ユーザーを作る前に、ログイン済みの既存ユーザーへ明示linkする。

### 4.2 Google

- Google Accountは`providerId = google`とGoogle `sub`に相当する`accountId`で識別する。
- email、email verified、表示名は本人識別に使用しない。
- Google APIを別用途で利用しない限り、ログインに不要な追加scopeやGoogle Refresh Tokenを要求しない。
- 重要操作のstep-upに使うため、link済みGoogle Accountの物理unlinkは許可しない。
- GitHubだけで作成したPointsユーザーも通常ログインは可能だが、重要操作の前にGoogleを明示linkする必要がある。

### 4.3 GitHub

- GitHub OAuth Appを使用する。
- Better Auth GitHub Providerの既定の最小scopeを使用し、用途のないscopeを追加しない。
- GitHubの不変な数値Account IDを`accountId`とする。
- GitHub username、表示名、メール、プロフィールURLの変更で本人対応を変更しない。
- メールはBetter Auth schemaを満たす属性としてのみ保持し、本人識別、通知、暗黙linkに使用しない。
- Providerからメールを取得できない場合は、`github-{accountId}@github.oauth.invalid`形式の予約ドメイン値を使用できる。この値も本人識別・通知・link判定には使用しない。
- 同じGitHub Accountを複数のPointsユーザーへ紐付けない。
- 一人のPointsユーザーが複数のGitHub Accountを明示linkすることは許可するが、各GitHub Accountの永久対応先は同じPointsユーザーに固定する。

## 5. OAuth主体の永久対応とGitHub所有権の無効化

### 5.1 永久対応

初めて成立した次の対応は永久記録とする。

```text
(providerId, accountId) -> Points userId
```

- 永久対応を別のPointsユーザーへ移動しない。
- Account close後も永久対応を物理削除しない。
- 同じOAuth主体で再度ログインした場合は、新しい空ユーザーを作らず元のPointsユーザーを再開する。
- 受領済みFIX、`evaluationTotal`、台帳、訂正先を別ユーザーへ移動しない。

### 5.2 GitHub所有権の無効化

GitHubはログインProviderでもあるため、所有権利用の停止をBetter Auth Accountの物理unlinkとして扱わない。

利用者が「GitHub所有権利用を無効化」した場合は次の状態になる。

- GitHub側のOAuth Tokenを失効させる。
- D1に保存したGitHub Access／Refresh Tokenを削除する。
- Better Authの`providerId + accountId + userId`対応行は保持する。
- GitHub所有権grantを`INACTIVE`にする。
- `INACTIVE`中に到着した正負FIXは自動付与せず保留する。
- GitHubログインに成功しても、それだけでは所有権grantを`ACTIVE`へ戻さない。

元のPointsユーザーがGoogle fresh認証を行い、同じGitHub Accountで所有権を明示的に再有効化した場合だけ`ACTIVE`へ戻す。再有効化responseで保留中の正負FIXの最新previewと集合hashを返し、同じfresh sessionから明示confirmした時だけ選択不可で一括受領する。OAuth callbackだけでledgerへ反映しない。

この「無効化」はログインAccountの切断ではない。永久対応を保ったまま、FIXの受領根拠としてGitHubを使用するかだけを切り替える。

## 6. Google fresh認証

### 6.1 判定条件

重要操作では次の両方を満たす必要がある。

1. Better Auth Sessionが15分以内のfresh sessionである。
2. 検証済みGoogle ID Tokenの`auth_time`が現在から900秒以内である。

step-upでは専用Google Authorization Code flowを開始する。authorization requestへnonce、PKCE S256と`claims={"id_token":{"auth_time":{"essential":true}}}`を含め、Google側で`auth_time` claimを有効にする。Googleの現行公式referenceが列挙する`prompt`は`none`、`consent`、`select_account`であり、`prompt=login`や未掲載の`max_age`を再認証保証として固定しない。`prompt=select_account`を使う場合もaccount選択UIのためだけで、freshnessの証明には扱わない。

- Authorization Code交換で得たGoogle ID Tokenの署名、`nonce`、`iss`、`aud`／`azp`、`exp`、`sub`、`auth_time`をWorkerで検証する。
- `auth_time <= 900秒`だけを許可し、claim欠落、未来時刻、901秒以上を拒否する。
- Google `sub`が現在のPointsユーザーにlink済みのGoogle `accountId`と一致する。
- email一致では通さない。
- 成功後にSession IDをローテーションする。

実装開始前にBetter Auth `1.7.0-rc.1`がGoogle authorization requestへ`claims`、nonce、PKCEを欠落なく渡せることと、実Google OAuth Appで利用者操作後に900秒以内の`auth_time`を得られることをstaging live contract spikeで確認する。自動test fixtureだけでは代替しない。Googleの公式対応範囲で再認証を促しても新しい`auth_time`を安定して得られない場合、15分fresh要件を弱めたり未掲載parameterへfallbackせず、重要操作をrelease blockerにして方式を再設計・再承認する。

再認証中に対象データが変化した場合は、古い確認内容を無効にし、件数・正負合計・評価軸などを再取得して再確認する。

### 6.2 対象操作

- Google／GitHubの明示link
- GitHub所有権利用の無効化・再有効化
- Web URL所有権の確定
- 正負の未受領FIX一括受領
- Points–Marketsの初回link、unlink、relink
- Points OAuthの追加scope同意
- FIX、評価軸、Package、交換比率、譲渡、交換、代用、自動分配の全CSV確定
- ADMINの追加・削除
- Account close
- Account reopen
- profile全体または評価軸別visibilityの`PRIVATE -> PUBLIC`を含む公開範囲拡大
- ADMIN権限によるCSV export snapshot作成
- OAuth Client、Client Secret、署名鍵の変更
- Settlementの管理者再試行・reconciliation

M2MのPoint Package Auction eligibility、capture、release、status取得はGoogle Sessionではなく、Client Credentials Token、専用scope、Client／Auction commandまたは予約所有権、冪等性で保護する。Auction eligibilityはDEC-256で確定している。

Points Workerは対象操作を散在するif文で管理せず、次のroute／operation policy registryを認可の正本にする。各routeはregistryからsession、ADMIN、Google fresh、reason、idempotencyの要否を適用し、未登録の重要mutationを起動時testで拒否する。

| operation                                 | route／protocol                                                                                 | 追加条件                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Social Account明示link                    | Better Auth `linkSocial` wrapper                                                                | login済み、Google fresh                                   |
| GitHub ownership停止／再開                | `/api/ownership/github/{deactivate,reactivate}`                                                 | Google fresh、永久主体一致                                |
| Web ownership確定                         | `/api/ownership/web/verify`                                                                     | Google fresh、fetch検証成功                               |
| 未受領FIX claim                           | `/api/ownership/{id}/claim`                                                                     | Google fresh後の最新preview hash                          |
| Points–Markets初回link／relink／追加scope | OAuth authorization／consent POST                                                               | Google fresh、明示consent                                 |
| Points–Markets通常unlink                  | 専用authorizationと`/api/v1/me/connection-deactivations`                                        | Google fresh、ACTIVE reservation 0                        |
| ADMIN CSV確定                             | `/api/admin/{fixes,evaluation-criteria,point-packages,exchange-rates,substitutions}/csv/commit` | ADMIN、Google fresh、reason、idempotency                  |
| 利用者CSV確定                             | `/api/{transfers,exchanges}/csv/commit`、`/api/settings/auto-distribution/csv/commit`           | 本人、Google fresh、idempotency                           |
| ADMIN追加／削除                           | `/api/admin/admin-memberships*`                                                                 | ADMIN、Google fresh、reason、最後の1人保護                |
| Account close                             | `/api/account/close`                                                                            | Google fresh、ACTIVE reservation 0、最後のADMIN保護       |
| Account reopen                            | `/api/account/reopen`                                                                           | 制限付きCLOSED Session、Google fresh、最新`reopenSetHash` |
| 公開範囲拡大                              | profile／評価軸visibility更新                                                                   | `PRIVATE -> PUBLIC`を1つでも含む時だけGoogle fresh        |
| ADMIN CSV export                          | `/api/csv-exports`                                                                              | ADMINとして他者／全体を出力する時だけGoogle fresh         |
| OAuth Client／Secret／署名鍵              | admin security mutation                                                                         | ADMIN、Google fresh、reason                               |
| Settlement retry／reconciliation          | 専用step-up／reconciliation POST                                                                | ADMIN、Google fresh、対象束縛                             |

各operationはGoogle `auth_time` 899秒、900秒、901秒、Google未link、`sub`不一致を同じtable-driven contract testで検証する。900秒以内だけを許可し、個別routeがmiddlewareを迂回できないことを確認する。

## 7. 汎用Web URLの所有権

### 7.1 検証方法

v0.2では人による審査、審査者Role、承認Queue、異議申立てWorkflowを実装しない。利用者が検証を実行し、自動条件を満たした時点で承認する。

対応する検証方法は次のとおりである。

- 編集可能な外部WebページにPointsプロフィールURLをlinkする方式
- `rel="me"`による相互link方式
- GitHub Social AccountによるOAuth/API所有権確認

Webページ検証は次の規則に従う。

- 利用者が外部URLを自身のPointsプロフィールへ事前登録する。
- Pointsプロフィールからも登録外部URLを参照できる相互linkとする。
- 外部ページの許可されたlink要素またはHTTP `Link` headerのURLと、PointsプロフィールURLをそれぞれ正規化して完全一致で判定する。
- 本文テキスト中のURL、部分一致、ユーザー名抽出、曖昧な同一性推定は使用しない。
- `rel="me"`が1件以上あるページでは`rel="me"`のlinkだけを候補とする。
- `rel="me"`がない編集可能ページでは、許可されたlink要素の完全一致を候補にできる。
- iframe内のlinkとJavaScript実行後にだけ現れるlinkは無視する。
- nonce、一時検証Token、DNS TXT、人による補完審査を必須にしない。

正規化では少なくともscheme／hostの大小文字、IDNのPunycode、既定port、末尾slash、fragmentを一貫して扱う。リダイレクト短縮URLは最終公開URLを再検証し、各遷移先にも同じ安全条件を適用する。

### 7.2 所有期間

初回所有者は1回の検証成功で待機なく`ACTIVE`となり、その成功時刻を所有期間の`effectiveAt`とする。これは以後に到着するFIXの所有期間境界であり、初回claimの下限時刻ではない。未登録者への先行FIXを後から受領できるという獲得戦略を維持するため、そのURLに過去から蓄積した未受領FIXは初回所有者のclaim集合へ含める。

- 検証有効期間は30日。
- 期限到来時または新規FIX到着時に再検証できる。
- 最初の失敗で`REVERIFYING`となり、新規FIXの自動付与を停止する。
- 7日間に最大3回再検証する。
- 3回以内に1回でも成功すれば所有継続とする。利用者がfresh sessionで実行した再検証なら最新preview確認後に保留中の正負FIXを一括受領できる。Cronによる成功はACTIVE復帰だけを行い、ledger反映は次回のfresh preview／confirmまで保留する。
- 3回すべて失敗、または明示解除で所有期間を終了する。
- 初回所有権のfresh preview／confirmは、当該正規化URLに紐づき、まだ誰にも受領されていない正負すべてのFIXを評価時刻にかかわらず選択不可で一括claimする。既受領FIX、取消済みFIX、別のidentity keyへ解決済みのFIXは含めない。

別ユーザーによる再所有は次のとおりである。

- 14日間に3回の検証成功を必要とする。
- 1回目の成功を候補期間の開始とし、2回目は1回目から5日後以降、3回目は2回目から5日後以降かつ候補開始から14日以内だけをcountする。`nextEligibleAt`より早い成功は回数へ数えず、14日を超えた場合は候補回数をresetして次の成功を新しい1回目とする。
- 新しい所有期間の`effectiveAt`は3回目の成功時刻とする。
- 候補期間中、所有者不明期間、`effectiveAt`より前のFIXは新所有者へ付与しない。
- 新所有者は`effectiveAt`以後に評価時刻を持つFIXだけを受領できる。
- 受領者はFIXの評価時刻と`ownershipEpoch`の組合せで決定する。
- 過去の受領済みFIXは旧所有者に残す。
- 自動的に解決できないFIXは凍結し、元FIXの訂正または取消Revisionによってのみ解消する。

### 7.3 未受領FIX

未受領FIXはdraftではなく、受領先だけが未確定の正式なFIX結果である。

- 正・負のどちらも登録できる。
- 所有権確認後にGoogle fresh sessionで最新previewと集合hashを確認し、claim可能な正負すべてを選択不可で一括受領する。自動callbackやCronだけでledgerへ反映しない。
- 受領前に評価軸別の正味合計、正件数、負件数を表示する。
- 最新Revisionだけを対象とする。
- 単一のPoints D1 transactionで処理し、1件でも失敗すれば全件を未受領のままにする。
- 同じFIX Revisionの二重受領を一意制約で防ぐ。
- 受領後の訂正は同じ受領者への差分台帳として反映する。
- 所有権を停止・変更しても既受領FIXを巻き戻さない。

### 7.4 外部fetchの安全条件

- HTTPS・port 443のみ
- URL userinfo禁止
- IP literal、localhost、private／reserved address・hostname禁止
- redirectはmanual、最大3回、各遷移先を再検証
- timeout 5秒
- response最大1 MiB
- HTML／textだけを受理
- Cookie、Authorization、利用者headerを転送しない
- JavaScriptを実行しない
- `global_fetch_strictly_public`を有効にする
- response本文は保存せず、証拠hashと検証結果だけを保存する

Workersの`fetch()`は、Cloudflareのegress proxyが実際に選択した接続先IPをWorkerへ公開しない。したがって、DNS解決後または接続直前のIPをアプリケーションが再検査・pinningする要件は置かない。URL parserでIP literal、localhost、private／reserved hostnameを拒否し、redirectをmanualにして各hopを再検証したうえで、`global_fetch_strictly_public`によるpublic Internet経路とCloudflare側の内部network遮断を接続時の防御とする。`cf.resolveOverride`やTCP socketでHTTP/443を独自実装しない。

## 8. Points–Markets OAuth

### 8.1 ユーザー対応と同意

Marketsは独立アカウントを持ち、利用者がログイン後にPointsを明示linkする。有効な対応は1対1である。

- 1 Marketsユーザーにつき1 Points `issuer + subject`
- 1 Points subjectにつき1 Marketsユーザー
- email、Google ID、GitHub IDでは対応付けない。
- 全予約が`CAPTURED`、`RELEASED`、`EXPIRED`のいずれかになるまでunlink・relinkできない。
- unlink後の新規reserveは禁止する。
- unlink前に作成した予約は、MarketsのM2M権限でcapture、release、status取得できる。
- unlink履歴は削除しない。

通常unlinkはMarketsのlocal rowだけを変更しない。Marketsが同じClient IDの専用Authorization Code + PKCE flowで`points.connection.unlink`を要求し、Pointsが15分以内のGoogle freshと対象連携を確認して一回限りのunlink authorizationを発行する。Markets BFFはそれを使ってPointsのconnection deactivation APIを呼ぶ。Pointsは同じD1原子処理でACTIVE reservationが0件であることを再確認し、app-owned grantを`UNLINKED`へ進め、標準OAuth consent／token family失効用outboxと監査eventを作る。Resource middlewareは各user requestでapp-owned grantのstatusとversionを再取得するため、標準OAuth tokenの物理失効が遅れても新規balance read／reserveを直ちに拒否する。MarketsはPointsの成功receiptを保存した後だけlocal connectionを`UNLINKED`にする。通信失敗時は同じidempotency keyでPointsの同じreceiptへ収束させる。

revocation outboxはBetter Authの公開されたconsent削除／RFC 7009 revocation APIだけを呼び、Better Auth内部tableを直接UPDATEしない。Better Auth 1.7正式版でapp-owned transactionへ参加できる公開APIが確認できた場合だけ同一transaction化を再検討する。app-owned grantが認可の正本なので、outbox retry中もuser resource accessは復活しない。

利用者がprovider側でgrantを外部失効させた場合は通常unlinkと区別する。Pointsのapp-owned grantを`REAUTH_REQUIRED`へ進め、ACTIVE reservationの有無にかかわらず新規user操作を拒否するが、既存reservationはreservationを作成したMarkets Client IDのM2M tokenでstatus／capture／releaseを継続できる。

初回とscope追加時にはPoints側で明示的な同意画面を表示する。同意画面では、残高参照、ポイント予約、落札時の予約確定／解放、オフライン利用を説明する。

### 8.2 Authorization Code flow

1. Marketsがstate、nonce、PKCE verifier／challengeを生成し、Markets SessionとMarkets userへserver-sideで束縛する。
2. Markets WorkerがClient CredentialsでPointsのlink-attempt APIを呼び、`marketsUserId`、state hash、PKCE challenge、redirect URI、scope、期限へ束縛したopaque `linkAttemptId`を取得する。
3. browser authorization requestは`linkAttemptId`だけを渡し、Pointsはapp-owned attemptを再取得する。request bodyの`marketsUserId`を信用しない。
4. PointsでGoogle fresh認証を確認し、利用者がscopeを承認する。
5. Pointsは同じD1 transactionで、Client ID＋Markets userとClient ID＋Points userの1対1 uniqueを検査し、app-owned grantと一回限りAuthorization Codeをattemptへ束縛する。競合時はcode／token familyを発行しない。
6. Markets WorkerがAuthorization CodeをTokenへ交換する。この時点のapp-owned grantは`PENDING_MARKETS_CONFIRMATION`で、Resource APIは使用できない。
7. Marketsはlocal connectionを`PENDING`で原子的に保存してから、Client Credentialsでlink-attempt finalizationを`CONFIRM`する。Pointsがgrantを`ACTIVE`へ進めたreceiptを取得後、Markets local rowを`ACTIVE`へ進める。
8. local保存が失敗した場合は同finalizationを`CANCEL`し、新attempt由来grant／token familyだけをrevocation outboxへ入れる。Marketsがcrashしても10分のattempt TTL reaperが未confirm grantをcancelする。既存connectionを変更しない。

Authorization Codeは一回限りとし、PKCE S256、state、nonce、issuer、redirect URI、resourceを検証する。OAuth Clientの動的登録は無効とする。

#### 8.2.1 browser return先

link、unlink、relink、Settlement手動retryのOAuth stateへ、利用者入力の任意URLを保存しない。Marketsはflow種別とresource IDだけをserver-side stateへ保存し、callback完了後の相対pathを次のallowlistから組み立てる。

| Flow                                   | 許可するreturn path                          | 許可query                                           |
| -------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Points connection link／unlink／relink | `/settings/points-connection`                | なし。結果codeはserver-side flash stateから表示する |
| Settlement手動retry                    | `/settlements/{stateへ束縛済みsettlementId}` | なし                                                |

内部関数にも`returnTo`引数を設けず、flow種別とstateへ束縛済みresource IDから上表のpathを組み立てる。requestにscheme／host／userinfo／fragment、`//`開始、rawまたはpercent-encoded backslash、control文字、二重decodeでpath separatorへ変わる値、queryが含まれていても保存・fallbackしない。callbackはstateから組み立てたpathだけへ`303`し、request queryやOAuth providerの値をredirect先として使わない。

PointsはBetter Auth OAuth Providerの標準`pairwiseSecret`を環境別Workers Secretから設定し、Markets clientを`subject_type=pairwise`で静的登録する。public subjectを発行せず、同じPointsユーザーでもClient ID／environmentが違えばsubjectを分離する。pairwise secretは通常rotationしない。漏えい時は全user grantを`REAUTH_REQUIRED`へ進め、秘密を更新し、既存Markets userと新subjectをGoogle freshのcontrolled relinkで再対応させる。旧subjectと履歴を削除しない。

利用者委任Access TokenはBetter Auth OAuth Providerの標準`disableJwtPlugin: true`でopaqueに固定し、JWT Access Tokenを発行しない。これはJWT Access Tokenの`sub`がPoints内部user IDになる標準挙動を避け、Marketsへ公開する本人識別子を`issuer + pairwise subject`だけに限定するためである。

- confidential clientのID Tokenは`disableJwtPlugin: true`時のBetter Auth標準どおりClient Secretで署名し、OIDC clientだけが検証する。Points Resource APIのBearer Tokenや連携正本には使わない。
- pairwise `sub`はID Token、UserInfo、標準`/oauth2/introspect`の応答にだけ現れる。MarketsはToken文字列をparseせず、標準introspectionの`active=true`、`iss`、`sub`、`client_id`、scope、audience/resource、期限を検証して`issuer + sub`を保存する。
- `disableJwtPlugin: true`はOAuth Provider全体へ適用されるため、Client Credentials Access Tokenもopaqueになる。ただし標準introspectionに独自`token_class`／`grant_type` claimを追加しない。利用者委任principalは「pairwise `sub`あり＋利用者scopeだけ」、M2M principalは「利用者`sub`なし＋M2M scopeだけ」から導出し、scopeが混在する、`sub`の有無とscope種別が矛盾する、または分類不能なTokenは拒否する。
- Points Resource APIは同じWorker内のBetter Auth instanceを渡した標準`oauthProviderResourceClient(auth)`／標準server APIでin-process introspectionし、別のResource Server Client Secretや独自HTTP endpointを作らない。Marketsがlink完了等でremote introspectionする場合だけ、同じMarkets confidential Client ID／SecretをMarkets Worker Secretから使う。どちらもopaque Tokenを未検証decodeせず、内部user IDをpairwise `sub`へ上書きするcustom claimを作らない。
- Marketsのremote introspection credentialはMarkets Worker Secretにだけ置き、browserやPoints Resource API設定へ複製しない。Service Binding経由でも各requestのBearerをPoints内の標準Resource Clientへ渡して検証し、positive resultをrequest境界を越えて無期限cacheしない。
- Better Auth `1.7.0-rc.1`と正式`1.7.0`の双方で、opaqueなAuthorization Code／Refresh／Client Credentials、pairwise introspection、revocation、audience/resource、scope分離をlive spikeする。標準APIで成立しなければ独自実装へfallbackせずreleaseを停止して再承認する。

### 8.3 同一Client ID内のgrant分離

環境ごとに1つのMarkets OAuth Client IDを作り、そのClient ID内でgrantとscopeを分離する。

| Principal／Token用途    | grant                                 | 許可scope・用途                                                                                                |
| ----------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 利用者委任opaque Token  | `authorization_code`、`refresh_token` | `openid profile offline_access`、`points.connection.read`、`points.balance.read`、`points.reservations.create` |
| Connection unlink       | 専用`authorization_code`              | `points.connection.unlink`だけ。Google fresh後の通常unlinkを一回だけ認可する                                   |
| Settlement管理assertion | 専用`authorization_code`              | `points.admin.settlement.retry`だけ。対象Auction／Settlementの手動再試行を一回だけ認可する                     |
| Worker間opaque Token    | `client_credentials`                  | `points.reservations.status`、`points.reservations.capture`、`points.reservations.release`                     |

link-attempt作成／finalizeには同じClient Credentials grantの`points.connection.link-attempt.create`／`points.connection.link-attempt.finalize`だけを使う。このscopeでbalance、reserve、settlement、unlinkを実行できない。

Client Credentials Tokenは利用者を表すログインTokenではなく、`client_id`とClient Secretで認証されたMarkets Worker自身を表す短命Access Tokenである。既存予約の確定・解放を、利用者が画面を閉じたりPoints連携を外部失効させた後も完了させるために使う。任意ユーザーの残高操作や新規予約には使えない。

- 利用者Tokenではcapture／releaseできない。
- M2M Tokenでは任意ユーザーの残高参照・新規reserve・直接debitができない。
- Marketsは同じ`client_id`が作成した予約だけをsettleできる。
- Refresh TokenからM2M scopeを追加できない。
- Client Credentialsから利用者scopeを取得できない。
- 同じClient Secretの漏えいが両grantへ影響する残余リスクを受容し、短命Token、scope強制、Secret rotation、監査で補う。

Settlement手動再試行では、通常の利用者委任TokenやWorker間Tokenへ管理scopeを追加しない。Markets BFFが同じClient IDの専用Authorization Code + PKCE flowを開始し、stateをMarkets Session、Auction ID、Settlement ID、reason hash、return URLへserver-sideで束縛する。Pointsは同意済みの1対1連携、現在の同格ADMIN、15分以内のGoogle freshを再検証してから、次の条件を満たす署名assertionをserver-side交換で発行する。

- audienceはMarketsのSettlement管理resourceだけとする。
- scopeは`points.admin.settlement.retry`だけとする。
- `auctionId`、`settlementId`、`reasonHash`、pairwise subject、`jti`、`iat`、`exp`を含める。
- 有効期間は発行から最大60秒とする。MarketsのGET callbackはassertionを検証してraw Tokenを破棄し、対象とSessionへ束縛した`PENDING` authorizationを`jti`一意で保存するだけにする。
- callbackはWorkflowを開始しない。同じMarkets SessionからCSRF保護された`POST /api/settlements/{settlementId}/retry`を受けた時だけ、期限内`jti`を原子的に`USED`へ進め、rate limit、saga single-flight、deterministic retry outboxを同じMarkets D1 transactionで確定する。Workflow bindingはD1 transactionへ参加できないため、commit後のdispatcherがoutbox IDをWorkflow instance IDとして冪等に起動する。
- 通常のRefresh Tokenを発行せず、別Auction／Settlement、reconciliation一般権限、Points管理操作へ転用できない。
- assertionをbrowser storage、Cookie、log、audit、D1へ保存しない。callbackからMarkets BFF内で検証後に破棄し、D1には検証済みclaimsとhashだけを保存する。

PointsはADMINとfreshnessの証明だけを担い、Auction ranking、Settlement state、Workflow retryを実行しない。Marketsはassertion検証後も自身のD1で対象state、single-flight、retry上限、reason、idempotencyを検証し、自身のWorkflowだけを再試行する。

標準introspection応答はGate Aで実測したfieldだけを使い、opaque Access Token自体をJWTとしてdecodeしない。次を必須にする。

- `iss`
- `aud`
- pairwise `sub`（利用者Tokenでは必須、M2M Tokenでは不存在を必須とする）
- `client_id`または`azp`
- `scope`
- `exp`

`active=true`とPoints API用resource／audienceを必須とし、他ResourceへのToken再利用を拒否する。`token_type=Bearer`は両principalに共通なので分類根拠にしない。利用者scope集合とM2M scope集合は互いに素とし、`sub`有無＋scope集合から導出したprincipal classをroute policyへ照合する。Better Auth `1.7.0-rc.1`／正式`1.7.0`のどちらかでM2Mの`sub`不存在またはこの一意分類が成立しなければ、custom claimで補わずreleaseを停止する。Service Bindingは通信経路であり認可根拠ではないため、Binding経由でもBearer Tokenと上記introspection結果を検証する。

### 8.4 Token保存とRefresh

- PointsのAccess／Refresh TokenはMarkets D1のBetter Auth Accountへ暗号化保存する。
- Points TokenをMarketsのCookie、ブラウザJavaScript、`localStorage`へ返さない。
- MarketsのブラウザにはMarkets Session Cookieだけを保存する。
- OAuth Client Secret、Better Auth Secret、pairwise secret、Token暗号化key ring、ID Token／Settlement管理assertion用署名keyは環境別Workers Secretsに保存し、D1や公開設定へ置かない。
- Token暗号文はkey versionを持つ。key ringはcurrent encrypt keyと旧decrypt-only keyを持ち、read／Refresh CAS時にcurrent versionへlazy rewrapする。unknown versionは失敗し、旧version ciphertextが0件になるまで旧keyを削除しない。
- Settlement管理assertion等の非opaque署名TokenはSecretのprivate JWKと`kid`で署名し、JWKSにはcurrentと移行中のprevious public keyだけを公開する。最長Token期限、clock skew、deploy overlapを経過し、旧`kid` trafficが0であることを確認してからprevious keyを削除する。D1へprivate keyを保存しない。confidential clientのID Tokenは`disableJwtPlugin: true`時のBetter Auth標準Client Secret署名を使い、独自JWKへ差し替えずResource API Bearerへ転用しない。
- Access Token期限切れ時は保存済みRefresh Tokenで更新し、新しいAccess／Refresh Tokenを暗号化して置換する。
- 401時の明示Refreshと再試行は1回だけとし、失敗時は再連携を要求する。
- Refresh Token Rotationの同時実行は、Markets Account単位のD1 lease／CASでsingle-flight化する。
- 同じRefresh Tokenを並列使用しない。
- Token、Cookie、Authorization Code、Client Secretをログへ出さない。

## 9. Cookie、CSRF、Origin

| 項目           | Points                           | Markets                          |
| -------------- | -------------------------------- | -------------------------------- |
| Cookie domain  | `points.freeism.app` host-only   | `markets.freeism.app` host-only  |
| Cookie prefix  | Points専用                       | Markets専用                      |
| 属性           | `Secure; HttpOnly; SameSite=Lax` | `Secure; HttpOnly; SameSite=Lax` |
| 認証DB・Secret | Points専用                       | Markets専用                      |

- 業務状態の変更はJSONのPOST／PUT／PATCH／DELETEとし、通常のGETで変更しない。
- OAuth callbackのGETだけは、単回state／codeの消費と、後続POSTへ必要な期限付きprotocol state／検証済みpending claimsの保存を許可する例外とする。callback GETで経済状態、Auction／Settlement state、Workflow、grant statusを変更しない。
- OriginとFetch Metadataを検査する。
- credential付き`Access-Control-Allow-Origin: *`を禁止する。
- CORSを認証・認可として扱わない。
- OAuth callback、WebSocket handshake、重要mutationで環境ごとの正しいoriginを検証する。
- 重要mutationは`Idempotency-Key`を要求し、同じkey・異なるpayloadは`409`とする。

## 10. Account closeと認証記録

Account closeは経済記録と永久主体対応の物理削除ではない。

- 全SessionとOAuth consentを失効する。
- 公開プロフィールを非表示にし、不要な属性を削除または匿名化する。
- Better Auth Accountと永久OAuth主体対応は、再登録時に元ユーザーへ戻すため保持する。
- FIX、Claim、台帳、残高、負残高、監査eventを保持する。
- 有効予約がある場合はcloseできない。
- 最後のADMINである場合はcloseを拒否し、別のADMINを追加した後にだけ再実行できる。未定義の「ADMIN対象アーカイブ」経路は作らない。

close後に同じ永久OAuth主体でloginした場合、認証callbackは新しいPoints userを作らず元の`pointsUserId`へCLOSED sessionを結び付ける。callbackだけで公開状態へ戻さず、利用者へ再開画面を表示する。Google freshを伴う明示POSTで`CLOSED -> ACTIVE`へ進め、Sessionを再rotateし、監査eventを追加する。匿名化済みの表示名、説明、画像、外部URLを自動復元せず、利用者が再設定する。FIX、claim、ledger、残高、永久主体対応は同じuserに残す。

## 11. バージョンと本番Gate

- 開発・stagingはBetter Auth `1.7.0-rc.1`を完全固定する。
- Better Auth関連packageは同一のexact versionへ固定する。
- ProductionはBetter Auth 1.7正式版への更新と、認証回帰テスト完了を必須条件とする。
- 1.6系へ戻して本番運用するfallbackは採用しない。
- Provider、OAuth grant、resource-bound Token、Token暗号化、schema生成の挙動を正式1.7版で再確認する。

## 12. Rate LimitとTurnstile

Rate Limitは不正利用の抑止に使用するが、所有権retry回数、Account一意性、FIX二重受領などの正確性はD1の状態・一意制約で保証する。

| 操作                     | v0.2初期値                                 |
| ------------------------ | ------------------------------------------ |
| Google／GitHub OAuth開始 | Better AuthのD1 rate limit＋Cloudflare WAF |
| URL所有権検証            | user＋URLで5回／時、user全体30回／日       |
| Points–Markets link開始  | user単位のD1 rate limit＋WAF               |

Turnstileは通常のlogin、通常のURL検証では表示しない。未認証のOAuth開始がrate limitへ接近した場合、短時間の大量URL検証、明らかなbot pattern、WAF managed challenge後にだけ適応的に要求する。

- Turnstile Tokenはserver-side Siteverifyで検証する。
- hostnameとactionを検証する。
- Tokenは5分・一回限りとする。
- Turnstile成功をAccount link、所有権、FIX claimの正確性根拠にしない。

## 13. 監査event

少なくとも次をappend-onlyで記録する。

- Google／GitHub loginの成功・拒否
- Social Account linkの成功・拒否
- GitHub ownershipの無効化・再有効化
- Google fresh認証の成功・拒否と時刻
- Points–Markets link、unlink、relink、scope同意
- Web URL検証、再検証、所有期間終了、再所有
- 未受領FIX claim
- OAuth Client／Secret／署名鍵変更
- Refresh失敗、Token class／scope拒否
- Account close・再開

Token、Cookie、Authorization Code、Client Secret、CSV本文、取得したWebページ本文は監査eventへ記録しない。

## 14. 必須テスト

### 14.1 Pointsログイン・Account link

- ログイン画面と連携画面の双方にGoogle・GitHubだけが表示される。
- GoogleとGitHubの新規ログイン・既存Accountログインが成功する。
- email/password、Apple、未設定Providerを利用できない。
- 同じemail・異なるGoogle `sub`またはGitHub IDを暗黙linkしない。
- 異なるemailのGoogle／GitHub Accountをログイン済みユーザーへ明示linkできる。
- `(providerId, accountId)`を複数ユーザーへlinkできない。
- Provider Accountが別ユーザーに属する場合、メール一致で統合しない。
- link時にPointsの名前、メール、画像を上書きしない。
- GitHub email欠落時の予約ドメイン値を本人識別・通知・link判定に使わない。
- OAuth TokenがD1上で暗号化され、Account Cookie・ブラウザへ出ない。

### 14.2 GitHub永久対応・所有権無効化

- GitHub所有権無効化でTokenが失効・削除されるが、Better Auth Accountと永久対応は残る。
- 無効化中のGitHubログインだけではownershipが`ACTIVE`にならない。
- 無効化中の正負FIXが保留される。
- 別Pointsユーザーが同じGitHub Accountをlinkできない。
- 元ユーザーがGoogle fresh認証と同じGitHub Accountで再有効化すると、保留中の正負FIXを全件受領する。
- Account close後の同一OAuth主体ログインが元のPointsユーザーを再開し、新規空ユーザーを作らない。

### 14.3 Google fresh認証

- `auth_time`が14分59秒なら許可し、15分を超えた場合は拒否する。
- Better Auth SessionだけfreshでもGoogle `auth_time`が古ければ拒否する。
- 別Google `sub`、email一致、未検証ID Token、署名・issuer・audience・nonce不正を拒否する。
- 成功時にSession IDをローテーションする。
- GitHubだけのユーザーはGoogle linkとstep-up完了前に重要操作を実行できない。
- 再認証中に確認対象が変化した場合、古い確認を破棄する。

### 14.4 Web URL所有権・未受領FIX

- 許可link要素の正規化完全一致で初回所有権を即時確定する。
- 本文テキスト、部分一致、iframe、JavaScript生成linkを拒否する。
- `rel="me"`が存在する場合に通常linkを候補にしない。
- 30日境界、再検証失敗後7日間最大3回、途中成功、3回失敗を検証する。
- 再所有は14日間3回成功を要求し、`effectiveAt`が3回目成功時刻になる。
- 新所有者が`effectiveAt`以前のFIXを受領できない。
- 正負未受領FIXを選択不可・全件原子的にclaimする。
- 同じFIX Revisionを二重claimできない。
- claim途中失敗で全件rollbackする。
- 既受領FIXがunlink・再所有で移動しない。
- HTTPS／443、userinfo、IP literal、private／reserved address、redirect 3回、timeout 5秒、1 MiB、Content-Type制限を検証する。
- redirect先を毎回再検証し、Cookie・Authorizationを転送しない。

### 14.5 Points–Markets OAuth

- state、nonce、redirect URI、PKCE verifier、Authorization Code再利用の不正を拒否する。
- opaque Tokenの未検証decode、introspectionの`active=false`、issuer、audience／resource、期限、`client_id`、Token class、scope不一致を拒否する。
- 利用者Tokenのintrospectionがpairwise `sub`を返し、Points内部user IDをMarketsへ公開しないことを検証する。
- Client Credentials Tokenのintrospection結果を利用者subjectとして解釈しない。
- 利用者Tokenでcapture／releaseできない。
- M2M Tokenで残高取得・新規reserve・任意debitができない。
- Client AがClient Bの予約をsettleできない。
- 同一Client IDでもRefresh TokenからM2M scope、Client Credentialsから利用者scopeを取得できない。
- 通常の利用者grant／Refresh Token／Client Credentialsから`points.admin.settlement.retry`を取得できない。
- Settlement管理step-upはPointsのADMINとGoogle freshを再検証し、対象へ束縛された60秒assertionを一回だけ使用できる。
- assertionのAuction／Settlement／reason／Markets Session差し替え、期限切れ、`jti`再利用を拒否する。
- 1 Marketsユーザー対1 Points subject、1 Points subject対1 Marketsユーザーを強制する。
- 有効予約中のunlink・relinkを拒否する。
- unlink後に新規reserveを拒否し、既存予約のcapture／release／statusは許可する。
- Access／Refresh Tokenがブラウザへ出ず、Markets D1で暗号化される。
- 同時Refreshをsingle-flight化し、Refresh Token Rotationで古いTokenを並列使用しない。
- 401後のRefresh・再試行が最大1回である。
- Service Binding経由でもBearer Tokenなし、introspection失敗、不正scope、不正audienceを拒否する。

### 14.6 Cookie・CSRF・環境分離

- Points CookieがMarketsへ、Markets CookieがPointsへ送信されない。
- stagingのCookie、OAuth Client、issuer、audience、Secretをproductionが拒否する。
- 不正Origin、CSRF state、Fetch Metadataを拒否する。
- 認証済みレスポンスに`no-store`が付く。
- credential付きwildcard CORSを返さない。

### 14.7 Rate Limit・Turnstile

- OAuth開始、URL検証、Points–Markets link開始の各limitをActor／resource単位で適用する。
- Cloudflareの近似Rate Limitがずれても、D1の所有権retry上限と一意制約が破られない。
- 通常loginと通常URL検証ではTurnstileを要求しない。
- 適応条件を満たした場合だけTurnstileを要求する。
- Siteverifyの失敗、期限切れ、再利用、hostname不一致、action不一致を拒否する。

### 14.8 Release回帰

- Better Auth 1.7正式版でGoogle／GitHub login、明示link、fresh認証、Token暗号化、OAuth Provider、opaque Access Token、pairwise introspection、Refresh Rotation、Client Credentials、resource-bound Tokenの全テストが成功する。
- 上記テストが未完了の場合はProduction releaseを許可しない。

## 15. 参考仕様

- [Better Auth Users & Accounts](https://www.better-auth.com/docs/concepts/users-accounts)
- [Better Auth Security](https://www.better-auth.com/docs/reference/security)
- [Better Auth Session Management](https://www.better-auth.com/docs/concepts/session-management)
- [Better Auth GitHub Provider](https://www.better-auth.com/docs/authentication/github)
- [Better Auth OAuth 2.1 Provider](https://www.better-auth.com/docs/plugins/oauth-provider)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google OpenID Connect API Reference](https://developers.google.com/identity/openid-connect/reference)
