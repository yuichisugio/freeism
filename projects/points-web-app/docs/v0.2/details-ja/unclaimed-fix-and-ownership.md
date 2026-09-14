# 未受領FIXとAccounts連携

## 1. 目的

Pointsに未登録の貢献者にも先にFIX結果を記録し、後から本人がPointsへ登録し、Accounts連携によって受領対象が確定した時にポイントを受け取れるようにする。

FIX revisionへ入力された`recipientProfileUrl`、Accountsから取得できた照合結果、符号付き評価額を保存し、受領対象が確定した後にPointsユーザーの台帳・残高・`evaluationTotal`へ反映する。CSV入力は外部プロフィールURLを使う。

## 2. Accountsとの責務境界

外部アカウントの登録・所有権証明・紐付け・解除・公開設定・公開プロフィール・照合APIは、[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.md)を正本とする。

Pointsは独自のGoogle/GitHubログインとsessionを持ち、Points利用者が別サービスのAccountsへ情報連携を許可する。Pointsはクライアントとして許可された外部アカウントを照合し、取得したAccounts IDをPointsの受領者へ対応付けて、FIX・未受領FIX・claimを管理する。事前に許可された照合は、本人がPointsを操作していない時にも行える。

Accounts IDとPointsユーザーの対応付けの制約、接続・解除時の受領資格、許可の取消後に保持する照合情報は、Points側の連携要件として確定する必要がある。

## 3. Pointsが保存する経済データ

### `unclaimedFixEntry`

- `fixRevisionEntryId`
- 入力した外部プロフィールURLと照合用の識別情報
- 評価時刻
- 符号付きscale済みamount
- claim状態と`claimedByPointsUserId`

### `fixClaim`

- 受領者、claim対象集合hash、正負合計、台帳batch ID
- `claimedAt`、request id、idempotency key

Accountsの照合結果をFIX revisionへ保存する項目と、受領資格を確定するために保持する証跡は、連携API契約とあわせて確定する。

## 4. URL正規化

照合対象のURL正規化・同値判定は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.md)に従う。PointsはCSVの列・行制約を検査し、Accountsの照合結果を使って受領者を判断する。

## 5. 所有権確認方式

GitHub OAuthによる所有権証明、編集可能Webページのリンク検証、外部ページの安全な取得条件は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.md)に集約する。Pointsの設定画面には、連携先Accountsのアカウント管理への導線を設ける。

## 6. FIX取込時の照合

- validationと最終commitの両方でAccountsへ照合し、previewの照合結果が変わった場合は`409 VALIDATION_CHANGED`で全件を止め、再previewを要求する。
- FIX revisionは入力URLと取得した識別情報・観測時刻を不変snapshotとして保持する。過去の評価時刻における外部アカウント所有者の判定方法は、次節の未決事項に含める。
- 同じrequest内の重複URLをまとめて照合する。
- 照合APIの通信失敗・制限超過・不正response時はファイル全体を0件反映とし、利用者が再実行できる理由を返す。照合が正常に完了した未紐付け・非公開の場合と通信失敗を区別する。
- FIXの保存、差分台帳、未受領FIX、idempotency result、監査はPointsの同じD1原子処理で確定する。

## 7. 未受領FIXの帰属に関する未決事項

Accountsは現在の紐付けと公開許可を提供する。その情報を使うPointsでは、次を要件定義で確定する必要がある。

- 初回連携時に、連携前から蓄積した未受領FIXのどの範囲を受領対象にするか。
- 外部アカウントが別Accountsユーザーへ移った場合、移動前に評価された未受領FIXを誰に帰属させるか。
- FIXの評価時刻、照合時刻、Pointsとの連携時刻のどれを受領資格の基準にするか。
- Accountsへの公開許可の取消・再許可、Pointsとの連携解除・再連携、Points account close・reopenが受領資格へ与える影響。
- 既存の所有期間に基づくデータを保持する場合の移行方法。

すでにclaim済みのFIXは、外部アカウントの紐付け変更によって移動せず、Pointsの経済履歴として保持する。

## 8. 一括claim

受領資格と対象集合の確定方法は前節の未決事項を解決してから実装する。対象集合が確定した後の経済処理は次の契約に従う。

claim確定前にread-only previewを返す。previewは評価軸ごとの正味合計、正件数、負件数、全件数と`claimSetHash`を含み、行や正負を選択するfieldを持たない。Google fresh認証後にpreviewを再取得し、利用者が一括受領を確認してから`claimSetHash`と`Idempotency-Key`を付けてPOSTする。serverは同じtransactionで対象集合とhashを再計算し、変化していれば`409 CLAIM_SET_CHANGED`で新しいpreviewを返す。

Google fresh済みhash付きconfirm POST時、次を同じD1原子処理で行う。

1. 受領資格と未claim対象集合を確認し、集合hashを再検査する。
2. 正・負を区別せず対象全件を選択不可でclaimする。
3. FIX revisionごとの差分ledgerを追加する。
4. ledger INSERT triggerが`point_accounts.balance`と`evaluationTotal`を更新する。
5. `fixClaim`、idempotency result、audit eventを保存する。

負の合計で残高が不足・負になってもclaim自体は成功させ、その後の消費系操作を拒否する。並行claim、再読込、Workflow retryは同じclaim集合hashに収束し、二重台帳を作らない。

## 9. 監査と公開表示

- PointsはAccounts照合結果の利用、受領資格の判定、claim件数と合計をappend-only auditへ残す。
- 公開・保存できる外部アカウント情報はAccountsの公開許可と連携契約に従う。
- 監査には必要な識別情報と安全な結果metadataを使い、秘密値やCSV本文を含めない。
- Pointsの経済情報の公開は[プロフィール設定](profile-setting.md)に従う。

## 10. 必須テスト

- Points独自のログイン状態とAccounts連携状態を個別に扱えること。
- Pointsへの公開が許可された外部アカウントだけを照合に利用すること。
- 利用者の操作中以外でも、事前許可されたAccounts照合を利用できること。
- validation後の照合結果変更、通信失敗、制限超過でFIXを全件0反映にすること。
- 正負混在の全件一括claim、選択claim拒否、並行claimの二重反映防止。
- claim previewの評価軸別正味合計・正件数・負件数、fresh後hash再取得、集合変化時の確定拒否。
- claim後の紐付け変更によって既受領FIXが移動しないこと。
- 未受領FIXの帰属・account close/reopenは、第7節の要件確定後に期待結果を定義すること。

URL正規化、Webリンク検証、安全なfetch、外部アカウントの一意性と公開設定のテスト要件は[Accounts v0.1仕様](../../../../accounts-web-app/docs/specification/v0.1/main.md)を参照する。
