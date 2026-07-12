# Markets Web App v0.3 候補

## 位置付け

この文書は、v0.2で明示的に対象外または未確定としたMarketsの候補を情報として保持する。v0.3の実装承認ではない。

## 候補

### 入札・価格方式

- Pay-as-bid
- VCG系
- reverse Auction
- 需要側の報酬が時間で増える市場方式

v0.2はmulti-unit uniform-priceだけを実装する。

### pointの扱い

- 一定期間預けて返還
- 消費なし
- sellerへのpoint譲渡
- 取引単位で方式を選ぶrule

v0.2はcaptureによる消費だけを実装し、capture後refundを持たない。

### 外部取引

- 外部EC用random claim token
- token hash保存、期限、revoke、seller検証、受渡完了POST
- 匿名配送、外部EC、対面受渡し、QR/対面決済
- 外部からの出品、bid、購入を行うpublic write API

公開・永続の落札proofはv0.2で実装するが、上記の外部EC claim tokenとは別機能である。

### 公開範囲と補償

- seller/buyer限定の落札proof
- 条件付き代理購入
- 借入・返済台帳
- capture後の補償transaction

v0.2では限定proof、借入、refundを実装しない。将来補償が必要な場合も、既存captureの削除ではなく新しい正の台帳として設計する。

### 分散

- 複数Points管理serviceの選択
- 1 Auctionで複数Points serviceを跨ぐ決済
- 独立`accounts.freeism.app`

v0.2は1 Auctionを1`pointsServiceId`へ固定し、全winner・全評価軸を同じPoints D1でcaptureする。

## 承認条件

候補をv0.3へ昇格する前に、責務owner、データ正本、認証scope、経済不変条件、失敗回復、公開範囲、abuse対策、移行・テストを個別に設計し、decision registerへ新しいDEC-IDを追加する。
