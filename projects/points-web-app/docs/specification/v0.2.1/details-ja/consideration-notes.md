# 「無料主義アプリ v0.2.1」の設計

## 前提

- Better Auth、Hono、Drizzle、D1を使う`points-worker`と、TanStack Start/Vite PlusのSPA+SSGを同じprojectで管理する。
- Points独自のGoogle/GitHubログイン・明示linkとsessionを持つ。重要操作はPointsのGoogle freshで再認証する。
- Accountsを別サービスの情報連携先として利用し、許可された外部アカウントの照合結果を貢献者の特定に使う。
- 評価結果はdraftを持たず、ADMINが不変FIX revisionとしてアップロードする。
- グローバルな同格ADMINだけを管理し、Group、一般member、評価軸別owner/adminを持たない。
- 負のFIXと負残高を許可するが、残高不足時の消費系操作は拒否する。
- Task、Auction、通知、PWA、画像は実装しない。
- v0.1データは移行しない。v0.1文書は実装履歴であり、v0.2の互換要件ではない。

- ページ
  - ドキュメントのメインページ
    - `/docs/`
  - サービス自体の操作方法
    - `/docs/usage`
  - ポイント関係のAPIドキュメントのページも用意する
    - `/docs/api`

# Points

## 概要

- ポイント管理サービス

## ポイントのプロフィール

- 必要な理由
  - ポイントのプロフィールを持つことで、それを示すだけで優先権を得る

## 要件

- ポイント保有額の非公開
  - ポイントを非公開にした場合に、加算or減算した場合でも、レスポンスに現在の保有ポイント数を入れずに返す

- ポイント管理サービスも、複数のオークションのサービスから使用できるようにしたい

- 認証フロー
  - 理想
    - オークション側で使用するポイントのサービス一覧から選択して、選択したポイント管理サービス側から保有ポイントを取得して、そのポイント管理サービス側のポイントを減算したい
    - その際に、できるだけそれぞれ別々のProviderだとしても気にせず連携できるようにしたい
    - さらに、ポイント管理サービス側では、誰が依頼してきているか特定して、その特定した人物のみデータを返す権限管理を行いたい。
    - 完全な外部サービスに対して自分であることを証明するために有名なProviderを使用する場合の実装したい
    - できれば、自社のOIDC Providerは実装したくない
  - メモ
    1. OIDC
       - 疑問
         - OIDC Access Tokenをオークション側で取得して、それをポイント側APIに投げて、ポイント側で検証するのではダメ？
         - ポイント側で`?redirect=https://....`があれば、
       - 結論
         - ダメ
         - この方法だと、両方とも同じOIDC Providerを使用してもらう必要がある
    2. OIDCは使用しない
       - ## 疑問
       - 結論
         - OIDCは、オークション側でポイント管理サービス側でログインしたサービスのIDが必要な場合のみ使用する
         - OAuthのみで十分
         - OAuthのAccess Tokenからポイント管理サービス側のIDを解決すればよいだけ

- ユーザーはOIDC。連携はAPIトークンにすることで、GUIの認証フローが負担な場合はAPIトークンで代用する

- 譲渡・交換する機能は、marketsに実装するポイントを管理する？
  - 外部サービスも使えたほうが良い？

- 退会ボタン
  - 疑問
    - 借金orポイントのマイナス状態になっていたら退会して借金のデータをチャラにして、再度アカウントを作り直すのでは？
  - ## 結論
  - メモ
    - データを全部削除する方法は用意したほうが良い
    - 利用期間が長い人は信頼できる印にする？
    - または、ポイント管理アプリ以外で評価軸チームが管理しているデータでは保持しておく

- 評価軸オーナーが、ポイントを差し引く際の挙動
  - オーナーが差し引く際に、差し引くユーザーの許諾を得る必要がある設計にする？
  - ポイント管理アプリ内で、差し引く依頼がきたことを来たことを表示して受け入れるボタンを押すことで確定できるようにする？
  - 結論
    - v0.2では、差引く際の許諾は挟まない
    - v0.3で、差し引く際の許諾を得る設定を評価軸の単位で出来るようにしたい
      - 実装の方法としては、許諾を得るフラグを持っておき、そのフラグがある場合は、ポイント付与や差引く
      - point_add_ticketsみたいに、ADDとSUBのどちらの操作をしたかもカラムで持っておき、ステータスにIN_CHECKみたいなステータスにして、そのステータスが許諾の確認中フラグ

- パッケージの権限の管理
  - 課題
    - パッケージ指定で、評価軸ポイントを加算 or 減算したい場合の、権限の管理方法について考えたい
  - メモ
    - パッケージでも権限の管理が必要

- 「減算」の要件定義
  - 自分のポイントのみ評価軸オーナーの権限がない場合でも出来るようにしたい
  - 加算は、評価軸オーナーの権限が必要

- 「加算」の要件定義
  - ポイントの新規発行による付与は、評価軸オーナーの権限が必要
  - 評価のアップロードによる加算(mintのみ。通貨発行)は権限が必要だけど、ただの交換(burn and
    mint。誰かが減って、誰かが増える)だけであれば評価軸オーナーの権限は不要

- インセンティブの一致
  - 雇用者と労働者のインセンティブが一致しない状態を避けたい
  - 給料を上げない、できるだけ残業として認めない。など

- 1対1のDMはNG
  - 電気通信事業法

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
    - 外部ECサイトの注文メモに落札者が **検証用URL**
      を貼り付け、販売者・管理者が自社サイトの管理画面でそのURLにアクセスすると、クエリパラメータの `token`
      を使って落札証明を確認できる、という形です。

たとえばこうです。このURLにアクセスすると、自社サイト側で `token` を読み取り、DB上の落札証明トークンと照合します。

`https://markets.freeism.app/claims/verify?token=ea6a8133-6bd1-3796-c1cb-176f774d2dc1`

ここで大事なのは、**URLにアクセスしただけでは受け渡し完了にしない**ことです。<br>
URLアクセスはあくまで「検証結果の表示」までにして、`used` や `completed` にする処理は管理画面上のボタン操作、つまり
`POST` 処理で行うのが安全です。

URL設計管理画面URLは、次のような形で十分です。

```text
GET /admin/claims/verify?token=AUC-7KQ9-M2VD-P8RA
```

ただし、実際にはトークンはもう少し長く、推測できないランダム値にしたほうが良いです。

例です。

```text
https://your-auction-site.com/admin/claims/verify?token=clm_8fJ29xLmQp7vR4sAzK6TnY
```

ユーザーに見せる表示はこうです。

```text
外部ECサイトの注文メモに、以下のURLを貼り付けてください。

https://your-auction-site.com/admin/claims/verify?token=clm_8fJ29xLmQp7vR4sAzK6TnY
```

もしくは、外部ECの注文メモ欄が短い場合は、URLではなくコードだけでも良いです。

```text
落札証明コード: clm_8fJ29xLmQp7vR4sAzK6TnY
```

販売者側の管理画面に、コード貼り付け用の入力欄も用意しておくと親切です。

管理画面で表示する内容URLアクセス時に、管理画面では次のような表示にすると分かりやすいです。

```text
落札証明の確認結果

ステータス: 有効
商品名: ○○○○
オークションID: AUC-12345
落札日時: 2026年7月6日 21:15
受け渡し期限: 2026年7月13日 23:59
外部EC注文ID: 未登録
受け渡し状態: 未完了
```

注意表示も入れると良いです。

```text
この証明は有効です。
外部ECサイト上の注文内容と商品名・金額・購入者情報を確認してから、受け渡しを行ってください。
```

無効な場合は、理由を明確にします。

```text
この証明コードは無効です。
理由: 期限切れ
```

または、

```text
この証明コードはこの販売者の商品ではありません。
```

この「販売者不一致」はかなり重要です。<br>
管理画面にアクセスしている販売者が、その落札商品の出品者本人でない場合は、詳細を表示しないほうが良いです。

DB設計最低限、次のようなテーブルで管理できます。

```sql
auction_claim_tokens (
  id BIGINT PRIMARY KEY,
  auction_id BIGINT NOT NULL,
  listing_id BIGINT NOT NULL,
  winner_user_id BIGINT NOT NULL,
  seller_user_id BIGINT NOT NULL,

  token_hash VARCHAR(255) NOT NULL UNIQUE,

  status VARCHAR(32) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  used_at DATETIME NULL,
  revoked_at DATETIME NULL,

  verified_count INT NOT NULL DEFAULT 0,

  external_order_id VARCHAR(255) NULL,

  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
```

`status` は例えばこうです。

```text
unused       未確認・未使用
verified     確認済み
used         受け渡し完了
expired      期限切れ
revoked      無効化済み
```

ただし、`expired` はDBに保存せず、`expires_at < now()` で都度判定しても構いません。

トークンは平文保存しないトークンはDBにそのまま保存しないほうが良いです。<br>
URLに入れて、貼り付ける前に流出してしまうとURLに入る値なので、万が一ログやDBが漏れたときのリスクを下げるためです。トークンは発行し直さないトークンのコピーした内容を忘れたら発行し直せば良い貼り付けられたら忘れても問題ない

発行時はこのようにします。

```text
token = ランダムな十分長い文字列
token_hash = sha256(token + server_secret)
```

DBには `token_hash` だけ保存します。<br>
検証時は、URLから受け取った `token` を同じ方法でハッシュ化し、DB検索します。

```ts
const token = req.query.token;
const tokenHash = sha256(token + SERVER_SECRET);

const claim = await db.claimTokens.findByTokenHash(tokenHash);
```

トークンは最低でも128bit以上のランダム性を持たせるのが良いです。<br>
`AUC-12345` のような連番ベースは避けてください。

検証ロジック管理画面URLにアクセスされたら、バックエンドでは次の順番で確認します。

```text
1. 管理者・販売者としてログインしているか
2. token が存在するか
3. token_hash に一致するレコードがあるか
4. 期限切れではないか
5. revoked ではないか
6. used ではないか
7. ログイン中の販売者が seller_user_id と一致するか
8. 商品・オークション情報を表示する
```

URLアクセス時にやってよいこと・だめなことURLアクセス時、つまり `GET /admin/claims/verify?token=...`
でやってよいのは、基本的に「確認」と「ログ記録」までです。

やってよいことは、たとえば次です。

```text
検証結果を表示する
verified_count を増やす
verified_at を更新する
アクセスログを残す
```

一方で、URLアクセスだけで次の処理をするのは避けたほうが良いです。

```text
受け渡し完了にする
トークンを使用済みにする
注文を確定する
発送済みにする
返金不可にする
```

これらは必ずボタン操作にして、`POST` で処理します。

```text
POST /admin/claims/:claimId/complete
```

画面上にはこういうボタンを置きます。

```text
[受け渡し完了にする]
```

押下後に確認画面を出しても良いです。

```text
この落札証明を受け渡し完了にします。
完了後、この証明コードは再利用できません。
```

トークン付きURLの注意点クエリパラメータにトークンを入れる方式は実装しやすいですが、いくつか注意があります。

まず、URLはブラウザ履歴、サーバーログ、外部ECサイトの注文メモ、アクセス解析などに残る可能性があります。<br>
なので、トークンには個人情報や内部情報を含めないでください。

良い例です。

```text
token=clm_8fJ29xLmQp7vR4sAzK6TnY
```

悪い例です。

```text
token=user_123_listing_456_winner_true
```

また、管理画面では外部の広告タグや解析タグを読み込まないほうが良いです。<br>
読み込む場合、URLの `Referer` 経由でトークンが漏れる可能性があります。

HTTPヘッダーも設定しておくと安全です。

```http
Referrer-Policy: no-referrer
Cache-Control: no-store
```

また、検証後はURLからトークンを消す設計もおすすめです。

たとえば、最初にこのURLにアクセスします。

```text
/admin/claims/verify?token=clm_8fJ29xLmQp7vR4sAzK6TnY
```

サーバー側で検証したあと、問題なければ次のようにリダイレクトします。

```text
/admin/claims/12345
```

こうすると、ブラウザのアドレスバーや以後の画面遷移にトークンが残りにくくなります。

理想的にはこの流れです。

```text
GET /admin/claims/verify?token=xxxxx
↓
token を検証
↓
claimId を特定
↓
権限チェック
↓
302 Redirect /admin/claims/{claimId}
↓
詳細画面表示
```

ただし、`/admin/claims/{claimId}` でも必ずログインユーザーの権限チェックはしてください。

外部EC注文IDも後から登録できるようにする

販売者が検証画面にアクセスしたあと、外部ECサイトの注文IDを入力できるようにすると運用が安定します。

```text
外部EC注文ID: [ ORDER-123456 ] [保存]
```

これを保存しておけば、後から問い合わせやトラブルがあったときに追跡しやすいです。

```sql
external_order_id VARCHAR(255) NULL
external_platform VARCHAR(64) NULL
```

たとえば、

```text
external_platform: mercari
external_order_id: m123456789
```

のように保存できます。

画面パターン管理画面では、少なくとも次のパターンを用意すると良いです。

```text
有効
期限切れ
使用済み
無効化済み
存在しない
販売者不一致
ログインが必要
token未指定
```

特に「販売者不一致」は、詳細を出しすぎないほうが良いです。

良い表示はこれです。

```text
この落札証明は、あなたが確認できる商品ではありません。
URLまたは証明コードをご確認ください。
```

悪い表示はこれです。

```text
この商品は seller_id=999 の商品です。
落札者は user_id=123 です。
```

不要な情報漏えいになるので避けるべきです。

実装方針としての結論この計画なら、次の設計が一番良いです

```text
落札者に発行するもの:
検証用URL

URL:
https://your-auction-site.com/admin/claims/verify?token=xxxxx

URLアクセス時:
ログイン必須
token を hash 化してDB照合
販売者権限を確認
有効期限・使用済み・失効状態を確認
結果を管理画面に表示

状態変更:
URLアクセスだけでは完了にしない
受け渡し完了は POST ボタンで実行

セキュリティ:
高エントロピーのランダムトークン
DBには token_hash のみ保存
有効期限を設定
Referrer-Policy と Cache-Control を設定
検証後は token なしURLへリダイレクト
```

- 自社オークションで商品が落札されたタイミングで、自社サイト側が落札証明用のランダムトークンを発行する
- トークンは、落札者本人が外部ECサイトの注文メモに貼り付けるための検証用URLとして表示する
- 検証用URLの形式は、たとえば
  [https://your-site.com/admin/claims/verify?token=xxxxx](https://your-site.com/admin/claims/verify?token=xxxxx)
  のようにする
- URLに入る token=xxxxx は、ユーザーID・商品ID・落札IDなどを含めた文字列ではなく、十分長く推測困難なランダム文字列にする
- トークンの平文はDBに保存しない
- DBには、トークンをハッシュ化した token_hash だけを保存する
- トークン発行時には、サーバー側で平文トークンを生成し、その場でハッシュ化してDBに保存する
- 発行直後の画面では、平文トークンを含んだ検証用URLを落札者に一度だけ表示する
- 落札者は、その検証用URLをコピーして外部ECサイトの注文メモや備考欄に貼り付ける
- 販売者は、外部ECサイトの注文詳細画面にある検証用URLをクリックする
- 検証用URLにアクセスすると、自社サイトの管理画面に遷移する
- 管理画面に未ログインの場合は、ログイン画面へ遷移させる
- ログイン後、元の検証用URLに戻し、クエリパラメータの token を使って検証する
- 検証時には、URLから受け取った平文トークンをサーバー側で同じ方法でハッシュ化する
- ハッシュ化した値とDB上の token_hash を突合する
- 一致するレコードがあれば、そのトークンに紐づく落札証明レコードを取得する
- 一致するレコードがなければ、「無効な落札証明URL」として表示する
- 落札証明レコードには、落札ID、商品ID、落札者ID、販売者ID、トークンハッシュ、有効期限、使用状態、失効状態、検証回数、作成日時、更新日時を保存する
- 管理画面では、ログイン中の販売者が、その落札証明に紐づく販売者本人かどうかを確認する
- 販売者が一致しない場合は、商品名や落札者情報などの詳細を表示せず、「この落札証明は確認できません」と表示する
- 販売者が一致する場合は、商品名、オークションID、落札日時、有効期限、受け渡し状態などを表示する
- 検証時には、有効期限切れでないかを確認する
- 検証時には、すでに受け渡し完了済みでないかを確認する
- 検証時には、トークンが失効済みでないかを確認する
- URLアクセスだけでは、受け渡し完了にはしない
- URLアクセス時に行う処理は、検証結果の表示、検証回数の更新、検証日時の記録、アクセスログの保存までにする
- 受け渡し完了は、管理画面上の「受け渡し完了にする」ボタンから実行する
- 「受け渡し完了にする」処理は、GETではなくPOSTで実行する
- 受け渡し完了後は、その落札証明を used または completed 状態に変更する
- 受け渡し完了後は、同じトークンで再度有効な受け渡し処理ができないようにする
- トークンの検証自体は、期限内かつ未完了であれば複数回可能にしてよい
- ただし、受け渡し完了処理は一度きりにする
- 平文トークンはDBに保存しないため、落札者が後から同じ検証用URLを自社サイト上で再表示することはできない
- 落札者がURLをコピーし忘れた場合や紛失した場合は、同じURLを再表示するのではなく、新しいトークンを再発行する
- 再発行時には、古いトークンを無効化する
- 再発行時には、「以前のURLは使えなくなります。すでに外部ECサイトに貼り付けた場合は、新しいURLに差し替えてください」という確認を出す
- 再発行された新しいURLも、発行直後に一度だけ表示する
- 古いURLにアクセスされた場合は、「この落札証明URLは再発行により無効化されています」と表示する
- 外部ECサイトの注文メモにすでに貼られたURLが無効になる可能性があるため、再発行操作は落札者に明確に注意喚起する
- トークン付きURLには個人情報を含めない
- トークン付きURLには、ユーザーID、商品ID、落札金額、メールアドレス、電話番号などを直接含めない
- トークンは、意味を持たないランダムな文字列にする
- トークンは、最低でも128bit以上のランダム性を持たせる
- トークンの例は clm_8fJ29xLmQp7vR4sAzK6TnY のような形式にする
- AUC-12345 のような推測しやすい連番形式は避ける
- DBに保存する token_hash は、可能であれば単純なハッシュではなく、サーバー側の秘密値を加えたHMACまたはpepper付きハッシュにする
- 検証用URLがブラウザ履歴やログに残る可能性を考慮する
- 管理画面では、Cache-Control: no-store を設定する
- 管理画面では、Referrer-Policy: no-referrer または少なくとも same-origin を設定する
- 管理画面では、外部の広告タグや不要なアクセス解析タグを読み込まない
- 検証後は、可能であれば token 付きURLのまま画面を表示し続けず、検証後に token なしの詳細画面へリダイレクトする
- たとえば、最初に /admin/claims/verify?token=xxxxx へアクセスし、検証成功後に /admin/claims/12345 へリダイレクトする
- token なしの詳細画面でも、必ずログインユーザーの権限チェックを行う
- 外部ECサイトの注文IDを、販売者が管理画面で登録できるようにする
- 外部EC注文IDを保存することで、後から注文と落札証明を照合しやすくする
- 外部EC注文IDの保存項目として、external_platform と external_order_id を用意する
- 管理画面では、外部EC注文IDが未登録の場合に入力欄を表示する
- 販売者が外部EC注文IDを保存した後も、落札証明の権限チェックと状態チェックは継続する
- 表示すべき状態は、有効、期限切れ、使用済み、失効済み、存在しない、販売者不一致、ログイン必須、トークン未指定の8種類を最低限用意する
- 有効な場合は、販売者に「外部ECサイト上の商品・注文内容と照合してから受け渡ししてください」と表示する
- 無効な場合は、無効理由を分かりやすく表示する
- 販売者不一致の場合は、詳細情報を出さずに、確認権限がないことだけを表示する
- この方式は、数学的な署名付き証明書ではなく、DBに保存した落札証明データとトークンを突合する方式として扱う
- ただし、安全性は、トークンのランダム性、ハッシュ保存、有効期限、失効管理、使用済み管理、販売者権限チェックによって担保する
- このトークンで証明できることは、「このURLを提示した人が、自社サイトが発行した有効な落札証明トークンを持っていること」
- このトークンだけで、「URLを持っている人が必ず落札者本人であること」までは証明しない
- そのため、外部EC注文情報、販売者確認、受け渡し完了処理、検証ログを組み合わせて運用する
- 最終的なMVP方針は、「ハッシュ保存されたランダムトークンを使い、発行直後だけ検証URLを表示し、紛失時は再表示ではなく再発行し、販売者が管理画面で検証して受け渡し完了をPOSTで確定する」という設計にする

- GitHub連携の決済
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

- 対面決済の機能
  - 説明
    - ポイントの使用場所を増やしたい
    - オークションだけでなく、決済手段としても使用する
  - 要件定義
    1. `points`と`markets`のどちらに、この機能を入れるのか迷う
       - メモ
         - 同じサービス内に入れたほうが良い機能なので、対面決済は`points`サービス内に入れる
       - `points`に持たせる場合
         - ポイントを保持する部分なので整合性が高い
         - でも、QRコード決済をするときに、`markets`の内容を知る必要があり、pointsがmarketsに依存するのは避けたい
       - 結論
         - `markets`にする
         - pointsがmarketsに依存するのは避けたい
         - marketsは、pointsからデータを取得するし、店舗登録の情報もある
         - 消費する機能のテンプレのサービスは、marketsにまとめたい
    - 外部サービスから決済のみ使用できるようにもしたいので、`/external/`apiとして定義したい
  - v0.2
    - 目の前で消費ボタンを押すだけ
    - 店舗毎に、自身の店舗に決済してくれた履歴は持たない
    - 対面で画面を見せながら指定パッケージの消費ボタンを押したら消費する
    - それを決済の代わりとする
  - v0.3
    - 提供した証拠としてデータを残す為に、店側がQRコードを作成できて、それを読み取ったら無料主義ポイントの決済で支払われるようにする
    - それで店側に決済履歴を残してデータをエクスポートして貢献度の算出に使える様にしたい

- `markets`, `points`に通知機能を残す？
  - 結論
    - 残す
  - 残さない理由
    - 再度使用したければバージョン管理しているので、そこから取得したら良いだけ
    - コメントアウトではなく、コードベースから削除する
    - 無料主義の根幹は、貢献度の算出ロジックとポイント管理(`points`)の為、`markets`はリッチに一旦はしない
  - 通知機能で使えそうな権限
    - `<usermedia>`を使うと、ブラウザのカメラなど権限要求がユーザ操作起点でできる＆拒否しても再度権限要求できて良い、ということらしい。いいですね。`getUserMedia()`地味に面倒だったからな。
    - https://developer.chrome.com/blog/usermedia-html-element?hl=ja

- 使用するスタック
  - Cloudflare Workers
  - Cloudflare D1
  - Drizzle
    - Prisma ORMは遅いし、D1とは相性が悪い
    - DDrizzleは速い
  - Hono
    - バックエンド
  - Vite-Plus
  - pnpm
    - パッケージマネージャー
    - モノレポに強い

- フォルダ構成
  - ルール
    1. ドメイン毎に分けるのは避けたい
       - APIルートのファイルやフォルダ構成でドメイン毎に分けない
       - ドメイン跨ぐことが多い為
    2.
  - `infra/{table_name}`
    - Table操作系やカラム定義を実装
    - テーブル操作が変わっても、他が影響を受けない様に閉じ込める
  - `domain/{rule_name}`
    - ドメインのルールを実装
  - `infra/config/drizzle`
    - Drizzle定義
  - `infra/config/cloudflare`
    - claudflareの設定項目

  usecase → domain → infra

RateLimitは、Cloudflare Workers側の設定でRateLimitを設定する

- Tanstack Query
  - API取得結果をキャッシュしてstate管理できるシンプルなライブラリ
  - TanStack Queryは、基本的にAPIレスポンス単位でデータを持ちます
  - APIごとのデータを扱うシンプルさ
- Tanstack DB
  - https://tanstack.com/db/latest
  - クライアント側でDBみたいなデータ構造を作る
  - TanStack Queryだけだと、**APIレスポンスをどう合成するかは各画面が考える**。
  - TanStack DBだと、**Collection群に対して問い合わせれば、画面に必要なビューを作れる**。
  - 一箇所でしか使用していないデータやAPIは、Tanstack Queryで実装したほうが良い
  - TanStack DBは、TanStack Queryで取得したAPIデータをCollectionに流し込み、そのCollectionに対して `useLiveQuery`
    で問い合わせる構成にできます
  - 使用場面
    1. Tanstack Queryはデータ取得の柔軟性がある。そこで取得したデータを`Query Collection`を使用して、Tanstack
       DBに流し込む
       - Tanstack DBでもシンプルなクエリはできるが、責務の分離としてクエリはTanstack
         Queryを使用して取得したデータはTanstack DBに流す
       - `queryCollectionOptions`で、Tanstack DB内に、Tanstack Queryのクエリを書けるので、それを使用する
  - キャッシュとして、Indexed DBではなく、OPFS（Origin File Private System）
  - メリット
    1. 楽観的更新が簡単に書ける
    2. APIからの戻り値でほしい
    3. いくつかのAPI結果を組み合わせてデータを構成する画面
       - Global Stateで取得しておいて、必要な分だけクライアント側でクエリする
  - TanStack DBは、TanStack Queryで取得したAPIデータをCollectionに流し込み、そのCollectionに対して `useLiveQuery`
    で問い合わせる構成にできます
- Tanstack Form
- Tanstack Table
- Tanstack Pacer
  - RateLimit
- TanStack Hotkeys
  - 型安全で簡単に管理できるショートカットキーを作れる
- TanStack Devtools
  - 開発環境で、Tanstack系のデータ内部状況を確認できる

- Cloudflare Pagesは使用しない
  - 全部をCloudflare Workersで使用する
  - Cloudflare PagesとCloudflare Workers Static Assetsでは、静的サイトを配信する際の料金・制限は同じなので、Cloudflare
    Workersに揃えてOK！
  - https://www.creationline.com/tech-blog/agile-devops/devops/83003
  - それにより、`wrangler.jsonc`でカスタムドメインも定義できる

- Supabaseは使用しない
  - Cloudflare D1を使用する

- Vercelは使用しない
  - Cloudflare Workersを使用する

- Ias化する
  - `wrangler.jsonc`で、デプロイ方法やカスタムドメインもすべて設定する
  - Workersまで達するまでの設定は、Terraformで行う

- 画像添付機能は廃止する

- SSRはせず、SSGとSPAを使用する
  - ビルド時に情報が変わらない場合はSSG
  - 情報が変わる場合はSPA

- Server Functionsは使用しない
  - 理由
    1. 混乱せず統一するため
       - 外部から呼び出しするAPIもあるので、API Routesが必要
       - なので、バックエンドは混乱しないためAPI Routesにしておきたい
    2. Server Functionsが使えないフレームワークに移行する可能性があるため

- SSG
  - 静的ページはすべてSSGとして生成する

- バックエンド
  - パブリックのPI
    - `/external/`
  - サービス内のAPI
    - `/internal/`

- `freeism.app`のサブドメインにする
  - サブドメインにする事で、独立したサービスであることを示し、サービス自体も外部サービスとして扱う
  - 疎結合にしておく

- CORS
  - 外部からアクセスするパブリックAPIの場合に、CORSは関係ない
  - CORSはブラウザだけで、別サーバーやcurlではCORSは無いため
  - そのため、CORSを認証として使用してはダメ

- データ移行を簡単にする
  - インポート
    - `profile-example.csv`

- v0.2 では、サーバー負荷とデータ取得回数を減らすため、更新頻度の低いデータはキャッシュし、リアルタイム性が必要なデータはキャッシュしない方針にする。
- キャッシュは、フロントエンドとバックエンドで役割を分ける。
  1. フロントエンド
  - TanStack Query で画面表示用データをキャッシュする。
  - mutation 後は、関連する query key を invalidate する。
  - TanStack Query の永続化は IndexedDB を使わなくて良い。
  2. バックエンド
  - Cloudflare Cache にキャッシュを保存する。
- 基本的には DB 更新後に該当するキャッシュを削除する。
- 高頻度で更新される情報は1時間毎などでstaleにする。
- WebSocketなどリアルタイム性が必要なデータはキャッシュしない。

| `projects/points-web-app` | `points.freeism.app` | `points-worker` | 認証、評価軸、FIX、残高、台帳、予約、capture/release |

- PointsユーザーとBetter Authの認証・Social Account対応
- グローバルな同格ADMIN
- 評価軸、評価軸設定、公式パッケージと不変revision
- FIX評価結果、FIX revision、差分台帳、未受領FIX
- `balance`、`evaluationTotal`、予約、capture/release
- Accountsとの情報連携、照合結果に基づくPointsユーザーへのFIX帰属
- Marketsとの提供先ごとの1対1連携、およびPoints OAuth Provider
- Marketsはこれらを複製して正本にしない。Auction表示に必要な名称・比率・ユーザー表示情報は、不変snapshotまたはPoints APIから取得した表示用データとして保持する。

### 4.1 評価軸とADMIN

- v0.2はグローバルな単一の`ADMIN` roleだけを持つ。すべてのADMINは同格で、すべての評価軸と公式パッケージを管理できる。
- owner、super admin、評価軸別admin、パッケージ別admin、一般memberを作らない。
- 最後のADMINは削除・降格できない。
- 初期ADMINは、ADMINが0人のときだけ、Secretsで指定したGoogle `accountId`と一致するログインを一度だけ昇格する。公開bootstrap routeは置かない。
- 評価軸IDは不変の文字列IDとし、生成にはNano ID相当のURL-safe IDを用いる。
- 評価軸名は30文字以下、説明は200文字以下、関連URLは最大20件とする。

### 4.2 固定小数点

- すべてのポイント額はD1の`INTEGER`に、表示値の10,000倍を保存する。固定scaleは`10_000`である。
- 表示値は小数点以下最大4桁まで扱い、設定可能な`minimumUnit`の最小値は`0.0001`である。
- `minimumUnit`はscale適用後に正の整数でなければならない。
- FIX、譲渡、交換、予約、capture、releaseの額は、対象評価軸の`minimumUnit`の倍数でなければならない。
- 浮動小数点`REAL`を残高・比率・価格計算に使わない。入力文字列を10進として検証した後に整数化する。
- 指数表記、Unicodeマイナス、4桁を超える小数、非有限値を拒否する。
- D1 Worker APIが`BigInt`を直接扱わないため、入力・計算途中・保存値・集計値のすべてをJavaScript安全整数範囲内で検証する。

### 4.3 不変FIX revisionと差分台帳

- FIX結果はdraftを持たず、ADMINが最終結果だけをCSVでアップロードする。
- アップロード済みFIX revisionは不変とし、修正時は新しいrevisionを追加する。
- 新revisionの各対象者・評価軸の額と直前revisionとの差分だけを台帳へ記録する。
- 台帳行は不変で、`sourceFixRevisionId`を一意にして同じrevisionの二重反映を防ぐ。
- revision内の全行、差分台帳、`balance`、`evaluationTotal`、未受領状態は1回のD1原子処理で確定し、部分成功を許可しない。
- 負のFIXを許可し、結果として負の残高も許可する。
- `balance`とは別に、FIX評価の符号付き累計`evaluationTotal`を管理する。譲渡・交換・消費・予約・releaseは`evaluationTotal`を変更しない。
- 残高不足時は、譲渡、交換、予約、落札captureなどの消費系操作をすべて拒否する。単に残高が負であること自体は履歴や受領を拒否する理由にしない。

### 4.4 未受領FIXとAccounts照合

- 利用者が未登録でも、外部の貢献者を宛先として正負どちらのFIXも先に保存する。
- 未受領FIXは暫定ユーザー残高へ入れない。宛先と評価額を不変FIX revisionに保存し、受領時に実ユーザーの台帳・残高・`evaluationTotal`へ一括反映する。
- PointsはAccountsの許可済み照合結果に基づいて受領先を特定し、受領可能な正負すべての未受領FIXを選択不可で一括受領する。
- 一度受領済みのFIXとその訂正先は同じPointsユーザーに保持する。
- 照合と受領対象の詳細は[未受領FIX仕様](../../../../projects/points-web-app/docs/specification/v0.2/details-ja/unclaimed-fix-and-ownership.md)に従う。

### 4.5 CSV

- CSVはUTF-8、最大5MiB、1回最大1,000非空行とする。
- header、列数、必須値、値域を厳密に検証し、全エラーを行番号・列名付きで返す。
- client側previewは許可するが、server側draftは保存しない。確認後は1回の原子的POSTで確定する。
- 同一requestの再送は内容hashと`Idempotency-Key`で同じ結果を返し、同じkeyで異なるpayloadは`409`にする。
- 同一ファイル内の重複行はファイル全体を失敗させ、部分反映しない。
- export時は表計算ソフトのformula injectionを無害化する。

1. `minimumReleaseAge: 4320`を使う
2. Better Auth のメール一致 implicit link は禁止し、本人は `providerId + accountId` で識別する。
3. OSSライセンスのページを用意する
4. Google/GitHubのOAuth認証を login/linkで用意する
5. ユーザーの権限が不要ならM2M-only Client Credentialsを使用する
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
  - 重要操作は15分以内のGoogle fresh sessionを必須とする。GitHubだけで作成したPointsユーザーは、重要操作の前にGoogleを明示linkしてstep-upを完了する。

- `local`、`staging`、`production`を分離し、D1、Durable Object namespace、Workflow、OAuth app/client、Secretsを共有しない。
- 共有test環境は既存のCloudflare named environment `staging`を内部名として使い、`staging.points.freeism.app`と`staging.markets.freeism.app`で公開する。productionは`points.freeism.app`と`markets.freeism.app`を使う。
- apex `freeism.app`は`projects/main-web-app`の独立ポータルを配信し、`docs.freeism.app`、`points.freeism.app`、`markets.freeism.app`、`accounts.freeism.app`へ通常のHTTPSリンクで案内する。`www.freeism.app`はapexへ正規化する。
- ポータルとドキュメントのhosting／DNSはPoints／Markets v0.2 migrationのdeploy対象に含めず、それぞれの独立した公開境界として扱う。DNS／redirectの範囲では、Wranglerが`freeism.app`と`docs.freeism.app`のWorker custom domainおよびapex DNSを所有し、Terraformはproxied `www.freeism.app`と`https://freeism.app/`への301正規化だけを所有する。Access、WAF、rate limit、通知はTerraformが所有する。
- 廃止したapex／`www`からPointsへのredirectを再作成しない。`www`正規化ではsource pathとqueryを破棄する。
- publicなper-PR preview環境はv0.2で作らない。
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

## 9. セキュリティ、品質、release gate

- Cloudflare edge、Hono authn/authz、D1/DO invariantの多層防御を使う。
- browser mutationは同一origin、JSON、CSRF/Origin/Fetch Metadata検証、最大64KiBを基本とする。CSVだけは別途5MiB上限を適用する。
- Points Resource APIは標準JWKSでJWT署名を検証し、issuer、Points API audience、期限、Client ID、scope、Client有効状態を照合する。利用者Tokenの`sub`はPoints auth user ID、M2M Tokenの`sub`はClient IDとし、別scopeを要求する。Marketsは登録済みの提供先originへ外部`fetch`で要求し、OAuth Client秘密鍵は提供先ごとに暗号化してD1に保存する。
- 重要mutationは`Idempotency-Key`を必須にする。
- ledger、FIX、Pointsログイン用の永久OAuth主体対応、監査eventをcascade deleteしない。退会時はprofileをclosed/anonymizedにする。
- 依存versionを完全固定し、lockfileをcommitする。`minimumReleaseAge`は4,320分、`blockExoticSubdeps`を有効にし、install scriptはallowlist化する。
- Better Authは開発・stagingで`1.7.0-rc.1`を完全固定し、productionは1.7正式版への更新と全認証回帰test完了をrelease条件にする。
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

### 使いたい機能

- Viteの機能を使う
  - Vite 8.1の実験的なフルバンドルモード：開発サーバーの起動が~15倍高速化 & 大規模アプリでのフルリロードが~10倍高速化
  - [https://vite.dev/blog/announcing-vite8-1](https://vite.dev/blog/announcing-vite8-1)

```js
import { defineConfig } from 'vite';

export default defineConfig({
	experimental: {
		bundledDev: true
	}
});
```

- タスクランナー
  - miseではなく、vite-plusのvite-taskを使用する
  - https://viteplus.dev/guide/run
  - そして、cacheやタスク間の依存関係を設定しておきたい
