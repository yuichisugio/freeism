# CSVエクスポート仕様

## 1. 対象

Pointsで本人またはADMINが閲覧権限を持つ設定・経済履歴をCSVへ出力する。

- 自分のプロフィール設定、公開設定、公式パッケージ設定
- 評価軸、評価軸revision、パッケージ、パッケージrevision
- FIX result/revision/entry
- 未受領FIXとclaim結果
- ledger、balance、evaluationTotal、reservation
- 譲渡、交換、貢献評価代用、自動分配
- 外部identityとownership epochの安全なmetadata
- ADMIN向けreconciliation結果と監査event

Task、Group、Analytics draft、通知データはv0.2に存在しないため出力対象にしない。旧形式は[v0.1の実装履歴](../../v0.1/details/csv-export.md)にだけ残す。

## 2. 権限

- 本人は自分の非公開データを出力できる。
- ADMINは15分以内のGoogle fresh sessionがある場合だけ管理対象を出力できる。
- browserの表示制御だけに頼らず、Hono APIで対象行ごとに認可する。
- 外部ユーザーの非公開残高、OAuth token、session、client secret、暗号鍵、URL検証HTML本文を出力しない。

## 3. 形式

- UTF-8、RFC 4180互換CSV、header必須。
- amountは小数文字列とし、指数表記やlocale区切りを使わない。
- timestampはUTCのRFC 3339、IDは不変文字列で出力する。
- formula injectionを防ぐため、自由入力cellの最初のcode pointが`=`、`+`、`-`、`@`、tab、CRまたはLFならASCII apostropheを1つ付ける。判定前にtrimしない。符号付きamount列はschema上のtyped numeric cellと分離し、ASCII十進文字列・小数4桁以下・安全整数・対象`minimumUnit`倍数を再検証できた`-1.2500`等はapostropheを付けず数値のまま保つ。
- cell内改行はCRLFと単独CRをLFへ正規化してquoteし、record区切りだけをCRLFで出力する。このためLF開始の自由入力もformula対策対象とする。
- authenticated responseは`Cache-Control: private, no-store`とする。

## 4. Snapshotとcursor contract

> 本節の50,000行／50MiB、8KiB row、1,000行／8MiB page、30分cursor、100行read／2MiB bufferはDEC-258の承認対象であり、`採用`へ変わるまで実装しない。

### 4.1 API

- `POST /api/csv-exports`は`type`、権限内のfilter、`pageSize`を受けるsnapshot作成requestとする。`pageSize`は1〜1,000、省略時は1,000で、headerを除く1pageの最大data行数とする。
- serverは一回のD1 transactionで認可後の行を`csvExportSnapshotRows`へ物理化し、`exportId`、`snapshotAt`、`totalRows`、`expiresAt`、先頭cursorを返す。snapshotは最大50,000行かつUTF-8 50MiBとし、いずれかを超える場合は`422 CSV_EXPORT_SNAPSHOT_TOO_LARGE`で期間またはtypeの絞り込みを要求する。上限超過分の暗黙切捨てを行わない。
- `GET /api/csv-exports/{exportId}/pages?cursor=...`は`text/csv; charset=utf-8`を返す。`X-Freeism-Export-Id`、`X-Freeism-Snapshot-At`、`X-Freeism-Total-Rows`、`X-Freeism-Returned-Rows`、`X-Freeism-Final-Page`と、続きがある時だけ`X-Freeism-Next-Cursor`を付ける。最終pageは`X-Freeism-Final-Page: true`、next cursorなしとし、不要な空pageを追加しない。0件snapshotはheaderだけの最初pageを最終pageとする。
- 1pageのencoded CSVは8MiBを上限とする。`pageSize`到達前でも8MiBを超える次行の直前でpageを閉じ、次cursorは未返却の行から再開する。1物理化行はUTF-8 8KiB以下とし、超過するsource rowはsnapshot作成時に`CSV_EXPORT_ROW_TOO_LARGE`で全体を拒否する。

### 4.2 並び順と一貫性

- 各export typeはsourceごとの不変IDを最終tie-breakに持つ完全な昇順sort keyをschemaで固定する。event／revision／ledger系は`createdAt ASC, immutableId ASC`、現在設定系は論理parent ID、`displayOrder ASC`、item IDの順とする。requestごとの任意sortは受け付けない。
- snapshot行は上記sort後の0始まり`ordinal`を持つ。cursorは`exportId`、次`ordinal`、filter hash、`snapshotAt`、`expiresAt`を含むopaqueなHMAC署名tokenとし、別snapshot、別filter、改ざん、逆行を拒否する。
- cursorとsnapshotの有効期限は作成時刻から30分で固定し、page取得で延長しない。期限後は`410 CSV_EXPORT_CURSOR_EXPIRED`とし、利用者は新しいsnapshotから再開する。期限切れsnapshot rowはscheduled cleanupの対象とする。
- 全pageはsource tableを再queryせず同じ物理化snapshotを読む。snapshot作成後にprofile、visibility、ledgerまたはrevisionが変化しても、そのexportの行集合、値、順序、`totalRows`は変わらない。中途のsource変化を混在させる`updatedAt <= snapshotAt`だけの擬似snapshotは使わない。

### 4.3 Workers memory上限

- page readerは`ordinal`を100行ずつD1から取得し、RFC 4180 encoderへstreamする。1,000行と全snapshotをJavaScript array／string／Blobへ一括展開しない。
- query result、encoder chunk、look-aheadを含むアプリ所有の同時buffer上限は2MiBとする。2MiB境界testで超過したらresponseを続行せず、metricと`CSV_EXPORT_MEMORY_LIMIT`を記録する。

## 5. 不変履歴

- FIX、ledger、claim、reservationはrevision ID、source ID、idempotency key、createdAtを含める。
- revisionを平坦化して最新値だけを出すexportと、不変履歴を全件出すaudit exportを別typeにする。
- exportは状態を変更せず、`verifiedAt`や`lastAccessedAt`も更新しない。

## 6. UI

- 対象type、期間、1pageの行数を選ぶ最小限のUIを用意する。cursor文字列を利用者に編集させず、「次のCSVを取得」と現在page／全行数／30分の残り期限を表示する。
- export開始前に対象、件数見込み、非公開情報を含むかを確認する。
- 各pageは同じheaderを持つ番号付きCSVとして保存し、UIが全pageを1つのBlobへ連結しない。期限切れ時は取得済みpageと新snapshotが同一ではないことを示し、1page目から再開させる。
- 生成完了・失敗はtoastで通知する。通知センターへ保存しない。

## 7. テスト

- 本人、ADMIN、非権限者の認可
- hidden balanceと他人のprivate historyの漏えい防止
- amount/timestamp/IDの安定format
- CSV quote、CRLF／CR／LF正規化、Unicode、自由入力の`= + - @ tab CR LF`無害化、typedな負amount保持
- page size 1／1,000／1,001、8MiB境界、最終pageのnext cursorなし、0件のheader-only page
- stable sortの同時刻tie、cursor改ざん／別filter／別snapshot／30分期限、再読込みの同一page
- page間にsourceを追加／更新してもsnapshotの行数／値／順序が不変
- 50,000行／50MiB snapshotの受理境界と超過時の全0件、100行read chunkと2MiB application buffer上限
- 不変revisionと差分台帳が欠落しないこと
- token、secret、session、暗号化前payloadが含まれないこと
