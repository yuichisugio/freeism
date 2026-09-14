# プロフィール設定

## 1. 基本情報

- 表示名: 1〜100文字
- 説明: 0〜500文字
- プロフィール自体の公開/非公開。初期値は公開
- 公式パッケージ: 0件以上、複数登録・登録解除・並べ替え可能
- 各評価軸の`balance`、`evaluationTotal`、FIX・譲渡・交換履歴の公開設定

不変PointsユーザーID、認証Providerの`providerId + accountId`、経済履歴はこの画面から変更・削除できない。

### 1.1 公式Packageの登録

- profileは公式`pointPackageId`のordered setを持つ。同じPackageの重複登録を許さず、並び順は0始まりの連続した`displayOrder`とする。
- 登録解除はprofileとPackageの関係だけを削除し、Package本体、不変revision、過去のMarkets snapshotを変更しない。
- `PUT /api/profile/point-packages`は並べ替え後の`pointPackageIds[]`全体を受け、本人の現在行を同じD1原子処理で差し替える。存在しないID、重複ID、非本人を拒否し、`Idempotency-Key`再送は同じordered setへ収束させる。
- 登録・登録解除・並べ替えは公開情報の編集であり、通常の認証sessionを必須とするがGoogle freshは要求しない。Package本体の作成・変更は引き続きADMIN + Google freshだけに限定する。

### 1.2 評価軸ごとの公開設定

各`pointsUserId + evaluationCriterionId`に次の5フラグを`PUBLIC | PRIVATE`で保存し、一括フラグに畳み込まない。

- `balanceVisibility`
- `evaluationTotalVisibility`
- `fixHistoryVisibility`
- `transferHistoryVisibility`
- `exchangeHistoryVisibility`

評価軸を初めて参照する時は`balanceVisibility`だけをその評価軸revisionの残高公開初期値から作り、`evaluationTotalVisibility`と履歴3種は`PRIVATE`とする。`PUT /api/profile/evaluation-visibilities/{evaluationCriterionId}`は5フラグの完全な組を受け、本人だけが更新できる。

`PRIVATE -> PUBLIC`を1つでも含む変更、またはprofile全体の`PRIVATE -> PUBLIC`は公開範囲の拡大なので15分以内のGoogle fresh sessionを要求する。`PUBLIC -> PRIVATE`だけの縮小は、情報をすぐ隠せるよう通常の認証sessionで許可する。複数フラグを同時変更するrequestは、1つでも拡大があればrequest全体へGoogle freshを適用する。

## 2. Social Account

Pointsへのログインに使うGoogle/GitHubの認証アカウントを管理する。ログインとsessionはPoints独自に持ち、重要操作はPointsのGoogle freshで確認する。

- GoogleとGitHubを同じProvider一覧から明示linkできる。
- 同じ一覧をログイン画面にも表示する。
- メール一致で自動linkせず、異なるメールの明示linkを許可する。
- Googleは重要操作のstep-upに必要であり、認証手段として保持する。
- 別ユーザーとして作成済みのProvider accountは独立したPointsユーザーとして扱う。
- account close後の本人識別に必要な認証Providerの永久対応を保持する。

外部アカウントの所有権証明・公開設定は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.md)を正本とする。

## 3. Accountsとの情報連携

Points利用者は、別サービスのAccountsで、Pointsへ提供する外部アカウントを選ぶ。この同意は、Pointsの公開プロフィール・公開API・落札証明での公開表示を含む。Accounts自身の一般公開設定とは独立した許可として扱う。PointsはAccounts APIから連携アカウント一覧を取得する。Pointsの設定画面には取得した一覧、Accountsとの連携状態、Accountsの管理画面への導線を表示する。

外部Web URLの登録・リンク検証・紐付け解除、Accountsの公開プロフィールと公開先ごとの設定は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.md)に従う。PointsとAccountsのID対応、連携解除・再連携が未受領FIXへ与える影響は[未受領FIXとAccounts連携](unclaimed-fix-and-ownership.md)の未決事項として扱う。

## 4. 公開表示

- 公開プロフィールURLは`/profiles/{pointsUserId}`。
- 自分のプロフィールだけに編集ボタンを表示する。
- Pointsの公開設定に従い、公式パッケージ、残高、履歴を表示する。
- Pointsプロフィールには、Accounts APIから取得したOAuth連携・Webページ検証による連携アカウントの一覧も表示する。外部サービス名、取得できるユーザー名・表示名、固有ID・プロフィールURLなどの識別情報、検証状態・検証方法・検証日時・連携日時のうち、Accountsが提供元ごとに提供する項目に限ってテキストで示す。Pointsへの提供に同意されたアカウントの情報を、Pointsプロフィール自体の公開・非公開に従って表示する。
- 外部アカウントの所有権証明・管理と、Accounts APIが提供する項目の定義は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.md)を参照する。
- 公式Packageはprofileの`displayOrder`で返し、現在の公開revisionへのlinkと不変Package IDを示す。
- FIX・譲渡履歴は対応する評価軸フラグが`PUBLIC`の時だけ返す。交換履歴はsourceとtarget両方の`exchangeHistoryVisibility` が`PUBLIC`の時だけ返し、非公開軸のIDや額を反対軸から推測できる部分表示を行わない。
- 非公開プロフィールは検索へ出さず、直接アクセスでも存在を開示しない。
- closed accountは匿名化し、経済履歴の整合性に必要な不変IDだけを証明画面で表示できる。

## 5. 重要操作

次は15分以内のGoogle fresh sessionを要求する。

- Pointsのログインに使うGoogle/GitHubの明示link
- Points–Markets link/unlink/relink
- account close
- profileまたは評価軸別設定の`PRIVATE -> PUBLIC`を含む公開範囲拡大
- ADMIN、FIX、評価軸、パッケージ、OAuth clientに関する管理操作

GitHubだけで作成したユーザーが重要操作を始める場合、同じsessionからGoogleを明示linkし、署名済みID Tokenの`sub`、`iss`、`aud`、`auth_time`を検証できた時だけstep-upを成立させる。`nonce`はBetter Auth 1.7正式版の標準対応をstaging live gateで再確認し、独自hookでは補わない。

## 6. Account closeと再開

- `POST /api/account/close`はGoogle freshを要求し、ACTIVE reservationが1件でもあれば`409 ACCOUNT_CLOSE_ACTIVE_RESERVATION`、対象が最後のADMINなら`409 ACCOUNT_CLOSE_LAST_ADMIN`で何も変更しない。
- closeはPointsのSessionとconsentを失効し公開属性を匿名化する。不変`pointsUserId`、経済台帳、残高、Pointsの認証に使う永久OAuth主体対応は保持する。
- close中に到着した正負の新規FIXは未受領で保留する。
- close後に同じ永久GoogleまたはGitHub主体がloginしたcallbackは元の`pointsUserId`へ操作制限付きCLOSED sessionを結び、`/account/reopen`へ導く。callback GETは状態を閲覧する導線とし、再開は本人の明示操作で確定する。
- 再開画面には、受領資格が確定した未受領FIXの評価軸別正味合計、正件数、負件数、全件数と`reopenSetHash`を表示する。
- `POST /api/account/reopen`はGoogle freshと直前previewの`reopenSetHash`を要求する。serverが同じD1原子処理で集合hashを再計算し、`CLOSED -> ACTIVE`、対象となる正負全件のclaimと差分ledger、Session rotation、auditを全件成功または0件で確定する。集合変化は`409 REOPEN_SET_CHANGED`としCLOSEDを維持する。
- 再開後の表示名・説明は本人が設定する。負の保留FIXで残高が負になっても再開とclaimは成功させ、後続の消費系操作を拒否する。

close・reopen時のAccounts連携・公開許可の扱い、および受領資格を満たす未受領FIX集合は[未受領FIXとAccounts連携](unclaimed-fix-and-ownership.md)に記載した未決事項を確定してから実装する。

## 7. 多言語とaccessibility

- 日本語と英語を提供する。browser言語が日本語なら日本語、それ以外は英語を既定にする。
- link状態はiconや色だけでなくtextでも示す。
- confirm、error、toastはkeyboardとscreen readerで判別できる。
- 認証Providerから得た表示名などのテキストはescapeしてrenderする。

## 8. 必須テスト

- 本人だけが編集できる
- 100/500文字、Packageの0件・複数登録・重複拒否・登録解除・並べ替え・再送
- profileおよび評価軸ごとの`balance`、`evaluationTotal`、FIX・譲渡・交換履歴の独立した公開/非公開
- 公開範囲の拡大だけGoogle fresh必須、縮小とPackage並べ替えは通常sessionで成功
- 非公開軸を交換履歴の反対側から推測できない
- Google/GitHub login/link、メール暗黙link拒否
- GitHub-onlyユーザーのGoogle step-up導線
- Pointsの認証Provider対応とAccounts連携を独立して管理する
- Pointsプロフィールと設定画面に、Accounts APIから取得したOAuth・Webページ検証の連携アカウント一覧を表示する
- Pointsへの提供に同意した外部アカウントは、Accounts自身の一般公開設定にかかわらず、公開Pointsプロフィール・公開APIでテキスト表示できる
- 各一覧・APIの表示項目はAccountsが提供元ごとに提供する項目と一致する
- Pointsプロフィール自体が非公開の場合は、連携アカウント一覧も公開表示しない
- ACTIVE reservationがあるcloseの`ACCOUNT_CLOSE_ACTIVE_RESERVATION`、最後ADMINの`ACCOUNT_CLOSE_LAST_ADMIN`
- closedプロフィールの匿名化と台帳参照維持、close中の正負FIX保留、同一OAuth主体callbackで新user 0件
- callback GETでCLOSED維持、Google fresh後の明示reopenで正負全件一括claim、集合変化時は再開拒否
- Accounts連携とclose/reopenの受領資格について、未決要件の確定後に期待結果を定義する
