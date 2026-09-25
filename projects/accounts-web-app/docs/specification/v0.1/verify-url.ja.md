# 外部URLの登録と検証

- [外部URLの登録と検証](#外部urlの登録と検証)
  - [目的と適用範囲](#目的と適用範囲)
  - [利用者の操作](#利用者の操作)
  - [URL正規化](#url正規化)
  - [DNS TXTによる証明](#dns-txtによる証明)
  - [サービス別の識別](#サービス別の識別)
  - [証明に使用するリンクと本文](#証明に使用するリンクと本文)
  - [外部ページの取得](#外部ページの取得)
  - [検証結果と複数の証明方法](#検証結果と複数の証明方法)
  - [公開プロフィールへの掲載](#公開プロフィールへの掲載)
  - [個別対応する外部サービス](#個別対応する外部サービス)
    - [GitHub](#github)
    - [対応範囲と調査結果](#対応範囲と調査結果)
  - [検証処理の構成](#検証処理の構成)
  - [受け入れ条件](#受け入れ条件)
  - [参考資料](#参考資料)

## 目的と適用範囲

利用者がURLを一つ入力して「保存して検証する」ボタンを押すと、Accountsが対象のWebページと、取得できる外部サービスの識別情報を登録し、Accountsプロフィールへの公開されたリンク・記述を先に確認する。リンクによる証明が成立しなければ、同じ検証要求でDNS TXTによるドメイン所有権証明を確認する。

本書は、URLの登録・正規化・サービス判定・公開証拠の読み取り・検証結果と、第三者から確認できる公開HTMLを定める。OAuth・OIDCの本人認証、紐付け先の更新、公開設定、API契約、保存構造は[Accounts v0.1](main.ja.md)を正とする。

「保存して検証する」ボタンの押下を本人の登録・検証操作とし、Accounts APIによる照合は保存済みの識別子・証明・現在の紐付け・公開許可を読み取って行う。証明の有効性は、[所有権と紐付け](main.ja.md#所有権と紐付け)の現在の紐付けに従う。

## 利用者の操作

1. Accountsにログインした本人が、「アカウント連携」画面の一つの入力欄へURLを入力し、「保存して検証する」ボタンを押す。サービスの判定はAccountsが行う。「未検証で保存」を選んだ場合も、URLの構文と取得先の安全性の検査、サービス判定、登録数の上限の確認を行い、URLを`unverified`として登録する。外部ページの取得とDNS TXTの照会は「保存して検証する」でのみ行う。「未検証で保存」は、既存の登録・証明・紐付けを変更しない。
2. 「保存して検証する」を押した場合、Accountsのバックエンドがセッションから`user.id`を取得し、DB上の本人のプロフィール情報から、そのユーザーの公開プロフィールURLを確定する。操作主体と証明先は、このサーバー側の情報を根拠にする。
3. URLの構文と取得先の安全性を検査・正規化し、外部サービス、入力URLの種類、取得できる外部アカウントの識別情報を判定する。不正な入力は入力エラーとして示す。
4. 入力URLが未登録でも対象として受け付け、公開ページから本人のAccounts公開プロフィールURLを示す証拠を先に確認する。リンクによる証明が成立した場合は、その結果を保存する。ページを取得できない場合やリンクが一致しない場合を含め、リンクによる証明が成立しなければ、同じバックエンド要求で入力URLのhostのDNS TXTを確認する。
5. DNS TXTが一致した場合は`dns_txt`の成功証明を保存する。いずれも成立しなければ入力URLを未検証として保存する。試行した方法ごとの直近結果を保存し、成功した証明と対象の識別子を本人の外部アカウントへ対応付ける。同じ外部アカウントにOAuthとWebの証明を追加できる。
6. 本人が選択した公開設定に従い、Accountsの公開プロフィールや許可されたOAuthクライアントへ情報を提供する。提供対象は[公開設定](main.ja.md#公開設定)に従い、未検証の登録情報は本人向けに管理する。

Web URLは、未検証の登録を含めて1ユーザー150件までとする。数える対象は本人の`kind='url'`の全行であり、本人が登録したURL、証明で自動的に保存されたプロフィールURL、OAuth由来のURLを含む。登録・検証・OAuth連携・復元で`url`行を追加する前に、現在の行数が150未満であることを確認し、150に達していれば追加を拒否して上限到達を本人に示す。同一ユーザーの同じ正規化URLは一つの登録として扱う。この上限は登録URL数の上限であり、検証リクエストの頻度制限は[検証要求の制御](main.ja.md#検証要求の制御)に従う。

## URL正規化

登録するURL、API照合の入力URL、外部ページから得た証明候補には、同じ純粋関数による正規化を適用する。URLの構造は標準のURLパーサーで検査し、次の規則で比較用の文字列へ整える。

- schemeとhostを小文字化し、国際化ドメインをASCII/Punycode表現に統一する。
- HTTPSを受け付け、既定のportとfragmentを除去する。
- 空のpathを`/`に統一する。
- queryとpathの意味を保持する。末尾slash、`/about`などのpath、subdomainは、それぞれのURLとして区別する。
- percent encodingは、同じ値を表す安全な範囲で表記を統一する。予約文字の符号化によるpathやqueryの意味を保持する。
- 末尾ドットを含むhost（`github.com.`など）は入力エラーとする。
- 外部URLの受付には、[外部ページの取得](#外部ページの取得)のscheme・port・userinfo・hostの制約を適用する。

例えば、`https://example.com/`、`https://example.com/about/`、`https://profile.example.com/user`は別のURLとして登録・証明する。それぞれが同じAccountsユーザーへ有効に紐付き、問い合わせ元への提供が許可されていれば、各URLの照合で同じユーザーを返せる。

一致条件は正規化後のURL全体の完全一致とする。期待するURLが`https://accounts.freeism.app/profiles/alice`なら、同じURLを文字列の一部に含む別path・別host・queryは別のURLである。ネットワーク取得による証拠の確認と、文字列の正規化を分けて扱う。

正規化の基準は[WHATWG URL Standard](https://url.spec.whatwg.org/)と[RFC 3986 §6.2.2](https://www.rfc-editor.org/rfc/rfc3986.html#section-6.2.2)とする。

## DNS TXTによる証明

DNS TXTレコードの値は、本人のAccounts公開プロフィールURL `https://accounts.freeism.app/profiles/{accountsUserId}` とする。互換サービスでは、そのサービスのoriginを用いた公開プロフィールURLとする。期待する公開プロフィールURLのoriginは、環境設定の公開originとする。証明先は[利用者の操作](#利用者の操作)に従い、セッション本人の情報からAccountsのバックエンドが決定する。

入力URLのリンクによる証明が成立しなかったとき、Accountsのバックエンドが同じ要求で対象hostのDNS TXTレコードを取得し、本人のAccounts公開プロフィールURLとの一致を確認して結果を保存する。入力URLのhostが既知サービスのhostでも同じ扱いとする。再度同じURLを検証した場合も今回の方法別結果を直近の試行として記録し、既存の有効な証明と現在の紐付けは[所有権と紐付け](main.ja.md#所有権と紐付け)に従って扱う。

TXTレコードの名前は`_accounts.{host}`とし、証明対象のhostは`{host}`とする。`example.com`を証明する場合は`_accounts.example.com`、`blog.example.com`を証明する場合は`_accounts.blog.example.com`をレコードの名前とする。既存のTXTレコードはそのまま残せ、Accounts公開プロフィールURLを値とするTXTレコードを追加する。

TXTレコードは、Workersの`node:dns/promises`の`resolveTxt`で取得する。この照会は1.1.1.1へのDNS over HTTPSで行われ、subrequestとして数える。各レコードのcharacter-stringを連結し、[URL正規化](#url正規化)を適用して、期待する公開プロフィールURLとの完全一致を判定する。CNAMEの行は無視する。DNS照会の期限は3秒とし、[外部ページの取得](#外部ページの取得)の5秒とは別に数える。[Workersのnode:dns](https://developers.cloudflare.com/workers/runtime-apis/nodejs/dns/)

一致するTXTが無い場合（NXDOMAIN・NODATAを含む）は`not_verified`、SERVFAIL・timeoutなどの取得の失敗は`indeterminate`とする。TXTに同じAccountsサービスの異なるユーザーの公開プロフィールURLが複数ある場合は、[リンクによる証明](#証明に使用するリンクと本文)と同じ規則で`indeterminate`とする。TXTを追加した直後は、DNSの反映やリゾルバのキャッシュにより不一致が続くことがあるため、時間をおいて再検証するよう結果の案内に含める。

「アカウント連携」画面の入力欄の近くに、本人の公開プロフィールURL（TXTの値を兼ねる）とコピー操作を表示する。

DNS TXTで`example.com`の所有権を証明した場合、同じhostとして登録済みの`https://example.com/`や`https://example.com/about`など、pathやqueryが異なるURLすべてを証明対象とする。hostは[URL正規化](#url正規化)に従って正規化した値の完全一致で判定する。`www.example.com`を含むサブドメインは別hostとして、それぞれ証明する。

証明対象は今回入力したURLと、同じhostで本人が登録済みのURLとする。入力URLは未登録でも登録して証明対象に含める。DNS TXTの証明でhost内のほかのpathやqueryを列挙・登録することはない。DNS TXTの成功は、対象URLを含む各外部アカウントに、hostを`evidence_key`とする`dns_txt`の証明行を作り、外部アカウントは統合しない。対象となる各URLの現在の紐付けは[所有権と紐付け](main.ja.md#所有権と紐付け)に従い、同時点で最大1人のAccountsユーザーとする。照合・提供には各URLの現在の証明済み紐付けと[公開設定](main.ja.md#公開設定)を適用する。

## サービス別の識別

入力URLは、既知サービスのhost全体とpath構造に基づいて判定する。`github.com`と`github.com.example.net`は別hostとして扱う。個別対応するサービスでは、入力URLがプロフィールURLかコンテンツURLかも区別する。

保存する識別情報は次のように整理する。取得元と証明が適用される対象を保持し、APIでは[Accounts API](main.ja.md#accounts-api)で定める型として提供・照合する。

| 情報                 | 取得元と扱い                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| 正規化URL            | 本人が登録したURL。汎用Webページでは、このURLを外部の識別子とする                                           |
| 外部サービス名       | 既知hostと対応するURL規則から判定し、下表のProvider識別子で保存する                                         |
| サービス内ユーザー名 | 個別対応サービスのプロフィールURLのURL規則、またはOAuth・OIDCの検証済み応答から得る。変更可能な名前として固有IDと区別する |
| サービス内固有ID     | OAuth・OIDCの検証済み応答から保存する                                                                       |
| プロフィールURL      | 個別対応サービスのプロフィールURLのURL規則、またはOAuth・OIDCの検証済み応答から保存する                     |
| 証拠のURL            | リンクや記述を実際に確認したページのURL（最終取得URL）を保存する                                            |

Provider識別子とユーザー名の正規化は次のとおりとする。[Accounts API](main.ja.md#accounts-api)が受け付けるProviderは、この表の値とする。

| Provider識別子  | サービス       | 取得経路             | ユーザー名の小文字化 | 確認元 |
| --------------- | -------------- | -------------------- | -------------------- | ------ |
| `google`        | Google         | OAuth・OIDC          | 対象外（固有IDで照合する） | - |
| `github`        | GitHub         | OAuth・URL規則       | する                 | 未確認 |
| `orcid`         | ORCID          | OAuth・OIDC          | 対象外（固有IDで照合する） | - |
| `gitlab`        | GitLab         | URL規則              | する                 | 未確認 |
| `stackoverflow` | Stack Overflow | URL規則              | 対象外（数値IDをユーザー名相当の識別子とし、slugは保存しない） | - |
| `qiita`         | Qiita          | URL規則              | する                 | 未確認 |
| `note`          | note           | URL規則              | する                 | 未確認 |
| `zenn`          | Zenn           | URL規則              | する                 | 未確認 |
| `codeberg`      | Codeberg       | URL規則              | する                 | 未確認 |
| `x`             | X              | URL規則              | する                 | 未確認 |
| `huggingface`   | Hugging Face   | URL規則              | する                 | 未確認 |

Provider表で小文字化が「する」のサービスでは、URL規則とOAuth・OIDCのどちらから得たサービス内ユーザー名も小文字化して保存・照合する。大文字小文字を区別することを公式資料で確認したサービスを個別対応に加える場合は、Provider表で例外として定める。

サービス名・ユーザー名などの補助情報は、入力URLと最終取得URLにURL規則を適用して得られる範囲で保存する。URLの登録・リンク検証が必要とするページ取得と、利用者が開始したOAuth認証を通信の範囲とする。

URLを解析できることと所有権の証明成功は別の結果として扱う。未検証のURLから得たユーザー名は登録情報であり、証明が成功した対象にだけ、その証明結果を対応付ける。サービス固有の識別子が得られないページも、正規化URLによる登録・検証を行える。

OAuthで得た固有IDとURLから得たユーザー名は、異なる種類の識別子である。同じ外部アカウントの情報としてまとめる際は、本人の操作と、検証済みのOAuth応答・公開証拠が示す対応を根拠にする。各証明は、実際に確認できた識別子の範囲へ適用する。

サービス内ユーザー名・プロフィールURLへの証明の適用は、プロフィールページ（そのアカウントだけが編集できるページ）の証拠と、OAuth・OIDCの検証済み応答に限る。個別対応サービスのプロフィールURLの証明が成功した場合は、そのアカウントのユーザー名・プロフィールURLを入力URLとともに同じ外部アカウントへ保存し、この証明を適用する。記事・投稿・Gist・Merge Request・Issue・リポジトリ・モデル・データセット・SpacesなどのコンテンツURLは汎用Webページとして登録・検証し、証明は入力URL単独に適用する。

URL規則は、redirectを追跡した最終取得URLに適用する。入力URLと最終取得URLでユーザー名が異なる場合は、最終取得URLのユーザー名を対象とする。ユーザー名の変更後に旧URLを入力した場合を想定する。入力URLの検証後に別のプロフィールURLの取得や外部API通信は行わない。

組織アカウント（GitHubの組織ページ、Codeberg・Hugging Faceの組織namespaceなど）のプロフィールURLも、個人と同じ規則でサービス名とユーザー名（namespace）を保存する。組織の外部アカウントの有効な紐付け先は、[所有権と紐付け](main.ja.md#所有権と紐付け)に従い、最後に証明した個人1人のAccountsユーザーとなる。

## 証明に使用するリンクと本文

検証対象の外部ページから、以下の候補を抽出する。

| 候補                          | 抽出する値                                                            |
| ----------------------------- | --------------------------------------------------------------------- |
| HTMLの`a[href]`と`link[href]` | `href`のURL。`head`内の`link`と本文のリンクを含む                     |
| HTTPの`Link`ヘッダー          | link-valueが示すURL                                                   |
| HTML全体の本文テキスト        | 静的HTMLのテキストノードから抽出した完全なHTTPS URL。第三者投稿の読者コメントと`code`・`pre`内のコード例も含む |
| `text/plain`の応答            | 本文から抽出した完全なHTTPS URL                                       |

- `rel="me"`を含むリンクも、通常のリンクや本文のURLと一緒に候補へ含める。
- 相対hrefは、取得した最終ページのURLを基準に解決してから正規化する。
- 本文では、URL抽出器で得たURLを比較対象にする。URLの途中までの一致や、ほかのURLのqueryに含まれる文字列は、証明先URLの完全一致と区別する。
- HTML comment、JSON、画像alt、`script`・`style`・`template`・`noscript`内の記述、JavaScriptの実行後に生成されるDOM、`iframe`内は候補から除外する。HTMLパーサーで要素・属性・テキストを区別してから抽出する。
- 本文テキストは、チャンクを連結したテキストノード単位で抽出し、要素やコメントをまたいで連結しない。`hidden`属性やCSSによる表示状態は評価せず、静的HTMLの範囲で扱う。
- テキストと属性値は、文字参照（`&lt;`・`&amp;`・`&#x26;`など）を復号してから、URLの抽出・相対URLの解決・正規化を行う。
- 個別対応サービスでも、証拠候補は取得したページの上記の範囲から抽出する。サービスの識別子は、[サービス別の識別](#サービス別の識別)のURL規則とOAuth・OIDCの検証済み応答からだけ得る。
- 候補のURLを正規化し、セッション本人に対応するAccounts公開プロフィールURLと完全一致した場合に証明を成立させる。同じ証拠候補の範囲に、同じAccountsサービスの異なるユーザーを示す公開プロフィールURLが複数ある場合は判断不能とし、新しい紐付けや紐付け先の更新を確定しない。同一URLの繰り返しは一つとして数える。それ以外で条件を満たした検証は自動で確定する。

証拠は検証した時点の公開記述を示し、ページ所有者の編集権限までは保証しない。第三者投稿の読者コメントやコード例だけに本人のAccountsプロフィールURLがある場合も一致として扱う。検証日時と方法を記録し、第三者が確認するための証拠URLを対応付ける。

リンク証明（`bidirectional_link`）単独の成功では、`dns_txt`または`oauth`の有効な証明が支えている識別子を移動しない。該当する識別子についてはリンク検証を`indeterminate`とし、その識別子が別の方法で証明済みの利用者に紐付いていることを本人に案内する。リンク証明だけが支える識別子は、再証明で今回の本人へ移動する。移動の規則は[所有権と紐付け](main.ja.md#所有権と紐付け)に従う。

## 外部ページの取得

- 取得先はHTTPS・port 443の公開Webページとする。
- 入力とredirect先でuserinfo、IP literal、localhost、private・link-local・loopback・reserved hostname/address、Cloud metadata addressを検査し、公開Internet上の宛先を許可する。
- Cloudflare Workersの`global_fetch_strictly_public`を使い、同一zoneへの要求も公開Internetからのアクセスと同じ経路で取得する。private宛先への接続制約は、入力検査と実行環境の接続制約を含めて確認する。[Cloudflareの互換性フラグ](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public)
- redirectは最大3回まで手動で追跡し、各遷移先に同じ取得先検査を適用する。登録URL、最終取得URL、実際の証拠を区別して扱う。リンク証明の`evidence_key`は正規化した入力URLとし、証拠を確認したページ（最終取得URL）は`evidence_url`に保存する。
- 全体の取得期限は5秒、応答本文の上限は1MiBとし、`text/html`または`text/plain`を受け付ける。応答を読みながら上限を確認し、上限を超えたら取得を終了する。
- 取得要求には、外部ページの取得に必要なヘッダーをAccountsが組み立てて付ける。Accountsのセッションや、利用者から受け取った認証ヘッダーは本人認証の処理で扱う。
- 「保存して検証する」の押下による検証要求ごとに外部ページを取得し、今回得た応答を証拠として評価する。証拠の内容との一致と検証日時を保存する。
- 応答HTMLとHTTPヘッダーを静的に解析する。対象は取得した文書であり、JavaScriptの実行や画像などの関連ファイルの読み込みを必要とする場合は、今回の取得で確認できる範囲を結果に示す。

期限・容量・redirectの上限は、利用者の待ち時間と取得負荷を抑えるための共通条件とする。取得不能、上限超過、解釈できない応答はリンク検証の直近結果として本人へ伝え、DNS TXTの確認へ進む。入力エラーは、入力URL自体の構文や取得先の安全性の不備に限る。redirect先の安全性違反はリンク検証の失敗（`not_verified`）とし、同じ要求でDNS TXTの確認へ進む。

## 検証結果と複数の証明方法

外部アカウント、照合に使う識別子、検証方法ごとの証明を分けて管理する。同じ外部アカウントについて、OAuthによる証明と`bidirectional_link`による証明を保持できる。保存構造は[テーブル構造の設計案](main.ja.md#テーブル構造の設計案)に従う。

| 状態・結果               | 意味                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| `unverified`（登録状態） | 登録を保存し、有効な証明の成立を待っている                                |
| `verified`               | リンクまたはDNS TXTの証拠とAccountsユーザーのプロフィールURLが一致した。リンクの場合はページの編集権限の確認を意味しない |
| `not_verified`           | 対象を取得・解釈できたが、期待する証拠が確認できなかった                  |
| `indeterminate`          | timeout、外部のアクセス制限、取得上限、応答形式、異なるAccountsユーザーへのURLの併存などにより判断できなかった |

直近の試行の`result`は`verified`・`not_verified`・`indeterminate`のいずれかとする。リンク設置、公開状態の変更、OAuthによる証明など、本人の次の操作の案内は、直近の試行の`failure_code`から導いて表示する。方法別の検証結果、検証日時、証拠URL、確認した識別子を記録し、既存の有効な証明と直近の検証試行の結果を区別する。API・JSONの項目名は、主仕様の`verificationStatus`と`verifications`へ対応付ける。成功した証明の`verifiedAt`と、直近の試行の`checkedAt`・`result`を分けて保持する。

異なるAccountsユーザーへのURLが併存する場合は、証拠ページのURLを整理して再検証するよう本人に案内する。既存の有効な紐付けは、このリンク検証の判断不能という直近結果だけでは変更しない。DNS TXTが一致した場合は、その独立した証明結果に従う。

サービスごとの案内は、検証結果の案内とは別に、「アカウント連携」画面のサービス別のヒントを開く操作からダイアログで表示する。ヒントには、Xではウェブサイト欄のリンクが短縮URLになるため自己紹介文などに`https://`から完全なURLを書くこと、MastodonではAccountsで一般公開した後にプロフィールを再保存すること、組織アカウントは最後に証明した個人に紐付くこと、DNS TXTは反映に時間がかかることなどを含める。

一般公開・OAuthクライアント向けの表示は、[表示・提供する情報](main.ja.md#表示提供する情報)と公開設定に従う。公開プロフィールには、確認した事実が分かる「OAuth」「公開ページのリンク確認」「DNS TXT」の3種のテキスト付きバッジで方法を表示し、それぞれの検証日時・結果を確認できるようにする。

## 公開プロフィールへの掲載

Accountsの公開プロフィールは、URLを知っている第三者がログアウト状態でも取得できる。初回HTMLは、HonoがD1の公開情報から生成する。Accountsの公開プロフィール画面と初回HTMLに表示する、一般公開を許可した外部アカウントのURLには、すべて`rel="me"`を付ける。生成した応答のキャッシュと更新後のpurgeは[提供・技術要件](main.ja.md#提供技術要件)に従う。

```html
<a
	href="https://github.com/alice"
	rel="me"
	>GitHub</a
>
```

画面上の表示とHTMLへ出すリンクは、本人の一般公開設定に従う。外部アカウントが非公開でも、本人の検証操作では外部ページからAccountsへの証拠を確認できる。第三者向けの相互リンクは、本人が外部URLを一般公開した時点で両側をたどれる状態になる。

外部サービスの判定はそのサービスの規則に従う。例えば、MastodonはプロフィールのHTTPSリンク先から`rel="me"`付きの戻りリンクを確認するため、Accounts側では静的HTMLから外部プロフィールへリンクする。[Mastodonのリンク検証](https://docs.joinmastodon.org/user/profile/#link-verification)

## 個別対応する外部サービス

### GitHub

- `https://github.com/{username}`形式のプロフィールでは、URLからサービス名`github`とユーザー名を取得し、今回取得したプロフィールの公開HTMLから証拠を読む。同じ形式の組織ページも、組織名をユーザー名として同じ規則で扱う。
- GitHubのユーザー名は変更でき、旧ユーザー名は別の利用者が取得できる。ユーザー名は検証時点の識別情報として保存する。[GitHubのユーザー名変更](https://docs.github.com/en/account-and-profile/concepts/username-changes)
- OAuthでGitHubの固有ID・ユーザー名・プロフィールURLを得た場合は、同じ認証結果が示す外部アカウントの識別情報として保存する。OAuthのログイン・追加連携・再連携で得たユーザー名・プロフィールURLで、その外部アカウントの識別子を置き換え、置き換え後の値が別のAccountsユーザーの有効な識別子と衝突する場合は、その識別子を今回の本人へ移動する。OAuthの処理は[Accounts v0.1](main.ja.md#外部認証情報)に従う。

### 対応範囲と調査結果

v0.1では、GitHub、GitLab、Stack Overflow、Qiita、note、Zenn、Codeberg、X、Hugging Faceのプロフィールを個別対応する。個別対応の内容は、サービス名の判定、URL規則からのユーザー名の抽出、そのプロフィールページの証拠での証明とする。各サービスのコンテンツURLは汎用Webページとして扱う。Reddit・KaggleのURLはv0.1で汎用Webページとして登録し、共通の検証を行う。両サービスのサービス名・ユーザー名への個別対応は、公開ページから検証できる条件を確認してから追加する。以下は2026-09-23に匿名HTTP取得した公開HTMLの単発観測である。検索結果の整形表示とは区別し、Cloudflare Workers本番環境での取得、任意の利用者ページでの再現、AccountsプロフィールURLを置いたときの証明成功を保証しない。実測サンプルにAccountsプロフィールURLはなかった。リンクの存在は証明成功とは別である。

| サービス | プロフィールURLと識別子 | プロフィールの匿名取得の実測 | 制約と対応境界 |
| ---- | ---------------------- | ---------------------------- | -------------- |
| GitLab | `gitlab.com/{namespace}`。namespaceはユーザーまたはグループ | [個人プロフィール](https://gitlab.com/yorickpeterse)は200・31,439Bで外部リンクあり | - |
| Stack Overflow | `stackoverflow.com/users/{userId}/{slug}`。URLの数値IDをユーザー名相当の識別子とする | [プロフィール](https://stackoverflow.com/users/22656/jon-skeet)は200・173,815Bで外部リンクあり | slugは保存しない |
| Qiita | `qiita.com/{username}` | [プロフィール](https://qiita.com/Qiita)は200・112,075B | ユーザー名の変更後は、旧URLから変更後のURLへredirectする |
| note | `note.com/{username}` | [クリエイターページ](https://note.com/info)は200・577,759B | 「プロフィールに設定した記事」はコンテンツURLとして扱う |
| Zenn | `zenn.dev/{username}` | [プロフィール](https://zenn.dev/zenn)は200・39,035B | `/p/{publication}`はPublicationであり個人プロフィールと区別する |
| Codeberg | `codeberg.org/{namespace}`。namespaceは個人または組織 | [組織ページ](https://codeberg.org/forgejo)は200・80,020Bで外部リンクあり | 観測したnamespaceは組織であり、個人プロフィールの証明可能性は未確認 |
| Reddit | `reddit.com/user/{username}`。ユーザー名はURL | [プロフィール](https://www.reddit.com/user/spez/)は403・1,522B | 汎用Webページ。今回は公開HTMLの証拠を確認できない |
| X | `x.com/{username}` | [プロフィール](https://x.com/OpenAI)は200・282,210Bで外部`a`リンクあり | プロフィール例は組織アカウント。ウェブサイト欄のリンクは短縮URLになるため、自己紹介文などに`https://`から完全なURLを書く |
| Hugging Face | `huggingface.co/{namespace}`。namespaceは個人または組織 | [プロフィール](https://huggingface.co/karpathy)は200・145,434B | - |
| Kaggle | `kaggle.com/{username}`。URLからユーザー名候補を得る | [プロフィール](https://www.kaggle.com/ash316)は200・5,528BでHTMLの`a`リンク0件 | 汎用Webページ。ユーザー名はmetadataやJSON-LDのみで、可視証拠は未確認 |

取得した200の各応答は1MiB未満、測定時の取得時間は約0.2～2.4秒だった。ただし5秒の取得期限内に収まることを保証しない。KaggleのJSON-LDなど証拠候補から除外する情報を、リンク証明やサービスの識別子の根拠にしない。403などの取得制限は[検証結果](#検証結果と複数の証明方法)に従って判断不能とする。別のプロフィール取得、外部API通信、JavaScriptの実行は追加しない。

URL形式・公開項目の公式資料：[GitLabプロフィール](https://docs.gitlab.com/user/profile/)、[Stack Overflowプロフィール](https://meta.stackoverflow.com/tags/profile-page/info)、[Qiitaマイページ](https://help.qiita.com/ja/articles/qiita-mypage)・[ユーザー名変更](https://help.qiita.com/ja/articles/qiita-change-id)、[noteプロフィール](https://www.help-note.com/hc/ja/sections/25000074889241-%E3%83%97%E3%83%AD%E3%83%95%E3%82%A3%E3%83%BC%E3%83%AB)・[プロフィール記事](https://www.help-note.com/hc/ja/articles/29243805668633-%E8%87%AA%E5%B7%B1%E7%B4%B9%E4%BB%8B%E8%A8%98%E4%BA%8B%E3%82%92%E3%83%97%E3%83%AD%E3%83%95%E3%82%A3%E3%83%BC%E3%83%AB%E3%81%AB%E8%A8%AD%E5%AE%9A%E3%81%99%E3%82%8B)、[Zennユーザーページ](https://zenn.dev/zenn/articles/zenn-feed-rss)・[Publication](https://zenn.dev/zenn/articles/how-to-use-publication)、[Redditプロフィール設定](https://support.reddithelp.com/hc/en-us/articles/360043471231-How-do-I-update-my-profile-settings)、[Xプロフィール](https://help.x.com/en/managing-your-account/how-to-customize-your-profile)、[Hugging Face組織](https://huggingface.co/docs/hub/en/organizations)。

自己ホスト型のMastodonなどは、v0.1では汎用Webページとして登録・検証する。汎用Webページは、登録された正規化URLを対象として共通の検証を行う。

## 検証処理の構成

入口となるUseCaseは`verifyUrl`とし、画面からの入力はURL一つにする。操作中の本人情報と期待するAccountsプロフィールURLは、認証済みのサーバー側コンテキストから受け取る。UseCaseがURL検査、サービス判定、ページ取得、証拠抽出、DNS TXTの照会、判定、結果保存をまとめる。

サービス別の処理は、サービス名の判定と、プロフィールURLのURL規則によるユーザー名の抽出に絞る。共通処理はURLの正規化、取得制限、ページ全体の証拠候補の抽出、DNS TXTの照会、完全一致の判定、検証結果の保存を扱う。呼び出し側は、サービス別の処理手順を意識せず結果を扱えるようにする。

URLの構文解析は標準`URL`、HTMLの要素・属性・テキストの走査はWorkersの`HTMLRewriter`、DNS TXTの取得は`node:dns/promises`の`resolveTxt`を用いる。`HTMLRewriter`はテキストと属性値の文字参照を復号しないため、テキストノードのチャンクを連結してから文字参照を復号してURL抽出器へ渡し、`href`などの属性値も復号してから相対URLを解決・正規化する。本文からURLを抽出する部品には`linkify-it`の最新安定版を使用し、`fuzzyLink: false`として`https:`スキームの一致だけを比較対象にする。[HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/)、[linkify-it](https://github.com/markdown-it/linkify-it)

既存の検証サービスは、サービスごとの証拠位置、処理の分離、利用者への案内、テストの参考とする。採用するコードや依存部品は、今回のURL・証明形式への適合とライセンスを確認し、実装計画に記録する。

## 受け入れ条件

- 一つのURLを入力して「保存して検証する」を押すとサービスとURLの種類を判定し、未登録URLも登録してリンク検証からDNS TXTの確認へ進める。「未検証で保存」も選択でき、両方法が不成立でも未検証のまま保存でき、登録数150件の境界を検査できる。
- ブラウザから任意のユーザーIDや期待URLが送られても、セッション本人のAccountsプロフィールを証明先として扱う。
- 正規化によって同値になるURLと、別path・query・subdomain・末尾slashによって区別するURLを判定できる。
- HTML全体のリンクとテキスト、HTTP Link、`text/plain`本文のURLを候補として取得し、文字参照で表記したURLも復号して比較でき、`rel="me"`付きリンクが存在する場合も許可された他の候補を確認できる。第三者投稿の読者コメントや`code`・`pre`内のコード例だけに期待するURLがある場合も一致として扱える。
- 本人のAccountsプロフィールURL全体との一致で成功し、別のURLの一部に含まれる文字列を区別できる。除外対象のHTML comment、JSON、alt、script、template、noscript、iframeを区別できる。
- コード例を含む同じ証拠候補に異なるAccountsユーザーへのURLが複数ある場合はリンク検証が`indeterminate`となり、そのリンク証明では新しい紐付けや紐付け先の更新を確定しない。同一URLの繰り返しではこの判定にならず、既存の有効な紐付けは維持する。DNS TXTが一致すれば、その証明により紐付けを確定できる。
- リンク証明単独の成功では、`dns_txt`または`oauth`の有効な証明が支える識別子を移動せず、リンク検証を`indeterminate`とする。リンク証明だけが支える識別子は再証明で移動できる。
- 公開先、redirect、応答時間・容量・MIMEを検査し、取得できない場合と、取得できたが一致しない場合を分けて表示できる。`result`は`verified`・`not_verified`・`indeterminate`の3値で、次の操作の案内を`failure_code`から導ける。
- URL由来ユーザー名とOAuthの固有IDを別種別の識別子として保存し、証明方法ごとに確認した対象を保持できる。
- 個別対応サービスのプロフィールURLの証明に成功すると、最終取得URLにURL規則を適用して、そのアカウントのユーザー名・プロフィールURLへ証明を適用できる。コンテンツURLの証明は入力URL単独に適用する。
- 同じ外部アカウントにOAuthとリンク検証の両方の結果が存在し、公開許可された情報と方法別のバッジを表示できる。リンク検証の表示では、公開ページでのURL一致と編集権限の確認を混同しない。
- リンクによる証明が成立しない場合、取得失敗やリンク不一致を含めて同じ要求で`_accounts.{host}`のDNS TXTを確認し、成功時は`dns_txt`の証明を入力URLと同じhostの登録済みURLへ適用できる。再検証が失敗しても、既存の有効な紐付けは維持する。
- Accounts APIでの照合は保存済みの識別子・証明・現在の紐付け・公開許可で行い、外部ページ取得とDNS TXTの確認は本人が「保存して検証する」を押した検証要求で行う。
- 一般公開した外部アカウントのURLが、匿名で取得したAccountsプロフィールの初回HTMLに`rel="me"`付きで存在する。

## 参考資料

URLや公開証拠の仕様には、本文中の公式資料を参照する。サービス別の実装方法を検討する際の調査対象は次のとおりとする。

- [doipjs](https://codeberg.org/keyoxide/doipjs)と[GitHub向けProvider](https://js.doip.rocks/serviceProviders_github.js.html)
- [KeytraceのGitHub向けProvider](https://github.com/orta/keytrace/blob/main/packages/runner/src/serviceProviders/github.ts)
- [Harborの検証器](https://join.harbor.social/docs/protocol/verifiers/)と[公開実装](https://github.com/futo-org/Harbor/blob/develop/services/verifier-bot/src/verifier.ts)
- [Divine Identity Verification Service](https://github.com/divinevideo/divine-identify-verification-service)
- [IndieWebのリンク発見](https://indieweb.org/discovery-algorithms)と[rel-me](https://indieweb.org/rel-me)
