# v0.2 認証・外部ID・サービス間認可仕様

## 1. 目的と適用範囲

本書は、`points.freeism.app`、`markets.freeism.app`、およびPointsが提供するOAuth 2.1 Provider／Resource APIの認証・認可を定める正本である。外部アカウントの登録・所有権証明・公開設定は[Accounts v0.1仕様](../../../projects/accounts-web-app/docs/specification/v0.1/main.ja.md)を正本とする。

次の3種類を混同しない。

1. **アプリへのログイン**：PointsまたはMarketsの利用者セッションを作る。
2. **Accountsとの情報連携**：Accountsが公開許可に基づいて照合した情報を使い、Pointsが未受領FIXの受領先を決める。
3. **Points–Markets間の認可**：Marketsが利用者の同意を得て残高参照・予約を行い、サービス権限で既存予約を確定・解放する。

メールアドレス、表示名、ユーザー名、プロフィールURLは変更可能な属性であり、本人識別の正本にしない。

## 2. アプリと認証データの境界

| 対象               | ログインProvider                            | 本人識別                 | セッション・認証DB                  |
| ------------------ | ------------------------------------------- | ------------------------ | ----------------------------------- |
| Points             | Google、GitHub                              | `providerId + accountId` | Points専用D1・Points専用Cookie      |
| Markets            | Googleのみ                                  | `providerId + accountId` | Markets専用D1・Markets専用Cookie    |
| Points–Markets連携 | 登録済み提供先が発行するOAuth Token | `providerId + subject`と登録issuer照合 | Markets D1の暗号化済みOAuth Account |

両アプリで次を禁止する。

- メール・パスワード認証
- Appleその他の未承認Provider
- メール一致による暗黙のAccount link・ユーザー統合
- PointsとMarketsのBetter Authテーブル、Secret、Cookieの共有
- `.freeism.app`をDomain属性とする共通Cookie
- Google ID、GitHub ID、メールアドレスを使ったPoints–Markets間の暗黙対応

MarketsはPointsをログインProviderにしない。MarketsへGoogleでログインした後、独立した操作としてPointsを明示連携する。

PointsとAccountsは、それぞれのログイン手段、ユーザー、セッションを持つ独立サービスである。Pointsへのログイン後に、Accountsとの情報連携を明示的に許可する。

## 3. Better Auth共通設定

PointsとMarketsは、それぞれ独立したBetter Auth instanceを持つ。Better Auth標準AccountはProvider Accountの再利用を検査するが、Pointsの永久`providerId + accountId -> Points userId`対応の正本にはしない。永久対応とその一意制約は5節のapp-owned tableで保証し、本番公開前に必ず実装する。

Account linkingとOAuth state／Cookieの正本設定形は次とする。各optionをtop-levelへ置かず、Better Authの`account`／`account.accountLinking`配下へ設定する。

```ts
const socialProviderIds = app === "points" ? ["google", "github"] : ["google"];

betterAuth({
  // Workers Secretsから組み立てる。先頭がcurrent、残りがdecrypt-only。
  secrets: versionedBetterAuthSecrets,
  account: {
    encryptOAuthTokens: true,
    storeStateStrategy: "database",
    storeAccountCookie: false,
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
      trustedProviders: [...socialProviderIds],
      allowDifferentEmails: true,
      updateUserInfoOnLink: false,
      allowUnlinkingAll: false,
    },
  },
});
```

- `trustedProviders`は各appの承認済みSocial Provider正本集合と必ず同じにする。PointsはGoogle＋GitHub、MarketsはGoogleだけである。これは未verified emailでも明示linkを成立させるためのProvider信頼設定であり、`disableImplicitLinking: true`を維持してメール一致の暗黙linkを禁止する。
- Social OAuth TokenはBetter Auth標準の`account.encryptOAuthTokens: true`で暗号化してD1へ保存する。独自AES-GCM envelope、独自暗号key ring、read時lazy rewrapを実装せず、標準のversioned secretsを使う。標準暗号形式・algorithmをアプリ契約へ固定しない。
- OAuth TokenをAccount Cookieへ保存せず、OAuth stateはD1-backed storageへ保存する。
- Authorization Code flowではPKCE S256を必須とする。
- CSRF検査とOrigin検査を無効化しない。
- `trustedOrigins`は環境ごとの完全一致originだけを列挙する。
- 認証済み・非公開レスポンスは`Cache-Control: private, no-store`、OAuth／token／callback responseは`Cache-Control: no-store`とする。

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

## 5. Pointsログイン用OAuth主体の永久対応

### 5.1 永久対応

初めて成立した次の対応は永久記録とする。

```text
(providerId, accountId) -> Points userId
```

- 永久対応を別のPointsユーザーへ移動しない。
- Account close後も永久対応を物理削除しない。
- 同じOAuth主体で再度ログインした場合は、新しい空ユーザーを作らず元のPointsユーザーを再開する。
- 受領済みFIX、`evaluationTotal`、台帳、訂正先を別ユーザーへ移動しない。
- この永久対応はPoints app-owned tableへ保存し、`(providerId, accountId)`複合一意制約を持たせる。Better Auth CLI生成Account schemaにこの永久性を期待しない。
- login／明示link／Account close後の再開は、app-owned永久対応を同じD1 transactionまたは失敗時に再実行可能な単調処理で照合する。同じ主体を別ユーザーへ割り当てない。
- 永久対応table、一意制約、既存対応への再開経路はPoints実装計画Task 9が所有し、Task 9完了をproduction release blockerとする。Task 1ではBetter Auth標準Accountの既存Account再利用だけを検査する。

### 5.2 Accountsとの責務境界

本節の永久対応はPointsへのログインと経済記録の再開を対象とする。外部アカウントの所有権証明・紐付け・解除は[Accounts v0.1仕様](../../../projects/accounts-web-app/docs/specification/v0.1/main.ja.md)に従い、PointsはAccountsから提供を許可された照合結果を貢献者の特定に利用する。

## 6. Google fresh認証

### 6.1 判定条件

重要操作では次の両方を満たす必要がある。

1. Better Auth Sessionが15分以内のfresh sessionである。
2. 検証済みGoogle ID Tokenの`auth_time`が現在から900秒以内である。

step-upでは専用Google Authorization Code flowを開始する。authorization requestへPKCE S256と`claims={"id_token":{"auth_time":{"essential":true}}}`を含め、Google側で`auth_time` claimを有効にする。Googleの現行公式referenceが列挙する`prompt`は`none`、`consent`、`select_account`であり、`prompt=login`や未掲載の`max_age`を再認証保証として固定しない。`prompt=select_account`を使う場合もaccount選択UIのためだけで、freshnessの証明には扱わない。

- Authorization Code交換で得たGoogle ID Tokenの署名、`iss`、`aud`／`azp`、`exp`、`sub`、`auth_time`をWorkerで検証する。
- `auth_time <= 900秒`だけを許可し、claim欠落、未来時刻、901秒以上を拒否する。
- Google `sub`が現在のPointsユーザーにlink済みのGoogle `accountId`と一致する。
- email一致では通さない。
- 成功後にSession IDをローテーションする。

Better Auth 1.7.6のGoogle認証で`state`、PKCE S256、`claims`、nonceと実Google OAuth Appの`auth_time`をstagingで検証する。Google freshを要する操作は900秒以内の`auth_time`と現在ユーザーに紐付くGoogle `sub`を確認する。

再認証中に対象データが変化した場合は、古い確認内容を無効にし、件数・正負合計・評価軸などを再取得して再確認する。

### 6.2 対象操作

- Google／GitHubの明示link
- 正負の未受領FIX一括受領
- Points–Marketsの初回link、unlink、relink
- Points OAuthの追加scope同意
- FIX、評価軸、Package、交換比率、譲渡、交換、代用、自動分配の全CSV確定
- ADMINの追加・削除
- Account close
- Account reopen
- profile全体または評価軸別visibilityの`PRIVATE -> PUBLIC`を含む公開範囲拡大
- ADMIN権限によるCSV export snapshot作成
- OAuth Client、公開鍵、署名鍵の変更
- 接続先Accountsの作成・有効化・取り下げ
- Settlementの管理者再試行

M2MのPoint Package Auction eligibility、capture、release、status取得はGoogle Sessionではなく、Client Credentials Token、専用scope、Client／Auction commandまたは予約所有権、冪等性で保護する。Auction eligibilityはDEC-256で確定している。

Points Workerは対象操作を散在するif文で管理せず、次のroute／operation policy registryを認可の正本にする。各routeはregistryからsession、ADMIN、Google fresh、reason、idempotencyの要否を適用し、未登録の重要mutationを起動時testで拒否する。

| operation                                 | route／protocol                                                                                                     | 追加条件                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Social Account明示link                    | Better Auth `linkSocial` wrapper                                                                                    | login済み、Google fresh                                   |
| 未受領FIX claim                           | `/api/unclaimed-fixes/claims`                                                                                       | Google fresh後の最新preview hash、idempotency             |
| Points–Markets初回link／relink／追加scope | OAuth authorization／consent POST                                                                                   | Google fresh、明示consent                                 |
| Points–Markets通常unlink                  | 専用authorizationと`/api/v1/me/connection-deactivations`                                                            | Google fresh、ACTIVE reservation 0                        |
| ADMIN CSV確定                             | `/api/admin/{fixes,evaluation-criteria,point-packages,exchange-rates,substitutions}/csv/commit`                     | ADMIN、Google fresh、reason、idempotency                  |
| 利用者CSV確定                             | `/api/{transfers,exchanges}/csv/commit`、`/api/settings/auto-distribution/csv/commit`                               | 本人、Google fresh、idempotency                           |
| ADMIN追加／削除                           | `/api/admin/admin-memberships*`                                                                                     | ADMIN、Google fresh、reason、最後の1人保護                |
| Account close                             | `/api/account/close`                                                                                                | Google fresh、ACTIVE reservation 0、最後のADMIN保護       |
| Account reopen                            | `/api/account/reopen`                                                                                               | 制限付きCLOSED Session、Google fresh、最新`reopenSetHash` |
| 公開範囲拡大                              | profile／評価軸visibility更新                                                                                       | `PRIVATE -> PUBLIC`を1つでも含む時だけGoogle fresh        |
| ADMIN CSV export                          | `/api/csv-exports`                                                                                                  | ADMINとして他者／全体を出力する時だけGoogle fresh         |
| OAuth Client／公開鍵                    | `/api/oauth-clients*`                                                                                                | 登録者本人、1人5件まで                                    |
| 接続先Accountsの作成／有効化／取り下げ    | `/api/admin/accounts-connections`、`/api/admin/accounts-connections/{accountsConnectionId}/{activation,withdrawal}` | ADMIN、Google fresh、reason、idempotency                  |
| Settlement retry                          | Marketsのretry POST                                                                                                 | Markets ADMIN、seller、対象状態、reason                   |

各operationはGoogle `auth_time` 899秒、900秒、901秒、Google未link、`sub`不一致を同じtable-driven contract testで検証する。900秒以内だけを許可し、個別routeがmiddlewareを迂回できないことを確認する。

## 7. Accountsとの情報連携と未受領FIX

### 7.1 外部アカウントの照合

外部アカウントの登録、OAuth・Webページによる所有権証明、URL正規化、公開先ごとの同意、外部fetchの安全条件は[Accounts v0.1仕様](../../../projects/accounts-web-app/docs/specification/v0.1/main.ja.md)に従う。Pointsは独立したOAuthクライアントとして、本人がPointsへの提供を許可したアカウントを照合する。本人がPointsを操作していない場合も、許可済みの情報を照合できる。

未受領FIXの対象集合と帰属は[未受領FIX仕様](../../../projects/points-web-app/docs/specification/v0.2/details-ja/unclaimed-fix-and-ownership.md)に従う。

### 7.2 未受領FIX

未受領FIXはdraftではなく、受領先だけが未確定の正式なFIX結果である。

- 正・負のどちらも登録できる。
- Accountsの照合結果とPointsユーザーへの対応を確認した後、Google fresh sessionで最新previewと集合hashを確認し、claim可能な正負すべてを選択不可で一括受領する。ledgerへの反映はPointsの明示confirmで行う。
- 受領前に評価軸別の正味合計、正件数、負件数を表示する。
- 同じ対象者について各Revisionの未受領差分をまとめて受領し、受領額は最新Revisionの額と一致する。受領者が未確定の対象者への修正差分は未受領とする。
- 単一のPoints D1 transactionで処理し、1件でも失敗すれば全件を未受領のままにする。
- 同じFIX Revisionの二重受領を一意制約で防ぐ。
- 受領後の訂正は同じ受領者への差分台帳として反映する。
- Accountsの紐付けや公開許可が変更されても既受領FIXを巻き戻さない。

## 8. Points–Markets OAuth

### 8.1 ユーザー対応と同意

Marketsは独立アカウントを持ち、利用者がログイン後にADMIN登録済みのPoints互換提供先へ個別に明示linkする。有効な対応は提供先ごとに1対1である。

- 1 Marketsユーザーと1提供先につき1 Points subject
- 1提供先のPoints subjectにつき1 Marketsユーザー
- email、Google ID、GitHub IDでは対応付けない。
- 全予約が`CAPTURED`、`RELEASED`、`EXPIRED`のいずれかになるまで通常unlinkできない。`REAUTH_REQUIRED`の再認可は既存connection IDと予約参照を維持して行う。
- unlink後の新規reserveは禁止する。
- unlink前に作成した予約は、MarketsのM2M権限でcapture、release、status取得できる。
- unlink履歴は削除しない。

通常unlinkはMarketsのlocal rowだけを変更しない。Marketsが利用者用Client IDの専用Authorization Code + PKCE flowで`points.connection.unlink`を要求し、Pointsが15分以内のGoogle freshと対象連携を確認して一回限りのunlink authorizationを発行する。Markets BFFはそれを使ってPointsのconnection deactivation APIを呼ぶ。Pointsは同じD1原子処理でACTIVE reservationが0件であることを再確認し、app-owned grantを`UNLINKED`へ進め、標準OAuth consent／token family失効用outboxと監査eventを作る。Resource middlewareは各user requestでapp-owned grantのstatusとversionを再取得するため、標準OAuth tokenの物理失効が遅れても新規balance read／reserveを直ちに拒否する。MarketsはPointsの成功receiptを保存した後だけlocal connectionを`UNLINKED`にする。通信失敗時は同じidempotency keyでPointsの同じreceiptへ収束させる。

revocation outboxはBetter Authの公開されたconsent削除／RFC 7009 revocation APIだけを呼び、Better Auth内部tableを直接UPDATEしない。Better Auth 1.7.6でapp-owned transactionへ参加できる公開APIが確認できた場合だけ同一transaction化を再検討する。app-owned grantが認可の正本なので、outbox retry中もuser resource accessは復活しない。

利用者がprovider側でgrantを外部失効させた場合は通常unlinkと区別する。Pointsのapp-owned grantを`REAUTH_REQUIRED`へ進め、ACTIVE reservationの有無にかかわらず新規user操作を拒否するが、既存reservationはreservationを作成したMarkets Client IDのM2M tokenでstatus／capture／releaseを継続できる。

初回とscope追加時にはPoints側で明示的な同意画面を表示する。同意画面では、残高参照、ポイント予約、落札時の予約確定／解放、オフライン利用を説明する。

### 8.2 Authorization Code flow

各接続先のissuerは登録したoriginと一致させる（Freeism Pointsでは`https://points.freeism.app`）。MarketsはOIDC、OAuth Authorization Server、Protected Resourceのdiscoveryを行い、authorization／token／JWKS endpointが同じoriginに属することを確認する。OAuth処理にはdiscoveryで検証したendpointを使う。Task 6Aのlive feasibility gateで標準実装との一致を検証する。

1. Marketsがstate、nonce、PKCE verifier／challengeを生成し、Markets SessionとMarkets userへserver-sideで束縛する。
2. Markets WorkerがM2M用Client CredentialsでPointsのlink-attempt APIを呼び、利用者用／M2M用Client ID、`marketsUserId`、state hash、PKCE challenge、redirect URI、scope、期限へ束縛したopaque `linkAttemptId`を取得する。
3. browser authorization requestは`linkAttemptId`だけを渡し、Pointsはapp-owned attemptを再取得する。request bodyの`marketsUserId`を信用しない。
4. PointsでGoogle fresh認証を確認し、利用者がscopeを承認する。
5. Pointsは標準OAuth開始前のapp-owned D1 transactionで、利用者用Client ID＋Markets userと利用者用Client ID＋Points userの1対1 uniqueを検査し、app-owned grantを`PENDING_MARKETS_CONFIRMATION`でattemptへ束縛する。競合loserは標準authorizationへ進めない。
6. Better Auth標準Authorization Code flowを実行し、Markets WorkerがCodeをTokenへ交換する。Authorization Code／token family発行をapp-owned transactionへ参加させない。この時点でもapp-owned grantはpendingで、Resource APIは使用できない。
7. Marketsは署名検証済み利用者JWTのissuer／subject／Client IDとTokenをlocal connectionへ`PENDING`で原子的に保存してから、M2M用Client Credentialsでそれらを渡してlink-attempt finalizationを`CONFIRM`する。Pointsは期待issuer、利用者用Client、attemptを照合し、connectionへClient IDとsubjectを保存してgrantを`ACTIVE`へ進める。Marketsはreceipt取得後だけlocal rowを`ACTIVE`へ進める。
8. local保存、標準authorization、Token交換、finalizationの途中で失敗またはcrashした場合は、明示`CANCEL`または10分のattempt TTL reaperが新attemptのapp-owned grantを`CANCELLED`へ進め、live status検査で拒否する。TTL reaperはraw tokenを持たないためtoken family完全失効を扱わない。Marketsがraw tokenを保持済みの場合だけRFC 7009 revocationをbest-effort outboxへ入れ、未知tokenは自然失効に任せる。既存connectionを変更せず、Better Auth内部tableを直接操作しない。

Authorization Codeは一回限りとし、PKCE S256、state、nonce、issuer、redirect URI、resourceを検証する。OAuth Clientはログイン中の登録者が「開発者向け」画面で管理する。

#### 8.2.1 browser return先

link、unlink、relinkのOAuth stateへ、利用者入力の任意URLを保存しない。Marketsはflow種別だけをserver-side stateへ保存し、callback完了後の相対pathを次のallowlistから組み立てる。

| Flow                                   | 許可するreturn path                          | 許可query                                           |
| -------------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Points connection link／unlink／relink | `/settings/points-connection`                | なし。結果codeはserver-side flash stateから表示する |

内部関数にも`returnTo`引数を設けず、flow種別から上表のpathを組み立てる。requestにscheme／host／userinfo／fragment、`//`開始、rawまたはpercent-encoded backslash、control文字、二重decodeでpath separatorへ変わる値、queryが含まれていても保存・fallbackしない。callbackはstateから組み立てたpathだけへ`303`し、request queryやOAuth providerの値をredirect先として使わない。

Points互換提供先は標準JWT Access Tokenを発行する。利用者委任Tokenの`sub`は提供先のauth user ID、Client Credentials Tokenの`sub`はClient IDとする。どちらも有効期間は最長15分。Marketsは登録済み`providerId + sub`を連携キーとして保存し、検証済みissuerが登録済み提供先と一致することを確認する。emailや表示名では照合しない。

Points Resource APIはBetter Auth標準JWKSでJWT署名を検証し、issuer、Points API audience、期限、Client ID、required scope、OAuth Clientの有効状態を確認する。利用者TokenにはPoints userのACTIVE状態と利用者用scope、M2M Tokenには`sub=clientId`とM2M専用scopeを要求する。別resourceのTokenやscope混在を拒否する。Marketsは登録した提供先originへ外部`fetch`で要求する。

MarketsのToken取得・introspection・revokeは登録済み公開JWKSに対応する秘密鍵で署名した`private_key_jwt`とDPoPを使う。提供先ごとの秘密鍵は`POINTS_KEY_ENCRYPTION_KEY`で暗号化してMarkets D1に保存する。Marketsの各OAuth callbackはflowごとのresource、scope、Refresh Token有無を確認する。

### 8.3 開発者向けOAuthクライアント管理

Pointsへログインした利用者は「開発者向け」画面から自分のアプリを登録・更新・削除できる。Markets ADMINは各接続先でクライアントを登録する。入力と管理方法は[Accounts v0.1 のOAuthクライアント管理](../../../projects/accounts-web-app/docs/specification/v0.1/main.ja.md#oauthクライアント管理)を採用する。アプリ名、1件以上のリダイレクトURL、`private_key_jwt`用の公開JWKSを必須とし、HTTPSの紹介URLと説明文は任意とする。説明文は`oauthClient.metadata.description`へ保存する。Client IDはPointsが発行し、秘密鍵は利用側だけが保管する。

リダイレクトURLはHTTPS、または`localhost`、`127.0.0.1`、`[::1]`のHTTPを許可する。ローカルHTTPを含むとき`application_type=native`、それ以外は`web`とする。認可時は登録済みURLの1件と文字列で完全一致させ、ローカルHTTPではポートだけを比較から除く。1人最大5件とし、画面とバックエンドで確認する。登録は`adminCreateOAuthClient`、アプリ情報・redirect URIの更新は`adminUpdateOAuthClient`を使う。公開鍵の更新、紹介URLの削除、鍵切替時の新旧`kid`併存、登録者本人だけの変更・削除はAccounts v0.1と同じ手順とする。

Markets用クライアントは接続先ごとに登録し、`authorization_code`、`refresh_token`、`client_credentials`を許可する。利用者とM2Mのscope、Points API resource、link・unlinkのredirect URI 2件を登録する。Marketsは接続先ごとのClient IDと暗号化したEd25519鍵を使う。JWT client assertionは`iss=sub=clientId`、`aud=対象endpointの絶対URL`、約60秒の`iat`/`exp`、ランダムな`jti`で署名する。

| 用途 | grant | scope・検査 |
| --- | --- | --- |
| 利用者委任 | `authorization_code`、`refresh_token` | `openid profile offline_access`、`points.connection.read`、`points.balance.read`、`points.reservations.create`。unlinkは専用認可で`points.connection.unlink`だけを要求する。 |
| M2M | `client_credentials` | `points.connection.link-attempt.create`、`points.connection.link-attempt.finalize`、`points.packages.auction-eligibility`、`points.reservations.status`、`points.reservations.capture`、`points.reservations.release`。scope指定とPoints API resource 1件を必須とする。 |

利用者Tokenではcapture／releaseできず、M2M Tokenでは残高参照・新規reserve・直接debitできない。M2Mは同じClient IDが所有する既存予約のstatus／capture／releaseを実行する。Marketsの利用者callbackはPoints API resourceと利用者scopeを検証する。

Settlement手動再試行ではMarketsのBetter Auth sessionに`admin` roleを含むことを確認する。Marketsはseller、対象Settlementの状態、理由、1時間5回の上限と冪等性を確認する。同じMarkets SessionのCSRF保護付き`POST /api/settlements/{settlementId}/retry`がoutboxを確定し、commit後にdispatcherがWorkflowを起動する。

### 8.4 Token保存とRefresh

- PointsのAccess／Refresh TokenはMarkets D1のBetter Auth Accountへ暗号化保存する。
- Points TokenをMarketsのCookie、ブラウザJavaScript、`localStorage`へ返さない。
- MarketsのブラウザにはMarkets Session Cookieだけを保存する。
- MarketsのOAuth Client秘密JWK、Better Authのversioned secretsは各利用側の環境別Workers Secretsに保存する。公開JWKSだけをPointsに登録する。
- Better Authのversioned secretsは先頭をcurrent encrypt secret、残りを旧decrypt-only secretとする。新規保存、Token refresh、再連携等の次回writeでcurrent versionへ収束させる。独自read時lazy rewrapや独自ciphertext件数reconciliationを追加せず、旧secretのretireは標準rotation手順と回帰testに従う。
- Access Token期限切れ時は保存済みRefresh Tokenで更新し、新しいAccess／Refresh Tokenを暗号化して置換する。
- 401時の明示Refreshと再試行は1回だけとし、失敗時は再連携を要求する。
- Refresh Token Rotationの同時実行は、Markets Account単位のD1 lease／CASでsingle-flight化する。
- 同じRefresh Tokenを並列使用しない。
- Token、Cookie、Authorization Code、OAuth Client秘密鍵をログへ出さない。

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

close後に同じ永久OAuth主体でloginした場合、認証callbackは新しいPoints userを作らず元の`pointsUserId`へCLOSED sessionを結び付ける。callbackだけで公開状態へ戻さず、利用者へ再開画面を表示する。Google freshを伴う明示POSTで`CLOSED -> ACTIVE`へ進め、Sessionを再rotateし、監査eventを追加する。匿名化済みのPoints表示名、説明、画像は、利用者が再設定する。外部URLの管理・提供条件は[Accounts v0.1仕様](../../../projects/accounts-web-app/docs/specification/v0.1/main.ja.md)を参照する。FIX、claim、ledger、残高、永久主体対応は同じuserに残す。

## 11. バージョンと本番Gate

- Better Auth関連packageはPointsとMarketsでexact `1.7.6`に固定する。
- Google／GitHub login、明示link、fresh認証、OAuth Client管理、JWT Access Token、Client Credentials、Token暗号化、Refresh Rotationをstagingで確認する。

## 12. Rate Limit

Rate Limitは不正利用の抑止に使用するが、Account一意性、FIX二重受領などの正確性はD1の状態・一意制約で保証する。

| 操作                     | v0.2初期値                                 |
| ------------------------ | ------------------------------------------ |
| Google／GitHub OAuth開始 | Better AuthのD1 rate limit＋Cloudflare WAF |
| Points–Markets link開始  | user単位のD1 rate limit＋WAF               |
| Accounts連携開始         | user単位のD1 rate limit（1時間10回）       |

## 13. 監査event

少なくとも次をappend-onlyで記録する。

- Google／GitHub loginの成功・拒否
- Social Account linkの成功・拒否
- Google fresh認証の成功・拒否と時刻
- Points–Markets link、unlink、relink、scope同意
- Accountsとの情報連携・解除、照合の成功・拒否
- 未受領FIX claim
- OAuth Client／公開鍵／署名鍵変更
- Refresh失敗、Token class／scope拒否
- Account close・再開

Token、Cookie、Authorization Code、OAuth Client秘密鍵、CSV本文、取得したWebページ本文は監査eventへ記録しない。

## 14. 必須テスト

### 14.1 Pointsログイン・Account link

- ログイン画面と連携画面の双方にGoogle・GitHubだけが表示される。
- GoogleとGitHubの新規ログイン・既存Accountログインが成功する。
- email/password、Apple、未設定Providerを利用できない。
- 同じemail・異なるGoogle `sub`またはGitHub IDを暗黙linkしない。
- 異なるemailのGoogle／GitHub Accountをログイン済みユーザーへ明示linkできる。
- Task 1でBetter Auth標準Accountの既存Account再利用を検査し、Task 9でapp-owned永久対応の複合一意制約、競合、close後の再開を検査する。
- Provider Accountが別ユーザーに属する場合、メール一致で統合しない。
- link時にPointsの名前、メール、画像を上書きしない。
- GitHub email欠落時の予約ドメイン値を本人識別・通知・link判定に使わない。
- Social OAuth Tokenが`account.encryptOAuthTokens: true`によりD1上で暗号化され、Account Cookie・ブラウザへ出ず、versioned secret rotation後のrefresh／再連携でcurrent versionへ収束する。

### 14.2 Pointsログイン用の永久対応

- 別Pointsユーザーが同じログイン用GitHub Accountをlinkできない。
- Account close後の同一OAuth主体ログインが元のPointsユーザーへ戻り、新規空ユーザーを作らない。
- Accountsとの情報連携の変更後も、Pointsのログイン用主体対応と受領済み経済記録が保持される。

### 14.3 Google fresh認証

- `auth_time`が14分59秒なら許可し、15分を超えた場合は拒否する。
- Better Auth SessionだけfreshでもGoogle `auth_time`が古ければ拒否する。
- 別Google `sub`、email一致、未検証ID Token、署名・issuer・audience・nonce不正を拒否する。
- 成功時にSession IDをローテーションする。
- GitHubだけのユーザーはGoogle linkとstep-up完了前に重要操作を実行できない。
- 再認証中に確認対象が変化した場合、古い確認を破棄する。

### 14.4 Accounts照合・未受領FIX

- Pointsへの提供を許可されたアカウントだけを照合し、本人の操作中以外でも許可済み情報を利用できる。
- 正負未受領FIXを選択不可・全件原子的にclaimする。
- 同じFIX Revisionを二重claimできない。
- claim途中失敗で全件rollbackする。
- Accountsの紐付けや公開許可の変更後も既受領FIXが移動しない。
- 外部アカウントの証明・検証のテスト要件は[Accounts v0.1仕様](../../../projects/accounts-web-app/docs/specification/v0.1/main.ja.md)に従い、Accounts側で検証する。

### 14.5 Points–Markets OAuth

- 開発者画面とAPIで必須項目、HTTPS紹介URL、1件以上のredirect URI、ローカルHTTPと`application_type`、登録者の所有権、5件上限を検証する。
- 登録には`adminCreateOAuthClient`、更新には`adminUpdateOAuthClient`を使用し、公開鍵更新と紹介URL削除をAccounts v0.1と同じ規則で検証する。
- `private_key_jwt`で登録済みの公開JWKSに対応する秘密鍵だけがtoken／introspection／revokeを呼べる。鍵更新はcurrentとnext公開鍵の併存、Markets秘密鍵切替、旧公開鍵削除の順に行う。
- state、nonce、redirect URI、PKCE verifier、Authorization Code再利用の不正を拒否する。ローカルHTTP redirectはポートだけを一致条件から除く。
- JWT Access Tokenは標準JWKS署名、issuer、audience/resource、期限、`client_id`、scope、OAuth Client状態を検証する。利用者の`sub`はPoints auth user ID、M2Mの`sub`はClient IDである。
- 利用者Tokenでcapture／releaseできず、M2M Tokenで残高取得・新規reserve・直接debitができない。M2M発行時はscope必須、M2M scopeのみ、Points API resource 1件を強制する。
- 予約所有Client IDと異なるM2M Tokenではsettleできない。Client削除後のTokenもResource APIで拒否する。
- Settlement retryはMarketsの`admin` role、seller、対象状態、理由、頻度、冪等性を検証する。
- 提供先ごとに1 Marketsユーザー対1 Points subject、1 Points subject対1 Marketsユーザーを強制し、CONFIRMでissuer／subject／Client IDをattemptへ照合する。
- cancel／TTLはapp-owned grantをlive拒否し、raw token保持時だけ標準revokeを試みる。
- 有効予約中のunlink・relinkを拒否する。unlink後の新規reserveを拒否し、既存予約のcapture／release／statusを許可する。
- Access／Refresh Tokenをブラウザーへ返さず、Markets D1で暗号化する。401後のRefresh・再試行は最大1回とする。
- 外部Points APIへのBearer Tokenなし要求、不正署名、不正scope、不正audienceを拒否する。

### 14.6 Cookie・CSRF・環境分離

- Points CookieがMarketsへ、Markets CookieがPointsへ送信されない。
- stagingのCookie、OAuth Client、issuer、audience、Secretをproductionが拒否する。
- 不正Origin、CSRF state、Fetch Metadataを拒否する。
- 認証済みレスポンスに`Cache-Control: private, no-store`が付く。
- credential付きwildcard CORSを返さない。

### 14.7 Rate Limit

- OAuth開始、Points–Markets link開始の各limitをActor／resource単位で適用する。
- Cloudflareの近似Rate Limitがずれても、D1の一意制約が破られない。

### 14.8 Release回帰

- PointsのBetter Auth 1.7.6でGoogle／GitHub login、明示link、fresh認証、Token暗号化、OAuth Provider、JWT Access Token、private_key_jwt、Refresh Rotation、Client Credentials、resource-bound Token、MarketsのBetter Auth 1.7.6でGoogle loginと明示Points連携の全テストが成功する。
- 上記テストが未完了の場合はProduction releaseを許可しない。