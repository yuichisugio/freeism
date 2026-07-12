# CSVアップロード共通仕様

## 1. 対象操作

- 評価軸・パッケージの登録と新revision
- FIX結果とFIX修正revision
- ポイント譲渡
- 評価軸間交換
- 有向交換比率の登録・更新・無効化revision
- 貢献評価代用
- 自動分配設定
- ADMINの一括設定のうち仕様でCSVと定めたもの

商材・AuctionのCSVはMarkets側の仕様とする。Task、Group、draft評価は存在しない。

## 2. ファイル制約

- encoding: UTF-8。BOMは先頭だけ許可する。
- 最大size: 5MiB。
- 共通transport上限: headerを除く1,000非空行。空行は件数に含めず無視する。
- import type固有の上限が1,000未満なら小さい方を適用する。評価軸と公式Packageは各20件、その他のFIX／譲渡／交換／交換比率／代用／自動分配は1,000件を上限とする。
- header名、順序、必須列、余剰列の可否をimport typeごとに固定する。
- 1cellの最大長を列schemaで制限し、memoは200文字以下とする。
- ZIP、Excel、JSON、複数file、drag-and-dropはv0.2で扱わない。

## 3. validation

- client previewは補助であり、serverが同じfileを再parseして正とする。
- すべての行を検査し、行番号、列名、error code、修正可能な説明をまとめて返す。
- 1件でもerrorがあれば確定APIを実行せず、部分反映しない。
- ID、URL、年月、enum、文字数、参照先存在、権限、一意性、重複行を検査する。
- amountはASCIIの10進文字列だけを受け付け、小数4桁超、指数表記、Unicodeマイナス、NaN/Infinity、safe integer超過を拒否する。
- scale済みamountが対象評価軸の`minimumUnit`の倍数であることを検査する。
- URLは1行1件とし、1cellのカンマ区切り複数URLを許可しない。
- 評価期間はUTCの年・月を必須とし、日・時刻は任意。曖昧なlocale日付を受け付けない。

## 4. previewと確定

1. browserがfileを選び、client previewを表示する。
2. serverへvalidation requestを送り、全行を再parseする。
3. errorがあれば全件表示し、confirm dialogを出さない。
4. 成功時だけ、件数、正負合計、対象評価軸、作成/修正件数、警告をconfirm dialogへ表示する。
5. 利用者の明示確認後、元file hash、validation result hash、`Idempotency-Key`を伴う1回の確定requestを送る。
6. serverはfileを再検証し、D1の1原子処理で全件確定する。

server側にdraftを保存しない。validationと確定の間に参照revisionや権限が変わった場合は`409`を返して再validationを要求する。

### D1書込み方式

- 1,000行をmulti-value SQLのbound parameterへ直接展開せず、validation済みcanonical JSONをUTF-8 1,500,000 bytes以下にchunk化する。
- 各固定SQLはJSON chunk 1個を`json_each(?)`でset-based展開し、1 queryのbound parameterを100以下、SQLを100KB以下、stringを2MB未満にする。
- 全chunk、台帳、projection、idempotency result、auditをstatement数100以下の同じD1 `batch()`へ入れる。複数batchへの分割や1行1queryを禁止し、途中失敗は全rollbackする。
- 1,000行／5MiB境界を実D1 runtimeで測定し、batch全体30秒を超える場合は上限を黙って下げず、schema／set-based SQLを見直す。

## 5. 冪等性と競合

- 同じ`Idempotency-Key`と同じpayload hashは同じ結果ID・responseを返す。
- 同じkeyでpayloadが異なる場合は`409 IDEMPOTENCY_KEY_REUSED`を返す。
- FIX修正は対象の直前revisionを指定し、現在revisionが異なる場合は`409 REVISION_CONFLICT`を返す。
- 同一file内の重複business keyは全体errorとする。
- 同じFIX revision、譲渡、交換をretryしても台帳を二重作成しない。

## 6. security

- mutationは同一origin、認証session、CSRF/Origin/Fetch Metadata、Content-Typeを検査する。
- ADMIN操作とFIX確定は15分以内のGoogle fresh sessionを要求する。
- file本文、OAuth token、秘密値をlogへ残さない。
- CSV cellをHTMLとしてrenderせず、export時はformula injectionを無害化する。
- request bodyの一般上限64KiBとは別に、CSV endpointだけ5MiBを許可する。

## 7. response

成功は共通`{ "data": ... }` envelope、失敗はRFC 9457 Problem Detailsを使う。validation errorには機械判定可能な`code`と`errors[]`を含める。

```json
{
  "type": "https://points.freeism.app/problems/csv-validation",
  "title": "CSV validation failed",
  "status": 422,
  "code": "CSV_VALIDATION_FAILED",
  "errors": [
    {
      "row": 4,
      "column": "amount",
      "code": "AMOUNT_SCALE_EXCEEDED"
    }
  ]
}
```

## 8. 必須テスト

- 0、1,000、1,001非空行
- 5MiB境界、BOM、CRLF/LF、quote内改行、Unicode
- 空行、余剰列、不足列、重複header、重複business key
- `0.0001`、小数5桁、指数表記、Unicodeマイナス、安全整数境界
- `minimumUnit`倍数と非倍数
- validation成功後のrevision/権限競合
- 1行errorで0件反映、D1失敗で全rollback
- 同一retryで同じresult、異なるpayloadで409
- 非権限者、stale session、hostile Origin、誤Content-Typeの拒否
