## 検索欄の仕様

- 検索欄の検索機能を、以下の条件で作成してください。

  - ベクトル検索は実装せず、全文検索の実装で行う
  - 全文検索を行うために、Supabaseの拡張機能であるpgroongaを使用して、tokenizerにはTokenMecabとBigramのハイブリット型を使用してください。
    - TokenMecabは、意味に基づいた分割による検索精度の向上とトークン数の削減
    - Bigramによる、誤字脱字の対応
    - 上記二つのそれぞれのメリットを活かしたINDEXを作成して、検索では2つのINDEXを活用
  - PGroongaの類似度検索(pgroonga_score)も、&@の部分一致と一緒に使用してください。
  - PGroongaの全文検索は、「&@~」演算子の正規表現による部分一致ではなく、「&@」演算子の部分一致の検索を使用する
    - where句の絞り込みは完全一致ではなく部分一致で行う
  - Supabaseのストアドファンクション(rpc関数)は使用しない。Prisma ORMの$queryRawで全文検索を行う
  - できる限りサーバー負荷がかからず、サーバーアクセス数・I/O数が少なくなるように設計・実装
  - サジェスト(自動補完機能)機能を実装
    - デフォは上限10件で、WHERE name &^ prefixで前方一致で、pgroonga_scoreが高い順に並べて上限10件を表示
  - ハイライト検索
    - `pgroonga_highlight_html`でハイライト表示
  - パフォーマンスを最適化するために、検索パターンに応じたINDEXを作成
  - Next.jsのApp RouterではReact Server Componentsを使用して効率的なキャッシュを行う。Next.js version15の 'use
    cache'を使用する
  - 検索結果のみをサーバー側で全文検索で検索して、検索結果をstateに保持して、それ以降はクライアント側でフィルターする方法で実装
    - ファセット検索（絞り込み検索）を実装するが、カテゴリーや価格の絞り込みはstate内で行う
  - 大文字・小文字・ひらがな・カタカナの表記揺れに対応するために、正規化を行う
  - TypeScript、PostgreSQLで実装
  - 検索欄に入れた文言で、商品名と説明文を検索する

  1. **インデックス設計**

     - TokenMecabインデックス: 意味に基づいた分割による高精度な検索用

       ```sql
       CREATE INDEX pgroonga_task_text_mecab ON "Task"
       USING pgroonga ((name || ' ' || detail))
       WITH (tokenizer='TokenMecab', normalizer='NormalizerAuto');

       ```

     - Bigramインデックス: 誤字脱字に対応するための補完用

       ```sql
       CREATE INDEX pgroonga_task_text_bigram ON "Task"
       USING pgroonga ((name || ' ' || detail))
       WITH (tokenizer='TokenBigram', normalizer='NormalizerAuto');

       ```

  2. **検索クエリの最適化**

     - 両方のインデックスを組み合わせたクエリ:

       ```sql
       SELECT
         id,
         name,
         detail,
         pgroonga_score(tableoid, ctid) AS relevance_score
       FROM "Task"
       WHERE (
         (name || ' ' || detail) &@ ${query} -- TokenMecabによる検索
         OR
         (name || ' ' || detail) &@ ${query} -- TokenBigramによる検索
       )
       AND contributionType = 'REWARD'
       ORDER BY relevance_score DESC
       LIMIT 50;

       ```

  3. **検索スコアリング**
     - TokenMecabとBigramのスコアを合算して総合的な関連性を判定
     - クエリ内のキーワードと一致する頻度、位置、レコード内のフィールド（タイトルか説明か）などに基づき重み付け
  4. **検索結果のハイライト**
     - 検索結果内でマッチした部分をハイライト表示
     - `pgroonga_highlight_html`関数を使用してマッチ部分をHTML形式で強調表示
  5. **サジェスト機能の実装**
     - ユーザー入力時にリアルタイムでサジェストを提供
     - 過去の検索キーワードとタスク名称から頻出語句を優先的に表示
     - 最大10件のサジェストを前方一致で表示
