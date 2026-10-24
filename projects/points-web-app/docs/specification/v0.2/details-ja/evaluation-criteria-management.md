# 評価軸とパッケージの管理

## 1. 権限model

- v0.2はグローバルな同格`ADMIN`だけを持つ。
- 全ADMINが全評価軸・パッケージを作成、revision追加、無効化できる。
- 評価軸owner、作成者だけの特権、評価軸別ADMIN、パッケージ別ADMIN、一般memberを作らない。
- ADMINは最大50人、最後のADMINは削除できない。
- 変更は15分以内のGoogle fresh session、理由、before/after、request IDを監査する。

## 2. 評価軸

### CSV列

1回のCSVは最大20評価軸とする。同じ評価軸を関連URLのため複数行で表す場合、異なる`evaluationCriterionId`／新規論理行の件数で20件を数える。

- `evaluationCriterionId`: 新規時は空、更新時は必須
- `expectedRevision`: 更新時必須
- `name`: 1〜30文字
- `description`: 1〜200文字
- `minimumUnit`: `0.0001`以上、小数4桁以下
- `transferEnabled`: boolean
- `exchangeEnabled`: boolean
- `buyNowEnabled`: boolean
- `relatedUrl`: 1行1URL。最大20件になるよう同じIDの複数行で表す

economic fieldの更新は既存rowの上書きではなく新しい不変revisionを作る。過去revisionを参照するFIX、交換、予約、Auctionは変化しない。

## 3. パッケージ

> 本節の文字／URL境界、名前正規化、content hash field集合はDEC-257で確定している。

### CSV列

1回のCSVは最大20 Packageとする。複数component行は異なる`pointPackageId`／新規論理Packageの件数で20件を数える。

- `pointPackageId`: 新規時は空、更新時は必須
- `expectedRevision`: 更新時必須
- `status`: `ACTIVE | INACTIVE`
- `name`: 表示値は1〜60 Unicode code pointかつUTF-8 240 bytes以下
- `description`: 任意。0〜500 Unicode code pointかつUTF-8 2,000 bytes以下。空文字は`NULL`
- `relatedUrl`: 任意のHTTPS URL 1件。userinfoとfragmentを禁止し、正規化後UTF-8 2,048 bytes以下。空文字は`NULL`
- `evaluationCriterionId`
- `componentWeight`: 正のJavaScript安全整数
- `displayOrder`: 0始まりで、同じPackageのcomponent内で重複しない連続整数

同じpackage revision内に1つ以上のcomponentを要求し、同じ評価軸を重複できない。全weightを最大公約数で割り、各weightと`totalWeight`の正値・安全整数を検査する。`1:2`等を固定scaleへ丸めず、厳密な`weight / totalWeight`として保持する。

Package名の一意keyは、表示値をUnicode NFKC正規化し、前後のUnicode White_Spaceを除去し、連続するWhite_SpaceをASCII space 1つへ畳み、JavaScriptのlocale非依存`toLowerCase()`を適用した値とする。オリジナル表示値はNFCで保存する。statusに関係なく同じ正規化名を別Package IDで再利用できず、CSV内重複とD1 unique constraintの両方で拒否する。

Public Package RevisionのRFC 8785 content hashは、`pointPackageId`、`pointPackageRevisionId`、`status`、`name`、`description | null`、`relatedUrl | null`、`totalWeight`、`packageTick`と、`displayOrder`順のcomponentごとの評価軸ID／revision ID／name／`displayOrder`／`minimumUnitScaled`／`buyNowEnabled`／weightを対象にする。作成時刻、ADMIN ID、audit IDは対象外とする。hash対象fieldのいずれか、component構成／順序／weight、または参照評価軸revisionが変わる時は新しい不変Package Revisionを作る。profileのPackage登録・解除・並べ替えはPackage内容ではないためrevisionを作らない。

`pointPackageRevision.status`はそのrevisionを作成した時点の履歴状態であり、現在の新規Auction利用可否を単独では表さない。`pointPackages`は最新revisionへの`currentRevisionId`、現在の`lifecycleStatus`、Package commandごとに単調増加する`eligibilityVersion`をprojectionとして持つ。新しい不変revision、append-only lifecycle event、current projectionは同じD1原子処理で確定し、projectionだけを更新して履歴を失う経路を作らない。

## 4. lifecycle

- IDは永久に再利用しない。
- 削除の代わりに新規利用を停止する`INACTIVE`状態を追加し、過去revisionは保持する。
- Marketsの新規Auction／開始前PATCHはPublic Revisionの履歴`status=ACTIVE`だけでは確定できず、PointsのM2M Point Package Auction eligibility checkで現在の`lifecycleStatus=ACTIVE`を確認した30秒receiptを必須とする。現在ACTIVEなら過去の`status=ACTIVE` revisionも利用でき、`currentRevisionId`一致は要求しない。過去の`status=INACTIVE` revisionは利用できない。
- 最初のbidがあるMarkets Auctionが参照するpackage revisionを変更・無効化しても、そのAuction snapshotは継続する。
- 別revisionへ自動差し替えしない。

## 5. 交換比率

- 交換元／交換先の有向pairごとに、不変`exchangeRateRevision`をCSVで追加する。
- 操作できるのは同格ADMINだけで、15分以内のGoogle fresh sessionを要求する。
- CSV列は`sourceEvaluationCriterionId`、`targetEvaluationCriterionId`、`expectedRevision`、`status`、`numerator`、`denominator`とする。
- `ACTIVE`は正の安全整数比率を最大公約数で正規化する。`DISABLED`は比率を空にし、新規交換を停止する。
- 更新・無効化は現在revision番号との一致を要求し、過去revisionとそれを参照した交換／代用結果を変更しない。
- CSVは最大5MiB／1,000非空行、全件validation、preview、confirm、原子commitとし、GUI入力formを作らない。

## 6. 画面

- 公開一覧とプロフィールは未ログインでも閲覧できる。
- ADMINだけにCSV upload、revision履歴、reconciliation、無効化の導線を表示する。
- 交換比率は交換元・交換先・正規化比率・状態・revision履歴を表示し、ADMINだけにCSV upload導線を表示する。
- 一般利用者向けmember管理、owner移譲、GUI一括formは表示しない。
- 名前・ID・description・関連URL・`minimumUnit`・譲渡/交換可否・revisionを表示する。

## 7. 必須テスト

- 非ADMIN、stale Google sessionの拒否
- 30/200文字、URL20件、ADMIN50人の境界
- `minimumUnit=0.0001`受理、0/負/5桁小数拒否
- Package nameの1/60 code point・240 byte、descriptionの0/500 code point・2,000 byte、URL 2,048 byte境界
- NFKC／空白圧縮／大小文字差で同一になるPackage名の重複拒否
- Packageの省略description／URLは`null`、HTTP／userinfo／fragment URLは拒否
- package component重複、displayOrderの欠番／重複、0比率、不正合計、安全整数超過の拒否
- content hash対象fieldの変更で新revision、順序を入れ替えたcomponentのhash変化、timestamp／audit差のhash不変
- 既存revision不変、expectedRevision競合409
- inactive後も過去FIX/Auctionから参照できる
- 不変revisionの`status=ACTIVE`だけでは現在INACTIVEなPackageの新規Auction receiptを取得できず、再ACTIVE化後は過去ACTIVE revisionも新しいreceiptで利用できる
- 1〜1,000件のPoint Package Auction eligibility check、1件不適格時receipt 0件、30秒境界、同一Idempotency-Keyの期限非延長、期限後の新key再検査
- 最後のADMIN削除拒否
- 交換比率の有向性、初回／expectedRevision競合、正規化、ACTIVE／DISABLED、0／負数／範囲超過
- 交換出力のtarget `minimumUnit`切り下げ、余り記録、丸め後0の拒否
