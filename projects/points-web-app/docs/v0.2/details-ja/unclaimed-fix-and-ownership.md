# 未受領FIXとAccounts連携

## 1. 目的

Pointsに未登録の貢献者にも先にFIX結果を記録し、後から本人がPointsへ登録し、Accounts連携によって受領対象が確定した時にポイントを受け取れるようにする。

FIX revisionへ入力された貢献者識別子、Accountsから取得できた照合結果、符号付き評価額を保存し、受領対象が確定した後にPointsユーザーの台帳・残高・`evaluationTotal`へ反映する。CSVで指定する識別子の列と形式は[FIX取込時の照合](#6-fix取込時の照合)で定める。

## 2. Accountsとの責務境界

外部アカウントの登録・所有権証明・紐付け・解除・公開設定・公開プロフィール・照合APIは、[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.ja.md)を正本とする。

Pointsは独自のGoogle/GitHubログインとsessionを持ち、Points利用者が別サービスのAccountsへ情報連携を許可する。Pointsはクライアントとして許可された外部アカウントを照合し、取得したAccounts IDをPointsの受領者へ対応付けて、FIX・未受領FIX・claimを管理する。照合は接続先ごとのClient Credentialsで行うため、本人がPointsを操作していない時にも行える。

接続先の管理、PointsユーザーとAccountsユーザーの対応件数・一意性、利用開始・再連携・解除・退会の操作は、[プロフィール設定のAccountsとの情報連携](profile-setting.md#3-accountsとの情報連携)を正本とする。

CSV取込、FIX、未受領分の受領、ポイント台帳・残高、パッケージ、経済履歴とそれらの公開設定はPointsが管理する。Marketsなどへ経済情報・操作権限を提供するOAuth資源APIもPointsの責務とし、[Points–Markets契約](../../../../../docs/web-app/v0.2/points-markets-contract.md)に従う。

未受領FIXの受領資格は[未受領FIXの受領資格](#7-未受領fixの受領資格)で定める。

## 3. Pointsが保存する経済データ

### `unclaimedFixEntry`

- `sourceFixRevisionId`
- 入力した識別子の種類（`url`または`accounts_user`）と値（入力値そのまま）
- 照合した接続先のorigin、照合結果のAccountsユーザーID（`matched`の時だけ）、照合時刻
- 評価軸IDと評価軸revision ID
- 評価時刻
- 符号付きscale済みamount

未受領エントリーは`sourceFixRevisionId`、origin、識別子の種類と値、評価軸IDの組で一意とする。同じ識別子でも、接続先が異なれば別の対象者として扱う。

### `fixClaim`

- 受領者と、受領時点の連携先（origin・AccountsユーザーID）のsnapshot
- claim対象集合hash、件数
- `claimedAt`、request id、idempotency key
- 受領したエントリーと、作成した台帳行の対応（`fixClaimItem`）

受領コマンド（`fixClaimCommand`）も同じ連携先のsnapshotを持つ。連携先は外部キーにせず、連携の解除後も経済履歴として残す。

## 4. URL正規化

照合対象のURL正規化・同値判定は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.ja.md)に従う。PointsはCSVの列・行制約を検査し、Accountsの照合結果を使って受領者を判断する。

## 5. 所有権確認方式

GitHub OAuthによる所有権証明、編集可能Webページのリンク検証、外部ページの安全な取得条件は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.ja.md)に集約する。Pointsの設定画面には、連携先Accountsのアカウント管理への導線を設ける。

## 6. FIX取込時の照合

FIX CSVの各行は、受領者の識別子を`recipientProfileUrl`（外部プロフィールURL）と`recipientAccountsUserId`（AccountsユーザーID）のちょうど一方で指定する。列の順序と上限は[Pointsドメイン仕様](points-domain.md#71-入力)に従う。アップロードする識別子は、本人から共有された情報など、対象者との対応を確認できるものを指定する。

- どちらも空の行は`RECIPIENT_IDENTIFIER_REQUIRED`、両方ある行は`RECIPIENT_IDENTIFIER_AMBIGUOUS`の行エラーとする。URLの正規化・受付制約はAccountsが行い、Pointsは空でないことと長さだけを検査する。
- 照合に使う接続先は、validateとcommitの両方で`X-Accounts-Connection-Id` headerに指定する。未指定は`422 ACCOUNTS_CONNECTION_REQUIRED`、`ACTIVE`でない接続先は`409 ACCOUNTS_CONNECTION_NOT_ACTIVE`とする。
- 行エラーが無い時だけ、Accountsの`QUERY /api/v1/identities/resolve`で照合する。同じ識別子は1回だけ照合し、1,000件ごとに要求を分ける。
- 照合結果は次のとおり扱う。
  - `matched`: 結果のAccountsユーザーIDを保存する。
  - `no_match`: AccountsユーザーIDは保存しない。
  - `invalid_input`: その識別子を持つ行に、識別子の列を示す`RECIPIENT_IDENTIFIER_INVALID`の行エラーを付け、`422 CSV_VALIDATION_FAILED`とする。
- 各行の受領者は次のとおり決める。自動分配と貢献評価代用の集計もこの受領者に基づいて行う。
  - 修正revisionで、旧revisionに同じ対象者（後述の対象者キーと評価軸）の行がある場合は、旧revisionの状態を引き継ぐ。旧revisionの行が台帳反映済み・受領済みなら差分を同じ受領者の台帳へ反映し、受領者が未確定（未受領）なら、今回の照合結果と連携の有無にかかわらず差分も未受領とする。
  - それ以外の行は、`matched`でPoints内に同じoriginとAccountsユーザーIDの連携がある場合だけ、そのPointsユーザーを受領者として台帳へ反映する。`no_match`の行と、連携が無い`matched`の行は未受領とする。
- validateの成功応答は、接続先ID、origin、照合の完了状態、行ごとの照合結果（`MATCHED`・`NO_MATCH`）とPoints内の連携の有無、`validationHash`を返す。`validationHash`には接続先ID、file hash、行ごとのorigin・照合結果・受領者を含める。
- commitはAccountsで再照合して`validationHash`を再計算し、validate時と異なる場合は全件を`409 VALIDATION_CHANGED`で止めて再validateを要求する。Accounts側の紐付けの変更と、Points内の連携の変更の両方をこの比較で検出する。
- Accountsから照合結果を得られない場合（通信失敗、タイムアウト、5xx、制限超過、要求全体の拒否、応答のschema・originの不一致）は、ファイル全体を0件反映とする。
  - validateは`200`で`accountsResolution.status`を`UNAVAILABLE`とし、code `ACCOUNTS_RESOLVE_UNAVAILABLE`と、Accountsの制限超過時は`Retry-After`の値を`retryAfter`に返す。Access Tokenを取り直してもAccountsが`401`を返す場合のcodeは`ACCOUNTS_CLIENT_UNAUTHORIZED`とする。全行を`UNRESOLVED`とし、`validationHash`は`null`とする。照合が正常に完了した`no_match`とはこの応答で区別する。
  - commit時に照合結果を得られない場合は`409 VALIDATION_CHANGED`とする。
- FIX revisionと未受領FIXは、入力した識別子の種類と値、照合した接続先のorigin、照合結果のAccountsユーザーID、照合時刻を不変snapshotとして保持する。修正revisionの対象者は、照合結果ではなく入力識別子で揃える。対象者キーは、識別子の種類と値を照合した接続先のorigin付きで表した`{種類}:{origin}:{値}`とし、URLの値は入力値そのままとする。修正revisionを別の接続先で照合した場合は、旧originの対象者へ旧額を取り消す差分、新originの対象者へ新額の差分を記録するため、各originの差分の合計は最新revisionの額（そのoriginで照合していなければ0）と一致する。
- FIXの保存、差分台帳、未受領FIX、idempotency result、監査はPointsの同じD1原子処理で確定する。監査には照合に使った接続先IDを記録し、識別子の値は記録しない。

## 7. 未受領FIXの受領資格

Accountsは現在の紐付けと公開許可を提供し、紐付けの履歴は提供しない。Pointsは受領時点のAccountsの照合結果を根拠に受領資格を判定する。

- 受領は本人のAccounts連携（origin・AccountsユーザーID）ごとに行う。
- 候補は、同じoriginで照合された、まだ受領されていない未受領FIXとする。
- 候補の識別子を、その時点のAccountsで改めて照合する。要求は1,000件ごとに分ける。結果が`matched`で、AccountsユーザーIDが連携先と一致するものを受領資格ありとする。
- FIXの評価時刻、FIX取込時の照合結果、Pointsとの連携時刻は受領資格の条件にしない。連携前から蓄積した未受領FIXも、受領時点で本人の外部アカウントとして照合されれば受領できる。外部アカウントが別のAccountsユーザーへ移った場合は、受領時点の紐付け先が受領する。
- Accountsで公開許可を取り消した識別子や、Pointsとの連携を解除したAccountsユーザーの未受領FIXは、受領されないまま残る。再許可・再連携の後に受領できる。
- Points account closeでは本人の全連携を削除するため、reopenの受領集合は空になる。詳細は[Account closeと再開](profile-setting.md#6-account-closeと再開)に従う。

外部アカウントの追加・解除・紐付け先変更・公開設定変更やサービス間の連携・退会後も、すでにclaim済みのFIXと確定済みの貢献・ポイントの帰属はPointsの経済履歴として保持する。

## 8. 一括claim

受領は本人の連携ごとに、[受領資格](#7-未受領fixの受領資格)を満たす未claimの正負全件を対象にする。同じ対象者の各revisionの未受領差分はまとめて受領し、受領額は最新revisionの額と一致する。利用者は設定画面`/settings/connections`の「未受領FIX」区画で、連携ごとにpreviewを確認して受領する。

- `GET /api/unclaimed-fixes/claim-preview?accountsLinkId={accountsLinkId}`（session）はread-only previewを返す。previewは`accountsLinkId`、評価軸ごとの正味合計（`netAmountScaled`）・正件数・負件数・全件数、全件数、`claimSetHash`を含み、行や正負を選択するfieldを持たない。`claimSetHash`は対象エントリー集合と連携先のorigin・AccountsユーザーIDから計算する。
- Google fresh認証後にpreviewを再取得し、利用者が一括受領を確認してから、`POST /api/unclaimed-fixes/claims`へ`{ "accountsLinkId", "claimSetHash" }`と`Idempotency-Key`を付けて送る。成功は`201`で`claimId`、`claimedCount`、`claimSetHash`を返す。
- serverはAccountsで再照合して対象集合とhashを再計算し、変化していれば`409 CLAIM_SET_CHANGED`で新しいpreviewを返す。
- 本人の連携でない・存在しない場合は`404 ACCOUNTS_LINK_NOT_FOUND`、previewで`accountsLinkId`が無い場合は`422 ACCOUNTS_LINK_ID_REQUIRED`とする。確定では、対象が0件の場合は`409 NO_UNCLAIMED_FIXES`、同じ`Idempotency-Key`で内容が異なる場合は`409 IDEMPOTENCY_KEY_REUSED`、bodyが不正な場合は`422 CLAIM_BODY_INVALID`とする。
- 接続先が`ACTIVE`でない場合は`409 ACCOUNTS_CONNECTION_NOT_ACTIVE`とする。Accountsとの通信失敗・制限超過・不正な応答は`503 ACCOUNTS_UNAVAILABLE`とし、Accountsの`429`の`Retry-After`を転記する。Access Tokenを取り直しても`401`の場合は`503 ACCOUNTS_CLIENT_UNAUTHORIZED`とする。これらの場合は何も受領せず、識別子・トークンを含めずに構造化ログとメトリクス（operation `accounts_resolve`）へ記録する。

Google fresh済みhash付きconfirm POST時、次を同じD1原子処理で行う。

1. 受領資格と未claim対象集合を確認し、集合hashを再検査する。
2. 正・負を区別せず対象全件を選択不可でclaimする。
3. FIX revisionごとの差分ledgerを追加する。
4. ledger INSERT triggerが`point_accounts.balance`と`evaluationTotal`を更新する。
5. 連携先のsnapshotを含む`fixClaim`、idempotency result、audit eventを保存する。

負の合計で残高が不足・負になってもclaim自体は成功させ、その後の消費系操作を拒否する。並行claim、再読込、Workflow retryは同じclaim集合hashに収束し、二重台帳を作らない。

## 9. 監査と公開表示

- PointsはAccounts照合結果の利用と受領資格の判定をappend-only auditへ残す。claimの監査`UNCLAIMED_FIX_CLAIM`は`reason`に`claimedCount=N`を残し、受領額は同じrequest idの`fixClaim`と、その`fixClaimItem`が指す台帳行から辿る。
- 公開・保存できる外部アカウント情報はAccountsの公開許可と連携契約に従う。
- 監査には必要な識別情報と安全な結果metadataを使い、秘密値やCSV本文を含めない。
- Pointsの経済情報の公開は[プロフィール設定](profile-setting.md)に従う。

## 10. 必須テスト

- Points独自のログイン状態とAccounts連携状態を個別に扱えること。
- ユーザー対応の件数・一意性・解除・退会は[プロフィール設定の必須テスト](profile-setting.md#8-必須テスト)を満たすこと。
- Pointsへの公開が許可された外部アカウントだけを照合に利用すること。
- 利用者の操作中以外でも、事前許可されたAccounts照合を利用できること。
- 識別子列がちょうど一方でない行、`invalid_input`の行を行エラーにすること。
- `matched`でもPoints内の連携が無い行を未受領にすること。
- 修正revisionで、旧revisionが未受領の対象者の差分を未受領にし、受領済みの対象者の差分を同じ受領者へ反映すること。
- validation後の照合結果・連携の変更、通信失敗、制限超過でFIXを全件0反映にすること。validateでは照合できなかったことを`no_match`と区別して示すこと。
- 正負混在の全件一括claim、選択claim拒否、並行claimの二重反映防止。
- claim previewの評価軸別正味合計・正件数・負件数、fresh後hash再取得、集合変化時の確定拒否。
- 受領時点のAccounts照合で`matched`かつ連携先と一致するエントリーだけを受領し、評価時刻・連携時刻に依存しないこと。
- 同じ識別子でも接続先が異なる未受領FIXを別の対象者として扱うこと。
- Accountsとのやり取りの失敗・接続先の停止で何も受領しないこと。
- claim後の紐付け変更・連携解除によって既受領FIXが移動せず、claimの記録が残ること。

URL正規化、Webリンク検証、安全なfetch、外部アカウントの一意性と公開設定のテスト要件は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.ja.md)を参照する。
