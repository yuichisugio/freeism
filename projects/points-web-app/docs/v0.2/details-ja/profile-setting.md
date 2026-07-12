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

- GoogleとGitHubを同じProvider一覧から明示linkできる。
- 同じ一覧をログイン画面にも表示し、provider別link-onlyの独自hookを使わない。
- メール一致で自動linkしない。異なるメールの明示linkを許可する。
- Googleは重要操作のstep-upに必要であり、物理unlinkできない。
- GitHub Accountの永久対応を保持し、UIでは物理unlinkではなく「GitHub所有権利用を無効化」を提供する。
- 別ユーザーとして作成済みのProvider accountを自動mergeしない。

## 3. 汎用Web URL

- 最大30件を登録できる。
- URL追加だけでは検証済みにしない。利用者が検証を実行し、外部ページの許可されたlinkとcanonical PointsプロフィールURLが正規化後に完全一致した時だけ自動承認する。
- method、ACTIVE/INACTIVE/LAPSED、検証日時、次回検証、ownership epochを表示する。
- 手動審査、nonce入力、例外承認は表示しない。

## 4. 公開表示

- 公開プロフィールURLは`/profiles/{pointsUserId}`。
- 自分のプロフィールだけに編集ボタンを表示する。
- ACTIVEで公開許可された外部identity、公式パッケージ、残高、履歴だけを表示する。
- 公式Packageはprofileの`displayOrder`で返し、現在の公開revisionへのlinkと不変Package IDを示す。
- FIX・譲渡履歴は対応する評価軸フラグが`PUBLIC`の時だけ返す。交換履歴はsourceとtarget両方の`exchangeHistoryVisibility` が`PUBLIC`の時だけ返し、非公開軸のIDや額を反対軸から推測できる部分表示を行わない。
- 非公開プロフィールは検索へ出さず、直接アクセスでも存在を開示しない。
- closed accountは匿名化し、経済履歴の整合性に必要な不変IDだけを証明画面で表示できる。

## 5. 重要操作

次は15分以内のGoogle fresh sessionを要求する。

- Google/GitHubの明示link、GitHub所有権利用の無効化・再有効化
- Points–Markets link/unlink/relink
- account close
- profileまたは評価軸別設定の`PRIVATE -> PUBLIC`を含む公開範囲拡大
- ADMIN、FIX、評価軸、パッケージ、OAuth clientに関する管理操作

GitHubだけで作成したユーザーが重要操作を始める場合、同じsessionからGoogleを明示linkし、署名済みID Tokenの`sub`、`nonce`、`iss`、`aud`、`auth_time`を検証できた時だけstep-upを成立させる。

## 6. Account closeと再開

> 本節のclose中FIX保留、永久ownership再有効化、`reopenSetHash`、正負一括claim、汎用Web非復元はDEC-261の承認対象であり、`採用`へ変わるまで実装しない。

- `POST /api/account/close`はGoogle freshを要求し、ACTIVE reservationが1件でもあれば`409 ACCOUNT_CLOSE_ACTIVE_RESERVATION`、対象が最後のADMINなら`409 ACCOUNT_CLOSE_LAST_ADMIN`で何も変更しない。
- closeはSessionとconsentを失効し公開属性を匿名化するが、不変`pointsUserId`、経済台帳、残高、永久OAuth主体対応を削除しない。永久OAuth主体のownership利用は`INACTIVE`へ進め、close中に到着した正負の新規FIXをledgerへ入れず未受領で保留する。
- close時にACTIVEだった汎用Web URLのownership epochはclose時刻を`endedAt`として終了する。reopenだけでは戻さず、後日同じURLを使う場合も所有権の再検証と新しいepochを必須とする。
- close後に同じ永久GoogleまたはGitHub主体がloginしたcallbackは、新しいPoints userを作らず元の`pointsUserId`へ操作制限付きCLOSED sessionを結び、`/account/reopen`だけへ導く。callback GETだけでは状態、ownership、ledgerを変更しない。
- 再開画面は永久OAuth主体に帰属できる未受領FIXの評価軸別正味合計、正件数、負件数、全件数と`reopenSetHash`を表示する。行または符号の選択は許さない。
- `POST /api/account/reopen`はGoogle freshと直前previewの`reopenSetHash`を要求する。serverが同じD1原子処理で集合hashを再計算し、`CLOSED -> ACTIVE`、close時に停止した永久OAuth ownershipの再有効化、正負全件のclaimと差分ledger、Session rotation、auditを全件成功または0件で確定する。集合変化は`409 REOPEN_SET_CHANGED`としCLOSEDを維持する。
- 再開は匿名化済みの表示名、説明、画像、汎用Web URLを自動復元しない。負の保留FIXで残高が負になっても再開とclaimは成功させ、後続の消費系操作を拒否する。

## 7. 多言語とaccessibility

- 日本語と英語を提供する。browser言語が日本語なら日本語、それ以外は英語を既定にする。
- link状態はiconや色だけでなくtextでも示す。
- confirm、error、toastはkeyboardとscreen readerで判別できる。
- Social Providerから得た表示名・画像・URLを未escape HTMLとしてrenderしない。

## 8. 必須テスト

- 本人だけが編集できる
- 100/500文字、URL30件、Packageの0件・複数登録・重複拒否・登録解除・並べ替え・再送
- profileおよび評価軸ごとの`balance`、`evaluationTotal`、FIX・譲渡・交換履歴の独立した公開/非公開
- 公開範囲の拡大だけGoogle fresh必須、縮小とPackage並べ替えは通常sessionで成功
- 非公開軸を交換履歴の反対側から推測できない
- Google/GitHub login/link、メール暗黙link拒否
- GitHub-onlyユーザーのGoogle step-up導線
- GitHub ownership無効化後もAccount永久対応を保持
- inactive/lapsed URLをpublicに検証済み表示しない
- ACTIVE reservationがあるcloseの`ACCOUNT_CLOSE_ACTIVE_RESERVATION`、最後ADMINの`ACCOUNT_CLOSE_LAST_ADMIN`
- closedプロフィールの匿名化と台帳参照維持、close中の正負FIX保留、同一OAuth主体callbackで新user 0件
- callback GETでCLOSED維持、Google fresh後の明示reopenで正負全件一括claim、集合変化時は再開拒否
- close時のWeb epoch終了と、reopen後も所有権再検証なしで復活しないこと
