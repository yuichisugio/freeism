# Freeism Markets v0.2.1 仕様

- [Freeism Markets v0.2.1 仕様](#freeism-markets-v021-仕様)
  - [言語](#言語)
  - [v0.2.1：実装する理由](#v021実装する理由)
  - [v0.2.1：基本方針](#v021基本方針)
  - [v0.2.1：出品・商材一覧・オークション・落札証明](#v021出品商材一覧オークション落札証明)
    - [基本情報](#基本情報)
    - [要件](#要件)
  - [利用規約](#利用規約)
  - [プライバシーポリシー](#プライバシーポリシー)
  - [テーブル構造](#テーブル構造)
  - [意思決定](#意思決定)
  - [8. 落札と即時購入](#8-落札と即時購入)
  - [外部EC](#外部ec)
  - [GitHub連携の決済](#github連携の決済)
  - [要件](#要件-1)
    - [5.1 Auction作成](#51-auction作成)
    - [5.2 入札時のPoints扱い](#52-入札時のpoints扱い)
    - [5.3 履歴・証明・評価](#53-履歴証明評価)
    - [7.1 AuctionRoom Durable Object](#71-auctionroom-durable-object)
    - [7.2 Settlement Workflow](#72-settlement-workflow)
    - [branch pushのdeploy pipeline](#branch-pushのdeploy-pipeline)
    - [9. Durable Object/Workflow](#9-durable-objectworkflow)
    - [8. WebSocket event](#8-websocket-event)
  - [4. Token保存とrefresh](#4-token保存とrefresh)
  - [9. セキュリティ、品質、release gate](#9-セキュリティ品質release-gate)
  - [採用しないもの](#採用しないもの)
  - [v0.2.0からv0.2.1への変更](#v020からv021への変更)

## 言語

日本語（本ページ）| [English](./index.en.md)

## v0.2.1：実装する理由

1. 無料主義ドキュメントv3に、大幅な仕様変更があったため

## v0.2.1：基本方針

1. `v0.2.1`**は、「実用性」・「移植性」・「仕様理解の簡単さ」を優先する**
   - 説明
     - 本質的な機能のみ実装する
     - `ver0.1`はポートフォリオ的にいろいろな機能を実装したが、`ver0.2`は本質的な機能のみ残す
     - 他者がコードを読んで、「無料主義の仕様・したいこと」を理解してもらう必要がある
2. **設計の大原則**
   1. 疎結合
      - 評価軸、評価ロジック、データ取得元が、いつでも簡単に差し替えられるように設計
      - ファイルもタスクごとではなく、評価軸ごとに分けた
      - 「評価ロジック」、「評価軸」のフォルダごと削除しても、他は通常通り動作するよう設計
      - 冗長的な部分があるが、疎結合さを優先
   2. 可読性
      - 可読性のために、シェルスクリプトはファイルを分ける。
   3. 簡潔さ
      - より多くの人に理解してもらうために、堅牢性を求めず、簡単にすぐ理解できて短い必要最小限のコードにする
      - リッチな機能は提供せず、簡単に素早く理解できるようにシンプルな機能のみにする
      - アプリとして実用するのではなく、どんなサービスか体験してもらうだけ
      - リッチなUIは不要
3. **バンドルサイズを小さくする**
   - サービスを早く表示するため、バンドルサイズを可能な限り小さくする。
   - 未使用コードを残さず、HTTP caching、ETag、長期キャッシュ、filename hashingによって、変更されていないscriptを再転送しない。
   - サイズが大きいSVGは`<img>`として読み込む。
   - 参考記事は[catnose99の記事](https://zenn.dev/catnose99/articles/nani-translate)とする。
4. **定数管理**
   - 説明
     - それぞれのパラメータは、すぐに変更できるように、定数ファイルを作成して管理する
5. **できる限りサーバーの負荷をかけず、サーバーのアクセス回数も減らす設計**
   - 説明
     - 可能な限りキャッシュを行い、できる限りState管理で最終タイミングのみサーバーへリクエストして登録する
6. **商品発送・住所の管理などは不要**
   - 説明
     - モノの発送が必要な場合は、他サービスを使用して行う。
     - その発送の証拠のみをアプリ内のレビュー画面で記載するのみ
7. **後方互換性は不要**
   - 説明
     - データ移行、後方互換性は不要
8. **注意**
   - 説明
     - ここに記載されていない仕様に関しては、無料主義アプリv0.1と同じ仕様
10. **PointsとMarketsは、独立的に運用する**
  - 別アプリとして同じようなアプリとの連携をする前提で設計したいため
  - 疎結合にする対象は「UIとAPI」ではなく「PointsとMarkets」
  - CORSとCookie共有しない

## v0.2.1：出品・商材一覧・オークション・落札証明

### 基本情報

- 概要
  - 無料主義アプリで、商材を出品・商材一覧・オークション・落札証明する際の仕様について定める

### 要件

1.  **オークションに出品されている商材一覧画面**
    - 要件
      1.  カード形式の中に表示する項目に、以下の項目を追加表示する
          1. パッケージ名
          2. パッケージID
          3. 構成する評価軸名
          4. 構成する各ポイントの比率
      2.  全文検索は、Drizzleのクエリを使用する
    - 実装する理由
      1.  どのポイントで入札できるかすぐわかるようにしたい
      2.  保守性を高める
2.  **オークションの出品する際の仕様**
    - 要件
      1.  **CSVアップロードのみ対応**
          - GUIフォームは設けない
          - 必要な理由
            1.  登録する労力を削減するため
                - 登録が面倒なので、一括登録できるようにするため
      2.  **出品作成処理**
          - 要件
            1.  CSVの各行は、共通の関数で処理する
            2.  モーダルからも、その共通関数を呼ぶ
      3.  **以下の入力項目を追加**
          1. 入札できるポイントを指定するために、パッケージを指定する
             - 公式パッケージの指定を必須にする
             - 評価軸の組み合わせや割合をここでは指定せず、先にパッケージを作成or既存パッケージで指定してもらう
          2. 販売個数
             - 一つの出品枠で複数商品を出品できる
          3. 即決価格の設定
             - 要件
               1. 指定したパッケージを構成する評価軸の設定として「即決価格」が可能な場合のみ出品時に選択できる
3.  **オークションの仕様**
    - 参考
      1.  Multi-unit auction
    - 説明
      - 無料主義アプリv0.2.1の販売方法は「オークション」のみ
        - その理由
          1.  オークションに「即決価格」機能も入れることで通常の販売機能も内包するため
          2.  オークションに絞って実装することで管理コストの削減
    - 実装する理由
      1.  オークションが無料主義の根幹の仕組みなため
    - 要件
      1.  **商材は、一回の出品で、一つ以上の、一人以上への、販売を可能にする**
          - 例
            - 複数個の出品、複数人へ出品、一個の出品、一人へ出品
      2.  **出品時に、入力欄として「販売個数」を指定可能**
          - v0.2.1では、「販売人数」を指定できない。無料主義アプリv3で実装予定
          - 「販売数量が一つ以上」かつ「1番手だけでは販売数が余る」場合は、マルチユニットオークションになる
      3.  **落札者を選ぶ条件**
          1. 同じ入札額なら先着順
          2. 違う入札額なら、高い入札額
          - つまり、枠より多いときに入札があった場合は、一番安い入札額の最後尾の入札者から落選させる
      4.  **落札価格の条件**
          - 要件
            - 落札できなかった入札者達の中で、一番高い入札額の人を、「ギリギリ落選者」と呼ぶ
            - 「ギリギリ落選者」より「入札日時が前の人」は、「ギリギリ落選者」と同じ額
            - 「ギリギリ落選者」より「入札日時が後の人」は、「ギリギリ落選者」の入札額に1単位だけ加算した額
            - 落札者は一律で、上記の額・条件で支払う
          - ポイント
            1.  「落札者を選ぶ条件」に沿って、入札日時が前なら同じ額でも落札できるのであれば、同じ額で支払ってもらう条件にしている。
          - 注意
            1.  「落札できない入札者の中で最高入札額+1単位だけ加算した額を、落札者全員が一律で払う」方式だけだと、無料で入札して落札して、先着順で取得できた場合に1ポイント支払う必要が出てきてしまう
      5.  **入札は、`packageTick`単位の価格で、数量を指定して行う**
          - `packageTick`は1目盛りの価格、`priceTickCount`はその数量である。
          - Markets内部の`priceTicks`は、`priceTickCount * packageTick`のscale済み安全整数である。数量`quantity`も安全整数とする。評価軸別の引き落とし額をBigIntで計算し、安全整数を超える場合は拒否する。
          - Pointsへの残高照会・引き落とし要求には、Marketsが計算した評価軸別の`components`を渡す。
      6.  **一人につき複数個を購入する場合**
          1. 優先度が高い人から順に購入枠を占めて、希望数だけ得られる
          2. 希望数が残っていない場合は、最後尾の人は希望数が残っている分だけ配布
      7.  **複数人への出品は、シングルプライスとする。全落札者が同じ1個当たりの清算価格を支払う。評価軸のオークション方式として設定できるのもシングルプライスである。**
      8.  **即決価格**
          - 説明
            1.  出品者が設定した「即決価格」ですぐ落札できるようにする機能
          - 必要な理由
            1.  オークションだと時間がかかるが、即決価格だと通常の販売と同じように使用できるため
      9.  **入札時の保有ポイントチェックはしない**
          - 要件
            1.  入札時は消費せず、落札時にポイントを保有ポイントから差し引く
            2.  もし落札額を保有していない場合は、次の人の入札者が落札になる
      10. **入札額を保有していない場合の対応**
          - 説明
            - 入札したのに、実際に落札して消費するときに保有ポイントを保有していない場合のペナルティーを用意したい
          - 要件
            1.  残高が足りないときは、その競売と利用者のブラックリストを1件記録する
            2.  記録したあと、次の入札者を落札者にする
      11. **複数の種類の評価軸ポイントを組み合わせて入札する場合の処理**
          - 各評価軸のポイント方式は「消費」とする。出品で選べる購入方式も消費だけである。一番ニーズがありそうなためである。落札時に保有から差し引く。評価軸の設定で選べるポイント方式も消費だけである。
          - 入札には作成時に保存した全評価軸と割合を使う。即決価格は、作成時に全構成評価軸が即決価格の利用を許可している場合に設定できる。
      12. **複数ポイントの組み合わせ入札**
          - 要件
            1.  出品者が指定した、入札に使用できるパッケージの「ポイントの種類」や「ポイントの組み合わせの割合」でのみ入札可能
            2.  入札時に、他のポイントから交換可能にする機能は実装しない
                - 本質的な機能ではない。
                - 別画面で実装する予定なので、そちらから行ってもらう
      13. **出品者本人は自身の出品に入札できない**
      14. **オークションが既に終了している場合、新規入札は受け付けない**
      15. **日時の保存と表示**

          日時はUTCで保存し、APIでもUTCを用いる。画面では、それぞれの利用者がいる場所の現地時間に変換して表示する。

      16. **できる限りの、サーバー負荷・データベースやストレージの保存容量の削減**
      17. **入札タイプ（同額入札）の対応**
          - race conditionの同じ入札額のユーザーが複数いた場合は、入札日時が早い人が落札する先着順で決める
      18. **自動入札機能**
          - ユーザーが事前に上限額を設定し、システムが自動で入札を行う仕組み。
          - できる限り State で管理し、画面から離れるときに DB に保存するなどの工夫を行う。
          - **流れ**
            1.  まず現状の価格（初めは0ポイント）で入札する
            2.  0ポイントで購入できる権利が枠いっぱいになった場合は、ポイントを一単位増やして入札することで、先着順の並びで最後尾の人の商材購入の権利を奪える
                - 1単位増やした場合は、一番後ろに追加して
            3.  落札者は、優先度が上の人から順に、その上の人が求めた数量ずつ割り当てていき、まだ残っている場合は次の人に割り当てる
                - 落札者の最後の人は、希望数量が残っていない可能性がある注意文言を入れる
            4.  落札したが、消費する額のポイントを保有していない場合は、その競売と利用者のブラックリストを1件記録し、次の優先度の人に落札権を回す。
          - **例**
            1.  3人の購入枠があり、a→b→cの順番で0ポイントで入札した場合は、優先度はa→b→cになる
            2.  その後、dが1ポイントで入札したら、cが枠から外れて、優先度はd→a→bになり、d,a,bが商材を得られる
                - この際、すでに3人の枠を占めているため、dは0ポイントで入札できない。1ポイント以上になる
            3.  その後、cが5ポイントで入札したら、bが枠から外れて、優先度はc→d→aになる
            4.  その後、bが3ポイントで入札したら、aが枠から外れて、優先度はc→b→dになる
                - cは5ポイントなので、優先度が一番高いまま

4.  **落札後の画面**
    - 説明
      - 自分自身が、指定商材を落札したことを証明するページを作成したい。
      - そのため、証明に必要な情報が一つの画面にすべて記載された状態にしたい
    - 目的
      1.  自分がこの商材の購入者であることを示す仕組みを実装したい
      2.  落札情報URLを、自身が購入した事を示したいサイトにコピペすれば完了にしたい
    - 表示する項目
      1.  落札商材の内容
      2.  非公開設定を実装する
      3.  複数人・複数個向けの出品（マルチユニット）の場合の画面表示にも対応する必要がある
          - 現状の実装は、**1人分・1個分の落札**を想定した表示に留まり、**複数人・複数個**の出し分けには未対応である

## 利用規約

- 概要
  - 利用規約のページについて定める

- ↓を参考
  1.  [https://www.hayabusatrip.com/](https://www.hayabusatrip.com/)
  2.  [https://nani.now/ja/terms](https://nani.now/ja/terms)

- 利用規約のテンプレート
  1.  [https://kiyaku.jp/index.html](https://kiyaku.jp/index.html)

- 要件
  1.  利用規約のページを作成・更新して、ちゃんと文言を決める

## プライバシーポリシー

- 概要
  - プライバシーポリシーのページについて定める

- ↓を参考
  - [https://www.hayabusatrip.com/](https://www.hayabusatrip.com/)
  - [https://nani.now/ja/terms?tab=privacy](https://nani.now/ja/terms?tab=privacy)

- プライバシーポリシーのテンプレート
  - [https://kiyaku.jp/index.html](https://kiyaku.jp/index.html)

- 要件
  1.  プライバシーポリシーのページを作成・更新して、ちゃんと文言を決める

## テーブル構造

- **利用者ID**
  - 利用者IDは標準Nano ID（文字列）である。プロフィールURLに入れる利用者IDも同じである。
  - 評価軸IDとパッケージIDも標準Nano IDであり、利用者IDとは別の値である。

- **フィールド命名**
  - アプリ上の名前は camelCase とする。Cloudflare D1の列名は snake_case とする。

- `BidHistory`
  - 説明
    - 入札履歴を保存するテーブル
  - カラム
    1. `userId`
       - 型
         - 標準Nano ID
       - 説明
         - 入札した利用者のID
    2. `amount`（入札額）
       - 型
         - 数値
       - 説明
         - 入札額
    3. `bidAt`（入札日時）
       - 型
         - DateTime
       - 説明
         - 入札日時
    4. `bidType`
       - 型
         - Enum（通常入札 / 自動入札）
       - 説明
         - 入札タイプ
    5. `status`
       - 型
         - Enum（入札中 / 落札済み など）
       - 説明
         - 入札レコードの状態
    6. その他
       - 説明
         - 監査・取消し・オークション`id`（FK）など、実装時に必要な項目を追加

- `AutoBid`
  - 説明
    - 自動入札の設定を保存するテーブル
  - カラム
    1. `userId`
       - 型
         - 標準Nano ID
       - 説明
         - 設定した利用者のID
    2. `auctionId`
       - 型
         - UUID
         - 文字列
       - 説明
         - 対象オークション（`Auction.id`）の`id`
    3. `autobidPoint`
       - 型
         - 数値
       - 説明
         - 自動入札の上限額等（仕様に合わせて定義）
    4. その他
       - 説明
         - 有効フラグ、更新日時など推奨項目を追加

- `AuctionReview`（`Review`）
  - 説明
    - オークション取引後の相互評価（出品者・落札者のレビュー）を保存するテーブル
  - カラム
    1. `id`
       - 型
         - UUID（PK）
       - 説明
         - テーブルのID
    2. `auctionId`
       - 型
         - UUID（FK to Auction）
       - 説明
         - 対象オークションの`id`
    3. `reviewerId`
       - 型
         - 標準Nano ID
       - 説明
         - 評価した利用者のID
    4. `revieweeId`
       - 型
         - 標準Nano ID
       - 説明
         - 評価される利用者のID
    5. `rating`
       - 型
         - Integer（1〜5）
       - 説明
         - 星評価
    6. `comment`
       - 型
         - Text
       - 説明
         - 評価コメント
    7. `completionProofUrl`
       - 型
         - String（Nullable）
       - 説明
         - 完了証明の添付URL
    8. `isSellerReview`
       - 型
         - Boolean
       - 説明
         - 出品者による評価か買い手による評価か
    9. `createdAt`
       - 型
         - DateTime
       - 説明
         - 作成日時
  - ユニーク制約
    - `(auctionId, reviewerId, revieweeId)` — 1つのオークションにつき1回のみ評価可能

- `Auction`
  - 説明
    - オークションに出品される商品の情報を入れるテーブル
  - カラム
    1. `id`
       - 型
         - UUID
         - 文字列
       - 説明
         - テーブルのID
    2. `startTime`
       - 型
         - DateTime
       - 説明
         - 開始日時
    3. `endTime`
       - 型
         - DateTime
       - 説明
         - 終了日時
    4. `currentHighestBid`
       - 型
         - 整数
       - 説明
         - 現在の最高入札額
    5. `currentHighestBidderId`
       - 型
         - 標準Nano ID
       - 説明
         - 現在の最高入札者の利用者ID。`BidHistory.userId`と同じ標準Nano IDである
    6. `winnerIds`
       - 型
         - Cloudflare D1に保存する文字列の配列
       - 説明
         - 落札が確定した利用者のIDを、配分の順に並べた一覧。1人の落札でも配列にする。金額と数量の内訳は`BidHistory`の確定記録を正とし、この配列は一覧の参照である。
    7. `status`
       - 型
         - Enum（`DRAFT`, `SCHEDULED`, `OPEN`, `CLOSING`, `CANCELLED`）
       - 説明
         - オークションの状態。開始前は`DRAFT`。開始は`OPEN`。終了処理は`CLOSING`。開始前の取消は`DRAFT`または`SCHEDULED`から`CANCELLED`へ進める
    8. `createdAt`
       - 型
         - DateTime
       - 説明
         - 作成日時
    9. `updatedAt`
       - 型
         - DateTime
       - 説明
         - 更新日時
  - リレーション
    1. `bids`
       - 説明
         - `BidHistory`（1:N）。落札内容の詳細・数量はこちらを正とする。落札終了後、`winnerIds`
           と整合するよう落札確定状態の行を更新する。
    2. `currentHighestBidder`
       - 説明
         - 入札進行中の最高入札者（`User`）。単一参照。
    3. （任意）落札者ユーザーへの参照
       - 説明
         - `winnerIds` は、Cloudflare D1に保存した利用者IDの配列である。別テーブルは作らない。金額と数量の内訳は `BidHistory` を正とする。

## 意思決定

- Markets D1をAuction業務上の唯一の正本とし、Auction IDごとに1つの`AuctionRoom` DOを割り当てる。

- Auctionの作成は、フォームとCSVで可能にする

- AuctionRoomは初回閲覧・接続・入札時にlazy初期化し、未利用Auctionを大量作成しない。
- 順位は価格降順、同額はその価格へ到達したsequence昇順、最後のwinnerだけ残数による部分落札を許可する。

- 枠外最高単位がなければ0 tick、同額なら同額、異なるなら枠外最高額＋1 tickをclearing priceとする。

- 全需要が販売数量以内なら正の入札があっても0 tickで落札する。

- AutoBidは非公開上限、必要最小tickへ直接進め、上限引上げとrule取消を許可する。取消前に到達した有効入札は残す。

- Buy nowは全構成軸が許可する場合だけ設定し、指定数量の全量成功または失敗とする。
  - Status: 採用
  - 上書き・撤回関係: NG軸だけ除外して比率を壊す案を不採用。
- seller本人のbid、終了後bid、価格引下げ、bid撤回を拒否する。
  - Status: 採用
  - 上書き・撤回関係: 旧自由変更案を不採用。
- 入札後にseller、数量、評価軸、比率、minimum unit、価格式、Points serviceを変更できない。
  - Status: 採用
  - 上書き・撤回関係: live Auctionの条件変更を禁止。
- Auction history、winning history、watchlistをMarketsへ残す。
- Allocationごとに公開・永続proofを作り、商材、数量、価格vector、buyer／seller公開identityの落札時snapshotを表示する。

- Reviewはseller→buyer、buyer→seller、1〜5、comment、任意URL、方向ごと1件とし、編集は同じReviewレコードを更新し、変更内容を監査記録に残す。

- 1つの競売は1つの`pointsServiceId`に固定する。落札者も評価軸も、同じPointsのデータベースで精算する。

- WebSocketは購読専用とし、bid mutationは認証済みHTTPからHono→AuctionRoom commandで行う。

- WebSocketはMarkets SessionとOriginをhandshakeで検証し、URL queryへTokenを入れない。

- WebSocket message上限は4 KiB、user×Auction 3接続、user全体20接続、heartbeatなしとする。

- Eventに`auctionVersion`と`bidSeq`を持たせ、gap時はsnapshot再取得、重複seqは無視する。

- Auction close後の決済はAuctionRoom＋Markets D1 outbox＋Settlement Workflowで行う。

- 対面決済、QR決済、店舗履歴は、Marketsに導入する。

- 外部EC用random claim Token、再発行、seller検証、受渡完了POST。

- 引き落としが成功したあとに、その分を取り消して返す機能は作らない。成功した引き落としは台帳に残す。ポイントを借りて、あとから返すための帳簿は持たない。誰かが条件を満たしたときだけ、別の人の代わりに購入する機能は作らない。必要なら、このアプリの外で扱う。

- 商材と競売条件は、一つの`auction`に置く。
  - 開始前の編集と取消は、Auction IDだけを使う。作成者だけが、`DRAFT`または`SCHEDULED`から`CANCELLED`へ終了できる。bid、AutoBid、成立した即時購入が1件でもあれば取消を拒否する。

- AuctionRoomはD1の現在のAuctionレコードを正本に1 alarmだけを持ち、`startsAt`でOPEN、`endAt`でCLOSINGへCASする。WebSocket上限はuser全体20／user＋Auction 3のD1 unique slotを同じ原子commandで確保する。

- Auctionの商材fieldはtitle 1〜120 code point／480 bytes、description 1〜4,000／16,000 bytes、canonical HTTPS外部URLちょうど1件／2,048 bytesとする。reviewはcomment 0〜2,000／8,000 bytes、completion URL 0〜1件／2,048 bytesとする。

- Marketsは、`test/*` pushは共有test環境として既存Cloudflare `staging`資源だけを更新し、`main` pushはproductionだけを更新する。両workflowは相互に昇格せず、固定concurrency group、`queue: max`、`cancel-in-progress: false`で直列化する。

- Marketsの`appAdmin`
  - Marketsの`appAdmin`が、複数のPoints互換提供先を登録・有効化・停止する。
  - MarketsのBetter Auth `user.role`に`admin`を含む利用者が管理操作として行う。
  - 利用者は提供先ごとにOAuth連携する。
  - issuerは登録済みoriginと一致させ、OAuth endpointをdiscoveryから取得する。
  - Marketsの`appAdmin`が生成した提供先別鍵をMarkets D1に暗号化保存し、登録済みoriginへ外部HTTPSで接続する。
  - 共通OAuth部分はAccountsと揃え、Pointsの利用者認可とrefreshを維持する。

## 8. 落札と即時購入

Marketsは、終了時点の入札、または即時購入の要求から、不変の精算計画を決める。

落札者は、終了時点でPointsへの利用者認可が有効な入札者だけとする。利用者認可が有効とは、連携が有効で、Marketsが保持する利用者トークンによりPointsがその人のポイントを引き落とせる状態である。

ポイントの仮押さえはしない。利用者のいないサービス権限では精算しない。入札とAutoBidの設定時は、有効なPoints連携を必要とする。その時点では残高照会と仮押さえは行わない。

認可がない入札者は落札者にしない。ブラックリストは記録しない。残高が足りない入札者は、その競売と利用者のブラックリストを1件記録してから落札者にしない。同じ終了時点の入札から落札者、数量、清算価格を計算し直す。順位が次の入札者が繰り上がる。同じ競売と利用者の組のブラックリストは1件だけである。通信失敗、429、5xxでは記録せず、同じ計画を再送する。

引き落としは、その時点の落札者全員を利用者認可で1回の処理とする。一人でも失敗すれば台帳も受領証も0件である。引き落としは評価軸ごとの負の台帳とし、`evaluationTotal`は変えない。必要額が0のときは台帳を作らず、残高と`evaluationTotal`は変えない。認可が無効なら0でも拒否する。成功していない引き落としは台帳に残さない。成功した引き落としは戻さない。同じ計画の再送は同じ受領証を返す。

Marketsは競売作成時に保存した構成・割合・最小単位・入札額の刻みから、落札価格と数量に対応する評価軸別の引き落とし額を計算する。Pointsは認証、利用者の権限、評価軸ID、金額、残高を検証して引き落としを確定する。金額は非負の安全整数かつ各評価軸の固定最小単位の倍数とし、重複する評価軸を拒否する。競売作成後のパッケージや評価軸の更新・無効化によって、確定した競売条件を変更しない。

即時購入は、購入ボタンのあとで利用者認可と残高を確認する。成功した引き落としの応答を受け取ったときだけ販売数量を減らし、購入を成立させる。認可がない、または残高が足りない失敗応答では数量を変えず、競売を止めない。応答を受け取れないときも購入は成立させず、競売は続ける。同じ購入要求の再送で引き落とし受領証が返ったときだけ数量を減らす。残り数量が0のときだけ競売を終了する。

引き落とし成功後にMarkets側の確定が失敗しても、ポイントは戻さない。受領証を照会してMarkets側の確定をやり直す。

## 外部EC


- 無料主義の評価軸ポイントの使用場所を増やしたい
  - 説明
    - ポイントの使用場面を増やしたい
  - アイデア
    1. EC
       1. 匿名発送で届ける
       2. 外部EC経由で届ける
       3. 自社で個人情報を持つ
          - v0.4で実装する
       4. 落札して対面で受け渡し
    2. 対面決済
       1. ただの消費
       2. QRコード決済
    3. 外部サービス連携
       1. GitHub連携の決済
    4. その他
       - また需要が出てきてから考える

- 落札して対面で受け渡し
  - 説明
    - オンラインのオークションで落札して、対面で受け渡しする際に、落札者である事を証明できるようにしたい
  - 設計
    - 出品者と落札者しか見えない画面を見せる事で対応する
    - 画面にも、出品者と落札者しか見えない旨を表示しておく
    - 対面の受け渡し時は、その画面を見せて受け渡しする
  - 使用場面
    1. 家具の予約
    2. 車のオークション

- 匿名発送で届ける
  - 説明
    - 外部ECを使用せず、個人間取引する
  - 使用場面
    - 商品引き渡しの際の価格を払いたくない人向け
  - 要件
    - `fanster`などのサービスを使用する
    - 出品者・落札者が、それぞれメモを書けるようにして、そこにやり取りの方法や使用するサービスのURLなどを記載する

- 外部EC経由で届ける
  - 説明
    - 外部EC経由で落札した商品を届ける方法
  - 使用場面
    1. メルカリなどの外部EC経由で、無料主義アプリで落札した商品を提供する
  - 核となる考え方
    - 検証できるトークン付きURLを貼り付けられるのは落札者しかいない
  - 全体の流れ
    1. 自社オークションで落札完了
    2. 自社サイトが落札証明トークンを発行
    3. 落札者に検証用URLを表示
    4. 落札者が外部ECサイトの注文メモに検証用URLを貼り付ける
    5. 出品者が外部ECサイトの注文詳細からURLをクリック
    6. 自社サイトの管理画面に遷移
    7. ログイン済みでなければログイン画面へ
    8. ログイン後、token を使って検証
    9. 管理画面に「有効」「期限切れ」「使用済み」「商品不一致」などを表示
    10. 問題なければ販売者が受け渡し・発送対応
    11. 最後に管理画面で「受け渡し完了」を押す
    - 外部ECサイトの注文メモに落札者が **検証用URL** を貼り付け、販売者・管理者が自社サイトの管理画面でそのURLにアクセスすると、クエリパラメータの `token` を使って落札証明を確認できる、という形です。

たとえばこうです。このURLにアクセスすると、自社サイト側で `token` を読み取り、DB上の落札証明トークンと照合します。

`https://markets.freeism.app/claims/verify?token=ea6a8133-6bd1-3796-c1cb-176f774d2dc1`

ここで大事なのは、**URLにアクセスしただけでは受け渡し完了にしない**ことです。
URLアクセスはあくまで「検証結果の表示」までにして、`used` や `completed` にする処理は管理画面上のボタン操作、つまり `POST` 処理で行うのが安全です。

落札者へ見せる文は「外部ECサイトの注文メモに、以下のURLを貼り付けてください」です。メモが短いときは、URLではなく証明コードだけでもよいです。例は「落札証明コード: clm_8fJ29xLmQp7vR4sAzK6TnY」です。コードを貼る入力欄が販売者の管理画面にあると、親切に使えます。ログイン後は、元の検証用URLへ戻してクエリの `token` で検証します。管理画面は `GET /admin/claims/verify?token=...` を受けます。

トークンは、意味を持たないランダムな文字列です。ユーザーIDや商品IDや落札IDは入れません。落札金額やメールアドレスや電話番号も対象外です。ランダム性は最低でも128bitです。形の例は `clm_8fJ29xLmQp7vR4sAzK6TnY` とします。`AUC-12345`のような連番は対象外です。`user_123_auction_456_winner_true`のように中身が読める値も対象外です。

平文トークンをDBへ残すことはありません。発行時にサーバーで平文を作り、その場でハッシュ化します。保存するのは `token_hash` だけです。計算は `sha256(token + server_secret)` です。可能なら、単純なハッシュではなく、サーバーの秘密値を加えたHMACかpepper付きハッシュにします。検証に使う値は、URLの平文を同じ方法でハッシュ化した結果です。一致したときの取得対象は、その落札証明です。不一致のときは「無効な落札証明URL」と表示します。

記録に残す識別子は、落札IDと商品IDです。落札者IDと販売者IDも残します。トークンハッシュと有効期限と使用状態も残します。失効状態と検証回数も、記録の対象です。作成日時と更新日時も残します。テーブル `auction_claim_tokens` では、`id` と `auction_id` を必須のBIGINTにします。`winner_user_id` と `seller_user_id` も、必須のBIGINTです。`token_hash` は必須かつ一意のVARCHAR(255)です。`status` は必須のVARCHAR(32)にします。`expires_at` と `created_at` と `updated_at` は、必須のDATETIMEです。`verified_at` と `used_at` と `revoked_at` は、空を許すDATETIMEにします。`verified_count` は既定0のINTです。`external_order_id` は空を許すVARCHAR(255)にします。`external_platform` は空を許すVARCHAR(64)です。`status` の例は、`unused`（未確認・未使用）と `verified`（確認済み）と `used`（受け渡し完了）です。あわせて `expired`（期限切れ）と `revoked`（無効化済み）も含めます。`expired` はDBへ保存せず、`expires_at` が今より前かで都度判定してもよいです。

同じURLを再表示することはありません。紛失したときや、コピーし忘れたときは、新しいトークンを再発行します。再発行に伴い、古いトークンは無効になります。確認の1文目は「以前のURLは使えなくなります」です。2文目は「すでに外部ECサイトに貼り付けた場合は、新しいURLに差し替えてください」です。新しいURLも、発行直後に一度だけ表示します。古いURLを開いたときの文言は「この落札証明URLは再発行により無効化されています」です。貼り済みのURLが無効になり得るので、再発行では落札者へ注意を出します。

検証の順は、次のとおりです。最初に、管理者または販売者としてログインしていることを確認します。次にtokenがあることを確認します。その次に、`token_hash` が一致する記録があることです。続けて、期限切れでないことを確認します。失効していないことも確認します。使用済みでないことです。ログイン中の販売者が `seller_user_id` と一致することも確認します。そのあと、商品とオークションの情報を表示します。期限内で未完了なら、検証自体は何度でもよいです。受け渡し完了は一度だけに限ります。

URLアクセス時にできるのは、検証結果の表示と `verified_count` の増加です。あわせて `verified_at` の更新と、アクセスログの保存を行います。受け渡し完了や、トークンの使用済み化は行いません。注文の確定や発送済みや返金不可も、同じように行いません。実行先は `POST /admin/claims/:claimId/complete` です。画面のボタン名は「受け渡し完了にする」とします。押したあとの確認は、出してもよいです。確認の1文目は「この落札証明を受け渡し完了にします」とします。2文目は「完了後、この証明コードは再利用できません」です。完了後の状態は `used` または `completed` にします。同じトークンでの再度の受け渡しはできません。

検証後は、可能ならtoken付きURLのまま表示を続けません。移る先は、tokenのない詳細です。流れでは `GET /admin/claims/verify?token=xxxxx` のtokenを検証し、claimIdを特定します。権限を確認したあと、`302` で `/admin/claims/{claimId}` へ移し、詳細を表示します。`/admin/claims/{claimId}` でも、ログインユーザーの権限確認は必須です。

有効なときの表示項目は、ステータスと商品名とオークションIDです。落札日時と受け渡し期限も出します。外部EC注文IDと受け渡し状態も出します。販売者へ出す文は「外部ECサイト上の商品・注文内容と照合してから受け渡ししてください」です。別の文面の1文目は「この証明は有効です」です。2文目は「外部ECサイト上の注文内容と商品名・金額・購入者情報を確認してから、受け渡しを行ってください」とします。無効なら、理由を出します。期限切れの例は「この証明コードは無効です」と「理由: 期限切れ」です。

画面の状態は、少なくとも8種類です。内訳には、有効と期限切れと使用済みと無効化済みを含めます。存在しない状態も含みます。販売者不一致と、ログインが必要と、token未指定も状態です。販売者がその落札の出品者でないときは、商品名や落札者情報は非表示です。そのときの文言は「この落札証明は確認できません」とします。案内の1文目は「この落札証明は、あなたが確認できる商品ではありません」です。2文目は「URLまたは証明コードをご確認ください」とします。`seller_id` や落札者の `user_id` は出しません。不一致を伝える別の文は「この証明コードはこの販売者の商品ではありません」です。

外部ECの注文IDは、販売者が検証画面で後から登録できます。未登録のときは、入力欄を出します。画面の例は「外部EC注文ID」の入力と保存です。保存項目は `external_platform` と `external_order_id` の2つとします。値の例は、`external_platform` がmercariで、`external_order_id` がm123456789です。保存したあとも、権限と状態の確認は続けます。目的は、問い合わせやトラブルのときに、注文と落札証明を追いやすくすることです。

トークン付きURLは、ブラウザ履歴やサーバーログに残ることがあります。外部ECの注文メモやアクセス解析にも、残ることがあります。そのため、トークンへ個人情報や内部情報は入れません。管理画面では、外部の広告タグや解析タグを読みません。読み込むと `Referer` でトークンが漏れることがあるためです。ヘッダーは `Referrer-Policy: no-referrer` を基本とし、少なくとも `same-origin` にします。あわせて `Cache-Control: no-store` を付けます。

この方式は、署名付きの証明書ではありません。突合するのは、DBに保存した落札証明とトークンです。安全性を支えるのは、トークンのランダム性とハッシュ保存です。有効期限と失効と使用済みと、販売者の権限確認も支えます。証明できるのは、提示した人が、自社サイトの発行した有効な落札証明トークンを持っていることです。URLの所持者が落札者本人であることまでは、証明しません。運用では、外部ECの注文と販売者の確認を組み合わせます。受け渡し完了と検証ログも、組み合わせの対象です。

MVPは、次の設計にします。表示するのは、発行直後の検証URLだけです。紛失時は再表示せず、再発行します。確定は、販売者が管理画面で検証したあとのPOSTです。

## GitHub連携の決済
  - 説明
    - Issueを消化するごとに、ポイントを使用する
    - オークションせず、ただ優先的に対応することによってポイントを消費
    - ポイントを持っていることを提示する
  - 疑問
    - GitHubでポイント消費する処理を入れなくても、GitHubの処理の流れすべてをGitHub
      APIで取得してきて、そこから評価軸側でポイント管理サービスの加算・減算のAPIを叩けば良いだけでは？
      - 無理矢理、GitHub連携を入れなくても良い
  - 使用場面
    1. 評価軸に貢献する人の要望から優先対応する
    2. AIによるプルリク・イシューを避けるために、ポイントを持つことを判断基準にする
  - 要件定義
    1. PRをマージする際に、CI/CDでポイントのマイナにするAPIを叩く

## 要件

- 出品のCSVは、1行で競売1件を作る。

- 画像管理・アップロードを廃止し、R2を商品画像用途に使用しない。
- Auction単位のDurable Object＋WebSocket Hibernationを採用する
  - 手動reloadだけにする旧案も上書き。
  - `setTimeout`、`setInterval`、独自heartbeatでDOを起こし続けない。常駐型realtime案を不採用。

- 1対1のDMはNG
  - 電気通信事業法

- WebSocketなど、リアルタイム性が必要なデータはキャッシュしない。

- WebSocketは購読専用。bid mutationは認証済みHTTP。
- upgradeでhost-only session、Origin、接続上限を検査し、query tokenを禁止する。
- 1 frame最大4KiB、同一user/Auction最大3接続、全体最大20接続。
- attachmentはIDとlast sequenceだけ。secret、AutoBid上限、sessionを保存しない。
- heartbeat timerを使わない。
- D1 CAS commit後だけbroadcastし、version/seq gapはHTTP snapshotでresyncする。
- seller自己入札、終了後bid、Auction economic field変更をserver/DO/D1で拒否する。

- Markets
  - 入れる機能
    - 出品
    - 入札
    - 自動入札
    - Marketsの管理者は`appAdmin`だけとする。
    - 認証
      - OAuthは、GitHubとGoogleに対応する
      - Marketsは独立Better Authユーザー、D1、Session Cookieを持ち、Pointsを後から明示linkする。
  - 入れない機能
    - メールとPUSH
    - PWAとoffline機能を廃止する。

- Marketsは、複数のポイント管理サービスと連携して、それぞれのポイントを使用できるようにしたい
  - 決済時に、自由に選べるようにしたい。
  - さらに、複数のポイント管理サービスから選択できるようにしたい

- EC
  - ECもしたい訳では無い。外部ECと連携できるようにしたい
  - なので、その外部連携APIが欲しい
  - ECは別サービスととして切り出す。それで他ECがAPIと同じ方法でやり取りするのを
  - ECや他のあらゆる取引に必要なAPIを用意する

- Cloudflare Durable Objectを使用して、リアルタイム更新する
  - 使わない状態を実現するために、setTimeout/setIntervalしない
  - Upstash Redis Pub/Subとは違い、接続数ではなく時間で課金される。なので課金数が少なくなるよう実装する。
    - また、ハートビートも不要
  - WebSocketで実装する
  - Workersからアクセスする場合は常にれRequestsを消費する
    - さらに、クライアントからサーバーへWebSocket通信する場合は20ぶn20分の1のRequestsを消費する
  - Durationは、処理中にメモリを使用した時間

| `projects/markets-web-app` | `markets.freeism.app` | `auction-worker` | 独立認証、商材情報を含むAuction、入札、リアルタイム配信、精算saga |

- Marketsユーザーと独立したBetter Authセッション
- 商材情報とAuction設定を統合した現在のAuctionレコード、競売作成時のパッケージ情報と公開snapshot
- bid command、bid sequence、AutoBid状態、watchlist
- AuctionRoom Durable Objectの接続状態と配信用状態
- Auctionの終了判定、winner計算、clearing price
- Settlement Workflow、outbox、精算saga状態
- 落札証明、取引完了証明、seller/buyer相互評価

### 5.1 Auction作成

- Marketsで作成するのは、商材情報を内包するAuctionだけである。開始前の編集もAuction IDだけを使う。
- Auction作成はCSV-onlyを基本とし、登録前に全件previewとvalidation結果を確認できるようにする。
- Auction cardと詳細には、競売作成時に保存した公式パッケージ名・ID、評価軸名・ID、構成比率を表示する。
- Auctionは販売数量を持つmulti-unit方式とする。
- 入札は価格の高い順、同額は`reachedSequence`が早い順に順位付けする。
- 最後のwinnerだけ部分割当を許可し、全winnerは同じuniform clearing priceを支払う。
- clearing priceが0 tickとなる成立条件を仕様として許可し、`minimumPriceTick`の倍数だけを受け付ける。
- 即決価格、非公開のAutoBid上限、終了間際の延長をサポートする。
- AutoBidを取り消しても、すでに到達・確定した入札額は巻き戻さない。
- sellerの自己入札、終了後の入札、価格tick不一致、数量不正を拒否する。
- server時刻を正とし、clientでは利用者local timeへ変換して表示する。
- 最初の有効bid以後、価格・数量など結果に影響するAuction項目を変更できない。パッケージの構成・割合・最小単位・入札額の刻み・表示名は競売作成時に固定する。

### 5.2 入札時のPoints扱い

- すべてのwinnerと評価軸は同じPoints service／Points D1に属さなければならない。複数Points serviceを1 Auctionで混在させない。

### 5.3 履歴・証明・評価

- bid、作成したAuction、落札履歴とwatchlistを提供するが、通知は送らない。
- 落札証明は公開read APIで永続的に検証できる。
- 証明にはAuction ID、競売作成時のパッケージ情報、seller/buyer identity snapshot、winner、数量、clearing price、完了状態を含める。
- sellerとbuyerは相互に1〜5の評価、comment、`completionProofUrl`を記録できる。
- 外部EC claim token、匿名配送、対面決済の詳細はv0.2の実装確定事項ではなく将来候補として保持する。

### 7.1 AuctionRoom Durable Object

- 1 Auctionにつき1つの`AuctionRoom` Durable Objectを割り当てる。
- D1を永続的なSource of Truthとし、DO memoryを正本にしない。
- Durable Object Hibernation WebSocket APIを使う。
- WebSocketはread-only subscriptionとし、bid mutationは認証済みHTTPをHonoからDOへ送る。
- WebSocket URLのqueryへsession/tokenを入れない。upgrade時にOriginとsessionを検証する。
- attachmentへ秘密や巨大payloadを保存せず、識別子だけを保存する。
- client frameは最大4KiB、同一user・Auctionは最大3接続、全Auction合計は最大20接続とする。
- 独自heartbeatは送らず、切断・再接続・gap resyncを前提にする。
- `auctionVersion`と`bidSeq`を単調増加させ、gap検出時はHTTP snapshotを再取得する。
- D1へcommit後にbroadcastし、`(auctionId, commandId)`と`(auctionId, bidSeq)`を一意にする。

### 7.2 Settlement Workflow

- Auction終了時に、Cloudflare WorkflowsのSettlement Workflowを1件開始する。
- Markets D1のoutboxとsaga状態を正本にし、各stepを冪等・単調状態遷移にする。
- package vector、winner、price、quantityを同じcutoffから確定する。
- Marketsは内部の`priceTickCount`へ作成時に保存した`packageTick`を乗じ、安全整数のscale済み`priceTicks`へ変換する。各評価軸の`requiredAmountScaled = priceTicks * quantity * weight / totalWeight`をBigIntで計算し、固定最小単位の倍数かつ安全整数範囲内であることを確認してPointsへ渡す。残高照会と精算の`components`は`evaluationCriterionId`と`requiredAmountScaled`を持ち、評価軸ID昇順とする。精算では各落札者の`marketsUserId`、`accessToken`、`components`を`auctionId`と`planHash`とともに送る。Pointsは利用者認可・金額・残高を検証し、全落札者の引き落としを原子的に確定する。
- Settlement Workflowの再送・再起動は同じidempotency keyと状態から再開する。

1. `minimumReleaseAge: 4320`を使う
2. Better Auth のメール一致 implicit link は禁止し、本人は `providerId + accountId` で識別する。
3. OSSライセンスのページを用意する
4. Google/GitHubのOAuth認証を login/linkで用意する
5. PointsとMarketsの落札精算は利用者認可だけを使う。Accounts照合でクライアント資格情報が必要な場合は、その連携の仕様に従う。
6. named env の routes は staging/production domain を `custom_domain: true` で所有する。Terraform 側には同じ custom domain resource を書かない。
7. `main`の直接更新は行わず、branch／PR／merge queue経由で反映する。
8. 後方互換、旧 URL/API/schema/session fallback、旧データ移行を実装しない。
9. runtime SSR、TanStack server functions、Next Server Actions を使わない。
10. Static Assetsは次の形にし、Cloudflareの既定値に暗黙依存せず`not_found_handling: "none"`を明示する。汎用`single-page-application` fallbackは使わない。
11. Better Authは公式の`better-auth/minimal` entrypointを使い、未使用のKysely adapterをWorker bundleへ含めない。
12. 日本語と英語に対応する
    - 言語切替は同一originの`localStorage` key `freeism.fixed-page-language.v1`へ`ja|en`だけを保存する。
    - 初期値resolverは、JavaScript有効時は、同一originに保存済み有効値、`navigator.languages`内で最初に現れる`ja|en`、`en`の順で決定し、URL／query／Cookie／server content negotiation/未知／破損した保存値は参照しない。
13. Task/Group/一般 member/notification/PWA/image upload/Next.js/Auth.js/Prisma/Supabase/Upstash/SSE を新実装へ持ち込まない。
14. Points と Markets は別 Better Auth、別 host-only Cookie、別 D1、別 user ID、別 session を持つ。

- 廃止する機能
  - Taskは完全廃止する。MarketsにもPointsにもTask作成機能を置かない。
  - Groupと一般コミュニティメンバー管理は完全廃止する。
  - 評価結果のdraft、承認待ちFIX、一般memberの権限は持たない。アップロードはFIX結果だけを受け付ける。
  - 通知基盤、メール、Web Push、アプリ内通知、予約通知は廃止する。操作結果を示すtoastはUI部品として残す。
  - PWA、Service Worker、offline cache、画像アップロード、Q&A、chatは廃止する。

- Next.jsを廃止し、TanStack Start、React、Vite Plusへ移行する。
- 両アプリともSPAを基本とし、固定した公開routeだけをbuild時にSSG/prerenderする。
- runtime SSR、TanStack Start server functions、Next.js Server Actionsを使わない。
- APIは同一originのHono Workerへ`/api/*`として実装する。
- build成果物はCloudflare Workers Static Assetsで配信する。
- TanStack StartのSPA shellは`/index.html`へ出力する。`/`はbuild時に生成した静的shellからhydrateしてtop routeをclient描画するSPAであり、top route本体のSSGとは扱わない。
- build-time SSGは`/terms`、`/privacy`、`/help`、`/docs`だけに限定し、それぞれ`/terms.html`、`/privacy.html`、`/help.html`、`/docs.html`へ明示出力する。自動static route discoveryとlink crawlを無効にし、公開プロフィール、Auction、proof、認証後画面をprerenderしない。
- Workers Static Assetsはasset-first、`not_found_handling="none"`、`html_handling="auto-trailing-slash"`とする。`assets_navigation_has_no_effect` compatibility flagでasset missしたnavigationをWorkerへ到達させ、WorkerはGET/HEADのHTML navigationだけAsset Bindingのcanonical `/`からshellを取得して返す。存在しないAPI
- browserから別subdomainのAPIを直接呼ばない。各アプリの同一origin BFFを通す。
- server stateはTanStack Queryのmemory cacheを使う。IndexedDB永続cache、Service Worker cache、Next.js cacheを持ち込まない。
- 静的assetはcontent hash付き長期cache、HTMLと認証済みAPIは適切な`no-store`または短い明示cacheとする。
- バックエンドORMはDrizzleを使用する
- WCAG 2.1 AA、keyboard操作、screen reader対応

- 認証とサービス連携
  - PointsとMarketsは別ユーザー・別セッション・host-only Cookieを持つ独立アプリである。
  - Marketsは独立アカウントを作り、利用者が後からPointsを明示連携する。
  - 有効なPoints–Markets連携は、接続先ごとに1対1とする。Markets利用者は複数のPoints互換提供先へ個別に連携できる。
  - PointsのSocial Provider集合はGoogleとGitHubである。両方をログイン画面と既存ユーザーへの明示連携画面に同じように表示する。
  - Provider単位のlink-onlyを実現する独自sign-in拒否hookは実装しない。
  - 本人識別は`providerId + accountId`で行い、メール一致による暗黙linkを禁止する。
  - PointsのGitHubログインと、Accountsの外部アカウント所有権証明は、それぞれのサービスが管理する。
- 共有test環境は既存のCloudflare named environment `staging`を内部名として使い、`staging.points.freeism.app`と`staging.markets.freeism.app`で公開する。productionは`points.freeism.app`と`markets.freeism.app`を使う。
- apex `freeism.app`は`projects/main-web-app`の独立ポータルを配信し、`docs.freeism.app`、`points.freeism.app`、`markets.freeism.app`、`accounts.freeism.app`へ通常のHTTPSリンクで案内する。`www.freeism.app`はapexへ正規化する。
- ポータルとドキュメントのhosting／DNSはPoints／Markets v0.2 migrationのdeploy対象に含めず、それぞれの独立した公開境界として扱う。DNS／redirectの範囲では、Wranglerが`freeism.app`と`docs.freeism.app`のWorker custom domainおよびapex DNSを所有し、Terraformはproxied `www.freeism.app`と`https://freeism.app/`への301正規化だけを所有する。Access、WAF、rate limit、通知はTerraformが所有する。
- 廃止したapex／`www`からPointsへのredirectを再作成しない。`www`正規化ではsource pathとqueryを破棄する。
- Cloudflare Vite pluginを使うbuildでは`CLOUDFLARE_ENV=staging|production`でnamed environmentを選び、生成されたflattened Wrangler設定をdeployする。`wrangler deploy --env`だけでbuild済み成果物の環境を切り替えない。
- D1 migrationは前方互換の段階migrationにし、状態migrationを伴う自動rollbackを行わない。
- v0.2では定期R2 backupを作らず、D1 Time Travelと復旧runbookを用意する。
- Vercel、Supabase、Upstashは受入完了後にdomain、env、cron、projectを撤去する。

### branch pushのdeploy pipeline

`test/*`へのpushは共有test環境だけ、`main`へのpushはproduction環境だけを更新する。testからproductionへの自動昇格と手動production承認は置かない。

`test/*` pipeline:

1. validate、contract、unit/integration test
2. `CLOUDFLARE_ENV=staging`でPoints／Markets artifactを個別build・検証
3. Points staging D1 migration、Markets staging D1 migration
4. Points staging deploy、Markets staging deploy
5. Points staging smoke

`main` pipeline:

1. production release gate、validate、contract、unit/integration test
2. `CLOUDFLARE_ENV=production`でPoints／Markets artifactを個別build・検証
3. Points production D1 migration、Markets production D1 migration
4. Points production deploy、Markets production deploy
5. Points production smoke

両pipelineは別の固定concurrency groupで直列queueにし、`queue: max`かつ`cancel-in-progress: false`として実行中migrationをcancelしない。test artifact／credentialをproductionへ流用しない。Pointsだけproductionへ進んだ場合でも、旧Markets productionと互換なAPI contractを保つ順序でdeployする。

  2.  **指定ユーザーが落札したか示す情報を取得**
      - 目的
        1.  GitHubのIssuesなどに表示するバッジで、落札したことを証明するために必要
      - 要件
        1.  「無料主義アプリのユーザーID」と「落札ID」（オークション ID）を指定して、当該ユーザーがその落札の落札者であることの**落札証明情報**を取得する（例：落札商材の概要、落札日時、落札ID、表示用の出品者・購入者情報など。外部に見せるのに足る最小限のフィールドに絞る）
        2.  Json形式で返す
            - Shields.io を使ってバッジを表示できるJSON
        3.  **GitHub 上での明示向け**の場合の補足
            - GitHub Issueでの落札証明は、利用側サービスの検討事項とする。必要な識別情報、取得方法、公開条件を利用側の接続設計で定める。
            - 落札者であることを Issue 上で示す用に、**落札商材名**等に**リポジトリ名・Issue
              ID**の記載を求める使い方に対応しうる形にする
            - 例：APIの戻りをshields.io形式のバッジとしてIssueに貼り、出品者が応答のGitHubユーザー名とIssueコメント者を照合し、商材名・リポジトリ名・Issue IDから対象の落札証明を確認する。


- 競売は、Marketsの出品者が出品CSVで作成する。


- 出品CSVでは、出品者が利用するパッケージIDを指定する。


- Marketsは競売作成時にPointsの現在のパッケージ情報を取得し、パッケージID・表示名、各評価軸のID・表示名・最小単位・weight・表示順、totalWeight、packageTick、即決価格利用可否を競売へ保存する。作成済み競売は、その後の更新・無効化にかかわらず保存した条件で開始・精算する。


- 作成時は、取得したパッケージの`packageLifecycleStatus`が`ACTIVE`であることを確認する。評価軸の最小単位は評価軸作成後に固定する。


- 販売数量は1〜1,000とし、Packageの複数軸minimum unitからLCMによる整数package tickを作る。


- 1ユーザー1Auctionにつき有効bid position 1件とし、再入札はposition更新＋不変bid event追加とする。


- Workflow stateは正本にせず、deterministic Workflow IDとMarkets D1 outbox／reconcilerで重複起動・retention切れから回復する。


- Markets内部で扱うpackage tickの個数: suffix `TickCount`。例: `priceTickCount`、`buyNowPriceTickCount`。


- Auction event sequence: `bidSeq`、同額到達順は`reachedSequence`。


MarketsはPointsをログインProviderにしない。MarketsへGoogleまたはGitHubでログインした後、独立した操作としてPointsを明示連携する。


### 9. Durable Object/Workflow

- DO class: `AuctionRoom`
- DO binding: `AUCTION_ROOMS`
- Workflow class: `AuctionSettlementWorkflow`
- Workflow binding: `AUCTION_SETTLEMENT`
- DO IDは`auctionId`から決定論的に導出し、任意user inputをそのまま名前にしない。
- Workflow instance IDはSettlement ID、精算計画のplanHash、単調なworkflow attemptの組から決定論的に生成し、Cloudflareの100文字上限内にする。初回は`attempt:0`、通信失敗の再送は同じ精算計画のままattemptだけを増やし、完了済みinstance IDを再利用しない。



「Markets」と「Auction」の使い分け:

- product/project/domain境界は`Markets`を使う。
- Worker名とAuction domain objectだけは承認済み名称`auction-worker`、`AuctionRoom`を使う。
- 新規文書・型で旧一般名`freeismApp`、`webApp`、`auctionService`をサービス全体の名前に使わない。



### 8. WebSocket event

```json
{
	"type": "auction.updated",
	"auctionId": "auc_01...",
	"auctionVersion": 43,
	"bidSeq": 108,
	"occurredAt": "2026-07-11T12:00:00.000Z",
	"data": {}
}
```

- eventは4KiB以下。
- AutoBid上限、token、private balanceを含めない。
- errorをsocket内独自responseで処理せず、mutation errorはHTTP Problem Detailsで返す。
- gap時はHTTP snapshotへ戻る。

- mutable Auction snapshot: 短いcacheまたは`no-store`、ETag/versionを使用

## 4. Token保存とrefresh

MarketsはPoints利用者のAccess TokenとRefresh Tokenを、Markets専用D1のBetter Auth Accountへ暗号化して保存する。保存と更新には、Better Auth標準の`account.encryptOAuthTokens: true`とversioned secretsを使う。versioned secretsはWorkers Secretsで環境・アプリ別に管理し、先頭を現在の暗号化用secret、残りを旧データの復号専用secretとする。新規保存、Refresh Token rotation、再連携などの次回書き込みで現在のversionへ揃える。CASで置換するTokenにも標準の暗号化経路を使い、独自AES-GCM envelope、key ring、平文の直接INSERT、読み取り時のlazy rewrap、ciphertext件数の独自reconciliationは実装しない。標準の暗号形式とalgorithmをアプリの契約へ固定せず、旧secretの廃止は標準のrotation手順と回帰テストに従う。MarketsはPointsをログイン用Social Providerとして公開しない。Task 6Aで標準のAccount保存・更新経路と暗号化の適用を実物で検証し、標準APIで成立しない場合はreleaseを停止する。

MarketsのブラウザにはMarkets Session Cookieだけを保存する。Points TokenはMarketsのCookie、ブラウザJavaScript、`localStorage`、session payload、Problem Details、ログ、監査へ出さない。Cookie、Authorization Code、OAuth Clientの秘密鍵もログへ出さない。

MarketsはAccess Tokenの期限が切れたとき、保存済みRefresh Tokenで更新し、新しいAccess TokenとRefresh Tokenへ暗号化して置き換える。Refresh Token rotationは`pointsConnectionId`単位のD1 lease/CASでsingle-flightにし、同じRefresh Tokenを並列使用しない。lease owner、lease expiry、account token versionを条件付きUPDATEし、同時refreshではwinnerの結果を読み直す。APIが`401`を返したときの明示refreshと同じAPI要求の再試行は、それぞれ1回だけとする。`Idempotency-Key`が必須の操作では同じキーを使い、read-only操作へキーを追加しない。`401`に対するrefreshと再試行に失敗したときは、再連携を要求する。`invalid_grant`の場合は連携を`REAUTH_REQUIRED`へ進め、無限に再試行しない。

| 操作                  | key                                          | limit                                   |
| --------------------- | -------------------------------------------- | --------------------------------------- |
| bid                   | user + Auction                               | 10秒5回                                 |
| bid全体               | user                                         | 1分30回                                 |
| WebSocket upgrade     | user                                         | 1分10回                                 |
| WebSocket upgrade     | IP                                           | 1分30回                                 |
| WebSocket接続         | user + Auction                               | 同時3                                   |
| WebSocket接続         | user                                         | 同時20                                  |

| 操作                  | key                                          | limit                                   |
| --------------------- | -------------------------------------------- | --------------------------------------- |
| Auction CSV           | Markets user + operation                     | 1分2回、1時間10回                       |

| App     | Alert                            | OPEN条件                                                          | RESOLVED条件                                  |
| ------- | -------------------------------- | ----------------------------------------------------------------- | --------------------------------------------- |
| Markets | Auction transition delay         | `startsAt`／`endAt`から2分超、期待stateへ未遷移                   | 対応stateのCAS確定                            |
| Markets | WebSocket lease／gap anomaly     | expiryから2分超のlease、または5分窓のgap resync率5%超かつ20件以上 | stale lease 0、直近5分がthreshold未満         |
| Markets | Workflow／outbox／saga stuck     | 進捗なし5分超                                                     | terminal                                      |
| Markets | reconciliation mismatch          | plan、引き落とし受領証、proofが1件でも不一致                      | full reconciliation一致                       |

- 終了時点で利用者認可が有効な入札者だけを落札者にする。認可がない人は次の入札者にする。残高が足りない人は、その競売と利用者のブラックリストを1件記録してから、次の入札者にする。

- 即時購入は、購入ボタンのあとで認可と残高を確認し、成功したときだけ数量を減らす。失敗しても競売は開いたままである。
- 精算の手動再試行は置かない。

- 競売の出品CSVではパッケージIDを指定する。Marketsは作成時に現在のパッケージ情報を取得し、`packageLifecycleStatus`が`ACTIVE`であることを確認して競売条件を保存する。

- 商材と競売条件は、一つの`auction`に置く。開始前の編集と取消は、Auction IDだけを使う。

- 1つの競売は1つの`pointsServiceId`に固定し、落札者も評価軸も同じPointsのデータベースで精算する。

- 落札者のIDは、Cloudflare D1に保存する。

- Refresh Tokenの同時更新は、`pointsConnectionId`単位で1本にする。

- 競売の状態は、`DRAFT`、`SCHEDULED`、`OPEN`、`CLOSING`、`CANCELLED`である。

- Marketsは、登録した提供先のoriginへ外部のfetchで要求する。

- 対面決済、QR決済、店舗履歴は、Marketsに導入する。

- 入札は、`packageTick`単位の価格で、数量を指定して行う。

  - Marketsは独立アカウントを作り、利用者が後からPointsを明示連携する。
  - Markets利用者は複数のPoints互換提供先へ個別に連携できる。


- Marketsはreceiptを保存した後だけlocal connectionを`UNLINKED`にする

Marketsは配列の全IDが、今回送った落札候補であることを確認する。空、未知、request外のIDは手順の失敗とし、候補を除外しない。

## 9. セキュリティ、品質、release gate

- Cloudflare edge、Hono authn/authz、D1/DO invariantの多層防御を使う。
- browser mutationは同一origin、JSON、CSRF/Origin/Fetch Metadata検証、最大64KiBを基本とする。CSVだけは別途5MiB上限を適用する。
- Points Resource APIは標準JWKSでJWT署名を検証し、issuer、Points API audience、期限、Client ID、scope、Client有効状態を照合する。利用者Tokenの`sub`はPoints auth user IDとする。落札精算に、利用者のいないサービス権限トークンは使わない。- 重要mutationは`Idempotency-Key`を必須にする。
- ledger、FIX、Pointsログイン用の永久OAuth主体対応、監査eventをcascade deleteしない。退会時はprofileをclosed/anonymizedにする。
- 依存versionを完全固定し、lockfileをcommitする。`minimumReleaseAge`は4,320分、`blockExoticSubdeps`を有効にし、install scriptはallowlist化する。
- 2026-05のTanStack npm supply-chain incidentで影響を受けたversionをblockし、導入前に公式advisoryとlockfileを再確認する。
- GitHub Actionsはfull commit SHA、最小permissions、PR由来cacheをdeployに使わない構成にする。
- `main`はdirect push、force push、deleteを禁止し、required checks、up-to-date、merge queueを必須にする。現在1名運用中はapproval 0、2人目のmaintainer追加時に1へ変更する。
- 全体coverage率だけのrelease gateは設けず、金額、FIX、Accounts照合、OAuth、Auction ordering、DO resync、settlement saga、migrationのinvariant testを必須にする。
- 4固定公開ページは日本語・英語のcontent hash一致、keyboard／screen reader操作、JavaScript無効時の両言語可読性、hydration不一致0を必須testとする。英語参照訳のbilingual review記録がないreleaseをproductionへ進めない。

## 採用しないもの

- Next.js、Auth.js/NextAuth、Prisma、Supabase、Vercel、Upstash Redis、SSE
- email/password、Apple、ORCIDのv0.2認証Provider
- provider別link-onlyを作る独自Better Auth sign-in拒否hook
- email一致によるaccount merge、暗黙link、手動審査
- PostgreSQL型、RLS、PGroonga、`REAL`による金額計算
- `api.points.*`の別公開domain

1. ブラウザから同一originのAPIを利用できる  
   `points.freeism.app/api/*`、`markets.freeism.app/api/*`という構成にでき、UIから別サブドメインへ通信する必要がありません。

2. CORSとCookie共有を前提にしなくてよい  
   `points.freeism.app`から`api.points.freeism.app`を呼ぶ構成では、CORS、Origin許可、credential付きrequestなどの管理が増えます。1 Workerならhost-only session Cookieのまま同一origin BFFを利用できます。現在の仕様にも「browserから別subdomainのAPIを直接呼ばない」と明記されています。

3. PointsとMarketsの独立的に運用する
   - 別アプリとして同じようなアプリとの連携をする前提で設計したいため
   - 疎結合にする対象は「UIとAPI」ではなく「PointsとMarkets」です。アプリ間はOAuth・OpenAPI契約・登録済みoriginへの外部HTTPS通信で連携し、各アプリ内部はFull-stack Workerとして簡潔に保つ、という整理です。

## v0.2.0からv0.2.1への変更

- revision管理を廃止し、現在のレコードを更新する。実行済みの取引・証明・監査記録は保持する。
- 競売作成時にパッケージの構成・割合・評価軸の最小単位・入札額の刻み・表示名を保存し、その後の更新・無効化にかかわらず同じ条件で開始・精算する。
- Marketsが評価軸別の引き落とし額を計算し、Pointsが認証・権限・金額・残高を検証して確定する。
