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

外部アカウントの所有権証明・公開設定は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.ja.md)を正本とする。

## 3. Accountsとの情報連携

Points利用者は、別サービスのAccountsで、Pointsへ提供する外部アカウントを選ぶ。この同意は、Pointsの公開プロフィール・公開API・落札証明での公開表示を含む。Accounts自身の一般公開設定とは独立した許可として扱う。Pointsは連携した各AccountsサービスのAPIから連携アカウント一覧を取得する。Pointsの設定画面には、複数のAccountsユーザーとの連携一覧を表示し、提供元AccountsサービスとAccounts ID、各連携状態、取得した外部アカウント一覧、各Accounts管理画面への導線を示す。

外部Web URLの登録・リンク検証・紐付け解除、Accountsの公開プロフィールと公開先ごとの設定は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.ja.md)に従う。Points内のユーザー連携は本節を正本とする。連携解除・再連携が未受領FIXへ与える影響は[未受領FIXとAccounts連携](unclaimed-fix-and-ownership.md)の未決事項として扱う。

### 3.1 接続先Accountsサービスの管理

- Pointsの運営者が、接続対象とするAccounts互換サービスのURLと、その接続先に登録したOAuthクライアントのClient ID・Client Secretを設定する。Client SecretはPointsのバックエンドで管理する。
- 利用者は、運営者が接続設定を用意したAccountsサービスの一覧から選び、本人の認証・情報提供への同意を経て連携する。
- 別のURLへ切り替える場合は、新しい接続先として追加する。利用者は新しい接続先で認証・同意して連携し、旧接続先のユーザー連携は、その接続先を取り下げるまで維持する。
- 運営者が接続先を取り下げると、そのAccountsサービスに対する既存のPointsユーザーとAccountsユーザーの対応をすべて解除し、PointsからのAPI利用を終了する。Accounts側の公開設定・情報提供同意と、Pointsで確定済みの貢献・ポイントの帰属を維持する。
- 接続先の設定・切り替え・取り下げと、Points内のユーザー連携の管理はPointsの責務とする。Accountsが提供する認証・外部アカウント情報・照合APIの条件は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.ja.md)に従う。

### 3.2 ユーザー連携の件数と識別

- PointsユーザーIDはPointsが管理し、Accountsユーザーは提供元AccountsサービスとAccountsユーザーIDの組み合わせで区別する。
- 同じPointsサービス内では、1つのPointsユーザーへ複数のAccountsユーザーを連携できる。各Accountsユーザーの連携先は、そのPointsサービス内で最大1つのPointsユーザーとする。
- 同じAccountsサービス内の複数ユーザーと、別々のAccountsサービスのユーザーを連携対象にできる。
- 同じAccountsユーザーを別々のPointsサービスへ連携でき、各Pointsサービスへの情報提供にそれぞれ同意する。

### 3.3 利用開始と連携先ユーザーの変更

Accountsで先に登録・外部アカウントの連携を済ませた利用者と、PointsからAccountsの利用を始める利用者の両方が、次の手順で連携できる。

1. Pointsへログインし、「利用する」から設定画面へ進む。
2. 「アカウント紐付け先を選択」から、運営者が接続対象として用意したAccountsサービスの一覧を開く。
3. 自分が利用するAccountsサービスを選び、Accountsへログインする。アカウントがなければ新規作成する。
4. Accountsで、貢献の識別に使う外部アカウントを連携する。
5. Pointsへ提供するアカウントと利用目的を確認して同意する。
6. Pointsへ戻り、Accountsの[クライアント認証と権限](../../../../accounts-web-app/docs/specification/v0.1/main.ja.md#クライアント認証と権限)に従ってID Tokenと開始した連携操作を検証し、ログイン中のPointsユーザーとの対応を保存する。貢献・ポイントの処理は[未受領FIXとAccounts連携](unclaimed-fix-and-ownership.md)に従う。
7. Pointsの設定・プロフィールに、連携した各AccountsサービスとAccountsユーザーのプロフィールへのリンクを表示する。プロフィール上の表示は[公開表示](#4-公開表示)の条件に従う。

同じ手順を繰り返して別のAccountsユーザーを追加できる。追加するAccountsユーザーごとに本人が認証し、情報提供へ同意する。同じPointsサービス内ですでに別のPointsユーザーへ連携済みの場合は、現在の連携状態を案内する。

同じAccountsユーザーの連携先を同じPointsサービス内の別のPointsユーザーへ変更する場合は、元のPointsユーザーへログインして連携を解除した後、移動先のPointsユーザーへログインして再連携する。再連携ではAccountsでの本人確認と情報提供への同意を行い、[ユーザー連携の件数と識別](#32-ユーザー連携の件数と識別)の一意性を確認する。

Pointsに外部アカウントを登録済みの利用者も、Accountsへ切り替える際はAccountsで外部アカウントを新しく登録し、所有権を証明して公開先を設定する。Pointsの貢献データ・ポイントはPointsが管理する。

### 3.4 連携解除と退会

- Pointsでの個別の連携解除は、バックエンドで本人の操作権限を確認し、対象のAccountsサービスorigin・AccountsユーザーIDとPointsユーザーの対応を削除して完了する。解除した対応を起点とする一覧取得を終了する。
- 外部識別子の照合でAccountsユーザーIDが返っても、Points内に現在の対応がある場合にだけPointsユーザーへ対応付ける。Accountsの照合結果と、Points内のユーザー対応をそれぞれ確認する。
- Pointsユーザーが退会した場合は、そのPointsユーザーに連携しているすべてのAccountsユーザーとの対応をPoints側で解除する。
- Pointsでの個別解除・退会では、Accounts側のそのPointsへの公開設定と情報提供同意を維持する。情報提供を停止したい本人はAccountsで設定する。以後の一覧取得・照合も、Accounts APIが定める現在の提供条件に従う。
- Accountsユーザーが退会した場合は、Accountsからそのユーザーの情報提供が終了する。Points側に保存した対応は保持し、本人がPointsへログインして解除できる。
- 連携・公開設定・退会による変更後も、Pointsで確定済みの貢献・ポイントの帰属を維持する。未受領FIXへの影響は[未受領FIXとAccounts連携](unclaimed-fix-and-ownership.md#7-未受領fixの帰属に関する未決事項)で定める。

## 4. 公開表示

- 公開プロフィールURLは`/profiles/{pointsUserId}`。
- 自分のプロフィールだけに編集ボタンを表示する。
- Pointsの公開設定に従い、公式パッケージ、残高、履歴を表示する。
- Pointsプロフィールには、Accounts APIから取得したOAuth連携・Webページ検証による連携アカウントの一覧も表示する。外部サービス名、取得できるユーザー名・表示名、固有ID・プロフィールURLなどの識別情報、検証状態・検証方法・検証日時・連携日時のうち、Accountsが提供元ごとに提供する項目に限ってテキストで示す。Pointsへの提供に同意されたアカウントの情報を、Pointsプロフィール自体の公開・非公開に従って表示する。
- 外部アカウントの所有権証明・管理と、Accounts APIが提供する項目の定義は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.ja.md)を参照する。
- Accountsから取得済みの情報の保存、過去の履歴、提供許可の取消後の公開表示はPointsが管理する。取得時点の提供許可と、その後の保存・公開の扱いを区別し、後者の具体的な条件はPoints側で定める。
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
- close時のAccountsとの対応解除とAccounts側の公開設定・情報提供同意の扱いは[連携解除と退会](#34-連携解除と退会)に従う。
- close中に到着した正負の新規FIXは未受領で保留する。
- close後に同じ永久GoogleまたはGitHub主体がloginしたcallbackは元の`pointsUserId`へ操作制限付きCLOSED sessionを結び、`/account/reopen`へ導く。callback GETは状態を閲覧する導線とし、再開は本人の明示操作で確定する。
- 再開画面には、受領資格が確定した未受領FIXの評価軸別正味合計、正件数、負件数、全件数と`reopenSetHash`を表示する。
- `POST /api/account/reopen`はGoogle freshと直前previewの`reopenSetHash`を要求する。serverが同じD1原子処理で集合hashを再計算し、`CLOSED -> ACTIVE`、対象となる正負全件のclaimと差分ledger、Session rotation、auditを全件成功または0件で確定する。集合変化は`409 REOPEN_SET_CHANGED`としCLOSEDを維持する。
- 再開後の表示名・説明は本人が設定する。負の保留FIXで残高が負になっても再開とclaimは成功させ、後続の消費系操作を拒否する。

close・reopen時に受領資格を満たす未受領FIX集合は[未受領FIXとAccounts連携](unclaimed-fix-and-ownership.md)に記載した未決事項を確定してから実装する。

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
- 同一・異なる提供元の複数Accountsユーザーを連携でき、提供元とIDの組み合わせは同じPointsサービス内で1ユーザーにだけ連携できる。別々のPointsサービスでは独立して連携できる
- 連携済みAccountsユーザーの状態を案内し、元のPointsユーザーで解除した後、移動先で本人確認・同意を経て再連携できる
- 個別解除とPoints退会時の全対応解除、Accounts退会時の対応保持と本人による解除、Accounts側の公開設定・同意と確定済み貢献・ポイントの維持を確認する
- Pointsに外部アカウントを登録済みの利用者も、Accountsで新しい登録・証明・公開先設定を完了して連携できる
- 運営者が接続先とOAuthクライアント情報を設定でき、Client Secretをバックエンドで管理したまま利用者が接続先を選んで認証・同意できる
- 新しいURLを別の接続先として追加し、旧接続先のユーザー連携を維持したまま新接続先へ連携できる
- 旧接続先を取り下げると、その接続先への全ユーザー連携とAPI利用が終了し、新接続先への連携、Accounts側の公開設定・情報提供同意、確定済み貢献・ポイントの帰属が維持される
- 設定画面に複数Accountsユーザーとの連携状態・提供元とID・各管理画面への導線を表示し、Pointsプロフィールと設定画面には各Accounts APIから取得したOAuth・Webページ検証の外部アカウント一覧を表示する
- Pointsへの提供に同意した外部アカウントは、Accounts自身の一般公開設定にかかわらず、公開Pointsプロフィール・公開APIでテキスト表示できる
- 各一覧・APIの表示項目はAccountsが提供元ごとに提供する項目と一致する
- Pointsプロフィール自体が非公開の場合は、連携アカウント一覧も公開表示しない
- ACTIVE reservationがあるcloseの`ACCOUNT_CLOSE_ACTIVE_RESERVATION`、最後ADMINの`ACCOUNT_CLOSE_LAST_ADMIN`
- closedプロフィールの匿名化と台帳参照維持、close中の正負FIX保留、同一OAuth主体callbackで新user 0件
- callback GETでCLOSED維持、Google fresh後の明示reopenで正負全件一括claim、集合変化時は再開拒否
- Accounts連携とclose/reopenが未受領FIXの受領資格へ与える影響について、未決要件の確定後に期待結果を定義する
