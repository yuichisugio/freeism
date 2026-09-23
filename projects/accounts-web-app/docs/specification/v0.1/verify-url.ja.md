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

利用者がURLを一つ入力すると、Accountsが対象のWebページと、取得できる外部サービスの識別情報を登録し、Accountsプロフィールへの公開されたリンク・記述を先に確認する。リンクによる証明が成立しなければ、同じ検証要求でDNS TXTによるドメイン所有権証明を確認する。

本書は、URLの登録・正規化・サービス判定・公開証拠の読み取り・検証結果と、第三者から確認できる公開HTMLを定める。OAuth・OIDCの本人認証、紐付け先の更新、公開設定、API契約、保存構造は[Accounts v0.1](main.ja.md)を正とする。

URLの入力を本人の登録・検証操作とし、Accounts APIによる照合は保存済みの識別子・証明・現在の紐付け・公開許可を読み取って行う。証明の有効性は、[所有権と紐付け](main.ja.md#所有権と紐付け)の現在の紐付けに従う。

## 利用者の操作

1. Accountsにログインした本人が、「アカウント連携」画面の一つの入力欄へURLを入力する。サービスの判定はAccountsが行う。
2. Accountsのバックエンドがセッションから`user.id`を取得し、DB上の本人のプロフィール情報から、そのユーザーの公開プロフィールURLを確定する。操作主体と証明先は、このサーバー側の情報を根拠にする。
3. URLの構文と取得先の安全性を検査・正規化し、外部サービス、入力URLの種類、取得できる外部アカウントの識別情報を判定する。不正な入力は入力エラーとして示す。
4. 入力URLが未登録でも対象として受け付け、公開ページから本人のAccounts公開プロフィールURLを示す証拠を先に確認する。リンクによる証明が成立した場合は、その結果を保存する。ページを取得できない場合やリンクが一致しない場合を含め、リンクによる証明が成立しなければ、同じバックエンド要求で入力URLのhostのDNS TXTを確認する。
5. DNS TXTが一致した場合は`dns_txt`の成功証明を保存する。いずれも成立しなければ入力URLを未検証として保存する。試行した方法ごとの直近結果を保存し、成功した証明と対象の識別子を本人の外部アカウントへ対応付ける。同じ外部アカウントにOAuthとWebの証明を追加できる。
6. 本人が選択した公開設定に従い、Accountsの公開プロフィールや許可されたOAuthクライアントへ情報を提供する。提供対象は[公開設定](main.ja.md#公開設定)に従い、未検証の登録情報は本人向けに管理する。

Web URLは、未検証の登録を含めて1ユーザー150件までとする。同一ユーザーの同じ正規化URLは一つの登録として扱う。この上限は登録URL数の上限であり、検証リクエストの頻度制限は[Accountsの提供・技術要件](main.ja.md#提供技術要件)に従う。

## URL正規化

登録するURL、API照合の入力URL、外部ページから得た証明候補には、同じ純粋関数による正規化を適用する。URLの構造は標準のURLパーサーで検査し、次の規則で比較用の文字列へ整える。

- schemeとhostを小文字化し、国際化ドメインをASCII/Punycode表現に統一する。
- HTTPSを受け付け、既定のportとfragmentを除去する。
- 空のpathを`/`に統一する。
- queryとpathの意味を保持する。末尾slash、`/about`などのpath、subdomainは、それぞれのURLとして区別する。
- percent encodingは、同じ値を表す安全な範囲で表記を統一する。予約文字の符号化によるpathやqueryの意味を保持する。
- 外部URLの受付には、[外部ページの取得](#外部ページの取得)のscheme・port・userinfo・hostの制約を適用する。

例えば、`https://example.com/`、`https://example.com/about/`、`https://profile.example.com/user`は別のURLとして登録・証明する。それぞれが同じAccountsユーザーへ有効に紐付き、問い合わせ元への提供が許可されていれば、各URLの照合で同じユーザーを返せる。

一致条件は正規化後のURL全体の完全一致とする。期待するURLが`https://accounts.freeism.app/profiles/alice`なら、同じURLを文字列の一部に含む別path・別host・queryは別のURLである。ネットワーク取得による証拠の確認と、文字列の正規化を分けて扱う。

正規化の基準は[WHATWG URL Standard](https://url.spec.whatwg.org/)と[RFC 3986 §6.2.2](https://www.rfc-editor.org/rfc/rfc3986.html#section-6.2.2)とする。

## DNS TXTによる証明

DNS TXTレコードの値は、本人のAccounts公開プロフィールURL `https://accounts.freeism.app/profiles/{accountsUserId}` とする。互換サービスでは、そのサービスのoriginを用いた公開プロフィールURLとする。証明先は[利用者の操作](#利用者の操作)に従い、セッション本人の情報からAccountsのバックエンドが決定する。

入力URLのリンクによる証明が成立しなかったとき、Accountsのバックエンドが同じ要求で対象hostのDNS TXTレコードを取得し、本人のAccounts公開プロフィールURLとの一致を確認して結果を保存する。再度同じURLを検証した場合も今回の方法別結果を直近の試行として記録し、既存の有効な証明と現在の紐付けは[所有権と紐付け](main.ja.md#所有権と紐付け)に従って扱う。

TXTレコードは、証明するhostそのものに追加する。`example.com`を証明する場合は`example.com`、`blog.example.com`を証明する場合は`blog.example.com`をレコードの名前とする。DNS管理画面で管理ゾーンの頂点を指定するときは、提供事業者の案内に従って`@`や空欄などを使う。既存のTXTレコードは保持し、Accounts公開プロフィールURLを値とする別のTXTレコードを追加する。

DNS TXTで`example.com`の所有権を証明した場合、同じhostとして登録済みの`https://example.com/`や`https://example.com/about`など、pathやqueryが異なるURLすべてを証明対象とする。hostは[URL正規化](#url正規化)に従って正規化した値の完全一致で判定する。`www.example.com`を含むサブドメインは別hostとして、それぞれ証明する。

証明対象は今回入力したURLと、同じhostで本人が登録済みのURLとする。入力URLは未登録でも登録して証明対象に含める。DNS TXTの証明でhost内のほかのpathやqueryを列挙・登録することはない。対象となる各URLの現在の紐付けは[所有権と紐付け](main.ja.md#所有権と紐付け)に従い、同時点で最大1人のAccountsユーザーとする。照合・提供には各URLの現在の証明済み紐付けと[公開設定](main.ja.md#公開設定)を適用する。

## サービス別の識別

入力URLは、既知サービスのhost全体とpath構造に基づいて判定する。`github.com`と`github.com.example.net`は別hostとして扱う。個別対応するサービスでは、プロフィール、投稿、Gistなど、入力URLの種類も区別する。

保存する識別情報は次のように整理する。取得元と証明が適用される対象を保持し、APIでは[Accounts API](main.ja.md#accounts-api)で定める型として提供・照合する。

| 情報                 | 取得元と扱い                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| 正規化URL            | 本人が登録したURL。汎用Webページでは、このURLを外部の識別子とする                                           |
| 外部サービス名       | 既知hostと対応するURL規則から判定する。自己ホスト型サービスの主体はoriginも含めて区別する                   |
| サービス内ユーザー名 | 対応サービスのURL構造や、取得した本人の公開情報から抽出する。変更可能な名前として固有IDと区別する           |
| サービス内固有ID     | OAuth・OIDCの検証済み応答、または今回取得した公開ページで、対象アカウントとの対応を確認できる場合に保存する |
| プロフィールURL      | 対応サービスのURL規則、OAuth応答、または今回取得したページで対象アカウントとの対応を確認できる場合に保存する |
| 証拠のURL            | リンクや記述を実際に確認したプロフィール・投稿・GistなどのURLを保存する                                     |

サービス名・ユーザー名などの補助情報は、入力URLと検証のために取得したページから得られる範囲で保存する。URLの登録・リンク検証が必要とするページ取得と、利用者が開始したOAuth認証を通信の範囲とする。

URLを解析できることと所有権の証明成功は別の結果として扱う。未検証のURLから得たユーザー名は登録情報であり、証明が成功した対象にだけ、その証明結果を対応付ける。サービス固有の識別子が得られないページも、正規化URLによる登録・検証を行える。

OAuthで得た固有IDとURLから得たユーザー名は、異なる種類の識別子である。同じ外部アカウントの情報としてまとめる際は、本人の操作と、検証済みのOAuth応答・公開証拠が示す対応を根拠にする。各証明は、実際に確認できた識別子の範囲へ適用する。

個別対応サービスの入力URLのリンク検証が成功した場合、対応サービスのURL規則で対象アカウントのユーザー名・プロフィールURLを確定できれば、検証したURLとともに同じ外部アカウントへ保存し、この証明を適用する。記事IDなど入力URLから作者・所有者を確定できない場合は、取得済みの同一ページで対象アカウントとプロフィールURL・ユーザー名の対応を確認できた範囲だけを保存する。CodebergのリポジトリとHugging Faceのモデル・データセット・Spacesでは現在の所有アカウントを対象とする。例えば`team-a/model-b`の所有者が`team-a`で個人作者が`alice`なら、対象は`team-a`とする。所有アカウントは組織名義でもよく、その外部アカウントの有効な紐付け先は最大1人のAccountsユーザーとする。所有者との対応を確認できない場合は、入力URL単独の検証結果として扱う。ページ内の読者コメントの投稿者を記事・投稿の作者や成果物の所有者として扱わない。サービス内固有IDは、OAuth・OIDCの検証済み応答または今回取得したページで対象アカウントとの対応を確認できた場合に保存する。入力URLの検証後に別のプロフィールURLの取得や外部API通信は行わない。

## 証明に使用するリンクと本文

検証対象の外部ページから、以下の候補を抽出する。

| 候補                          | 抽出する値                                                            |
| ----------------------------- | --------------------------------------------------------------------- |
| HTMLの`a[href]`と`link[href]` | `href`のURL。`head`内の`link`と本文のリンクを含む                     |
| HTTPの`Link`ヘッダー          | link-valueが示すURL                                                   |
| HTML全体の本文テキスト        | 静的HTMLの可視テキストから抽出した完全なHTTPS URL。第三者投稿の読者コメントと`code`・`pre`内のコード例も含む |
| `text/plain`の応答            | 本文から抽出した完全なHTTPS URL                                       |

- `rel="me"`を含むリンクも、通常のリンクや本文のURLと一緒に候補へ含める。
- 相対hrefは、取得した最終ページのURLを基準に解決してから正規化する。
- 本文では、URL抽出器で得たURLを比較対象にする。URLの途中までの一致や、ほかのURLのqueryに含まれる文字列は、証明先URLの完全一致と区別する。
- HTML comment、JSON、画像alt、`script`・`style`内の記述、JavaScriptの実行後に生成されるDOM、`iframe`内は候補から除外する。HTMLパーサーで要素・属性・テキストを区別してから抽出する。
- 個別対応サービスでも、証拠候補は取得したページの上記の範囲から抽出する。サービスが示すプロフィール・投稿の作者と入力URLの対応は、登録対象と識別子の判定に使う。第三者投稿の読者コメントに含まれるURLを証拠に含めても、その投稿者を対象アカウントの作者・所有者として扱わず、そこからサービスの識別子を推定しない。
- 候補のURLを正規化し、セッション本人に対応するAccounts公開プロフィールURLと完全一致した場合に証明を成立させる。同じ証拠候補の範囲に、同じAccountsサービスの異なるユーザーを示す公開プロフィールURLが複数ある場合は判断不能とし、新しい紐付けや紐付け先の更新を確定しない。同一URLの繰り返しは一つとして数える。それ以外で条件を満たした検証は自動で確定する。

証拠は検証した時点の公開記述を示し、ページ所有者の編集権限までは保証しない。第三者投稿の読者コメントやコード例だけに本人のAccountsプロフィールURLがある場合も一致として扱う。検証日時と方法を記録し、第三者が確認するための証拠URLを対応付ける。

## 外部ページの取得

- 取得先はHTTPS・port 443の公開Webページとする。
- 入力とredirect先でuserinfo、IP literal、localhost、private・link-local・loopback・reserved hostname/address、Cloud metadata addressを検査し、公開Internet上の宛先を許可する。
- Cloudflare Workersの`global_fetch_strictly_public`を使い、同一zoneへの要求も公開Internetからのアクセスと同じ経路で取得する。private宛先への接続制約は、入力検査と実行環境の接続制約を含めて確認する。[Cloudflareの互換性フラグ](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public)
- redirectは最大3回まで手動で追跡し、各遷移先に同じ取得先検査を適用する。登録URL、最終取得URL、実際の証拠を区別して扱う。
- 全体の取得期限は5秒、応答本文の上限は1MiBとし、`text/html`または`text/plain`を受け付ける。応答を読みながら上限を確認し、上限を超えたら取得を終了する。
- 取得要求には、外部ページの取得に必要なヘッダーをAccountsが組み立てて付ける。Accountsのセッションや、利用者から受け取った認証ヘッダーは本人認証の処理で扱う。
- URL入力による検証要求ごとに外部ページを取得し、今回得た応答を証拠として評価する。証拠の内容との一致と検証日時を保存する。
- 応答HTMLとHTTPヘッダーを静的に解析する。対象は取得した文書であり、JavaScriptの実行や画像などの関連ファイルの読み込みを必要とする場合は、今回の取得で確認できる範囲を結果に示す。

期限・容量・redirectの上限は、利用者の待ち時間と取得負荷を抑えるための共通条件とする。取得不能、上限超過、解釈できない応答はリンク検証の直近結果として本人へ伝え、DNS TXTの確認へ進む。入力URLの構文や取得先の安全性の不備は入力エラーとして扱う。

## 検証結果と複数の証明方法

外部アカウント、照合に使う識別子、検証方法ごとの証明を分けて管理する。同じ外部アカウントについて、OAuthによる証明と`bidirectional_link`による証明を保持できる。保存構造は[テーブル構造の設計案](main.ja.md#テーブル構造の設計案)に従う。

| 状態・結果               | 意味                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| `unverified`（登録状態） | 登録を保存し、有効な証明の成立を待っている                                |
| `verified`               | 対象ページの公開証拠とAccountsユーザーのプロフィールURLが一致した。ページの編集権限の確認を意味しない |
| `not_verified`           | 対象を取得・解釈できたが、期待する証拠が確認できなかった                  |
| `indeterminate`          | timeout、外部のアクセス制限、取得上限、応答形式、異なるAccountsユーザーへのURLの併存などにより判断できなかった |
| `action_required`        | リンク設置や公開状態の変更など、証明のための本人操作が必要になった        |

リンク設置、公開状態の変更、OAuthによる証明など、本人の次の操作は、検証結果に対応する案内として表示する。方法別の検証結果、検証日時、証拠URL、確認した識別子を記録し、既存の有効な証明と直近の検証試行の結果を区別する。API・JSONの項目名は、主仕様の`verificationStatus`と`verifications`へ対応付ける。成功した証明の`verifiedAt`と、直近の試行の`checkedAt`・`result`を分けて保持する。

異なるAccountsユーザーへのURLが併存する場合は、証拠ページのURLを整理して再検証するよう本人に案内する。既存の有効な紐付けは、このリンク検証の判断不能という直近結果だけでは変更しない。DNS TXTが一致した場合は、その独立した証明結果に従う。

一般公開・OAuthクライアント向けの表示は、[表示・提供する情報](main.ja.md#表示提供する情報)と公開設定に従う。公開プロフィールには「OAuth」「公開ページのリンク確認」など、確認した事実が分かる方法をテキスト付きバッジで表示し、それぞれの検証日時・結果を確認できるようにする。

## 公開プロフィールへの掲載

Accountsの公開プロフィールは、URLを知っている第三者がログアウト状態でも取得できる。一般公開を許可した外部プロフィールURLは、HonoがD1の公開情報から生成する初回HTMLに`rel="me"`を付けたリンクとして出力する。生成した応答のキャッシュと更新後のpurgeは[提供・技術要件](main.ja.md#提供技術要件)に従う。

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

- `https://github.com/{username}`形式のプロフィールでは、URLからサービス名`github`とユーザー名を取得し、今回取得したプロフィールの公開HTMLから証拠を読む。
- GitHubのユーザー名は変更でき、旧ユーザー名は別の利用者が取得できる。ユーザー名は検証時点の識別情報として保存する。[GitHubのユーザー名変更](https://docs.github.com/en/account-and-profile/concepts/username-changes)
- OAuthでGitHubの固有ID・ユーザー名・プロフィールURLを得た場合は、同じ認証結果が示す外部アカウントの識別情報として保存する。OAuthの処理は[Accounts v0.1](main.ja.md#外部認証情報)に従う。
- Gist URLの登録に対応する。例えば、`https://gist.github.com/yuichisugio/8e8c7d94a9318dbaef9e36da88e9a885`を入力した場合は、URL規則から作者のユーザー名を判定し、取得したGistの公開HTML全体から証拠を確認する。Gist URLを証拠URLとして扱う。
- Gistの検証が成功した場合は、入力URLから判定した作者のGitHubプロフィールURL・ユーザー名とGist URLを一つの外部アカウントに紐付ける。

Gistは公開コンテンツとしてAccountsプロフィールURLを置く場所の一つになる。作者情報で登録対象と識別子を判定し、取得した公開証拠で登録URLを検証する。[GitHub Gist](https://docs.github.com/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists)

### 対応範囲と調査結果

v0.1ではGitHubプロフィール・Gistに加え、GitLab、Stack Overflow、Qiita、note、Zenn、Codeberg、X、Hugging Faceのプロフィールを個別対応する。コンテンツURLはQiita・note・Zennの記事、Xの投稿、GitLabのMerge Request・Issue、Stack Overflowの質問・回答、Codebergのリポジトリ、Hugging Faceのモデル・データセット・Spacesを対象とする。Reddit・KaggleのURLはv0.1で汎用Webページとして登録し、共通の検証を行う。両サービスのサービス名・ユーザー名への個別対応は、公開ページから検証できる条件を確認してから追加する。以下は2026-09-23に匿名HTTP取得した公開HTMLの単発観測である。検索結果の整形表示とは区別し、Cloudflare Workers本番環境での取得、任意の利用者ページでの再現、AccountsプロフィールURLを置いたときの証明成功を保証しない。実測サンプルにAccountsプロフィールURLはなかった。リンクや作者情報の存在は証明成功とは別である。

| サービス | プロフィールURLと識別子 | コンテンツURL・匿名取得の実測 | 制約と対応境界 |
| ---- | ---------------------- | ---------------------------- | -------------- |
| GitLab | `gitlab.com/{username}`。個人かグループかをページで判定する | [個人プロフィール](https://gitlab.com/yorickpeterse)は200・31,439Bで外部リンクあり。[Merge Request](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/6678)は200・116,624Bで作者・コメント者のリンクあり | MR・Issueはコメント者を作者と取り違えない。グループURLを個人プロフィールにしない |
| Stack Overflow | `stackoverflow.com/users/{userId}/{slug}`。固有IDはURLの数値 | [プロフィール](https://stackoverflow.com/users/22656/jon-skeet)は200・173,815Bで外部リンクあり。[質問](https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array)は403・5,480B | 質問・回答のHTMLと作者の対応は今回確認できず、取得制限時は判断不能とする |
| Qiita | `qiita.com/{username}`。ユーザー名はURL・作者リンクから照合 | [プロフィール](https://qiita.com/Qiita)は200・112,075B、[記事](https://qiita.com/Qiita/items/c686397e4a0f4f11683d)は200・297,454B。外部リンク・作者`/Qiita`リンクあり | ユーザー名変更時のredirect後URLと記事の作者リンクを照合する |
| note | `note.com/{username}`。ユーザー名はURL・作者リンクから照合 | [クリエイターページ](https://note.com/info)は200・577,759B、[記事](https://note.com/info/n/n27cb842c7737)は200・309,237B。外部リンク・作者`/info`リンクあり | ユーザーページと「プロフィールに設定した記事」は別のURL種別 |
| Zenn | `zenn.dev/{username}`。ユーザー名はURL・作者リンクから照合 | [プロフィール](https://zenn.dev/zenn)は200・39,035B、[記事](https://zenn.dev/zenn/articles/markdown-guide)は200・603,908B。外部リンク・作者`/zenn`リンクあり | `/p/{publication}`はPublicationであり個人プロフィールと区別する |
| Codeberg | `codeberg.org/{namespace}`。個人・組織を判定する | [組織ページ](https://codeberg.org/forgejo)は200・80,020Bで外部リンクあり。[リポジトリ](https://codeberg.org/forgejo/forgejo)は200・165,007Bでownerリンクあり | リポジトリは現在の所有アカウントを対象とする。観測したnamespaceは組織であり、個人プロフィールの証明可能性は未確認 |
| Reddit | `reddit.com/user/{username}`。ユーザー名はURL | [プロフィール](https://www.reddit.com/user/spez/)と[投稿](https://www.reddit.com/r/NewToReddit/comments/1r9no7s/how_to_create_a_reddit_post/)は共に403・1,522B | 今回は公開HTMLの証拠・投稿作者を確認できない |
| X | `x.com/{username}`。ユーザー名はURL・投稿の作者情報から照合 | [プロフィール](https://x.com/OpenAI)は200・282,210Bで外部`a`リンクあり。[投稿](https://x.com/karpathy/status/1882544526033924438)は200・248,814Bで`article:author`と`/karpathy`リンクあり | プロフィール例は組織アカウント。投稿の作者情報と証拠候補を区別する |
| Hugging Face | `huggingface.co/{namespace}`。namespaceは個人・組織を判定する | [プロフィール](https://huggingface.co/karpathy)は200・145,434B、[model](https://huggingface.co/karpathy/gpt2_1558M_final3_hf)は200・168,358B、[dataset](https://huggingface.co/datasets/karpathy/tinystories-gpt4-clean)は200・380,262B、[Space](https://huggingface.co/spaces/gradio/hello_world)は200・34,392B。namespaceへのリンクあり | 成果物は現在の所有アカウントを対象とし、コンテンツの個人作者を所有者と同一視しない |
| Kaggle | `kaggle.com/{username}`。URLからユーザー名候補を得る | [プロフィール](https://www.kaggle.com/ash316)は200・5,528B、[Notebook](https://www.kaggle.com/code/ash316/ml-from-scratch-with-iris)は200・8,463B、[dataset](https://www.kaggle.com/datasets/uciml/iris)は200・10,024B。全例でHTMLの`a`リンク0件 | ユーザー名・作者・publisherはmetadataやJSON-LDのみで、今回の可視証拠と作者リンクは未確認 |

取得した200の各応答は1MiB未満、測定時の取得時間は約0.2～2.4秒だった。ただし5秒の取得期限内に収まることを保証しない。KaggleのJSON-LDなど証拠候補から除外する情報を、リンク証明や作者プロフィールへの証明適用の根拠にしない。個別対応するコンテンツURLでも、入力URLのリンク証明が成功した場合、URL規則で確定できる対象アカウントのプロフィールURL・ユーザー名を保存する。URLで作者・所有者を確定できない場合は、取得済みの同一HTMLで対応を確認できた範囲に限って[サービス別の識別](#サービス別の識別)の紐付けを行う。403などの取得制限は[検証結果](#検証結果と複数の証明方法)に従って判断不能とする。別のプロフィール取得、外部API通信、JavaScriptの実行は追加しない。

URL形式・公開項目の公式資料：[GitLabプロフィール](https://docs.gitlab.com/user/profile/)、[Stack Overflowプロフィール](https://meta.stackoverflow.com/tags/profile-page/info)、[Qiitaマイページ](https://help.qiita.com/ja/articles/qiita-mypage)・[ユーザー名変更](https://help.qiita.com/ja/articles/qiita-change-id)、[noteプロフィール](https://www.help-note.com/hc/ja/sections/25000074889241-%E3%83%97%E3%83%AD%E3%83%95%E3%82%A3%E3%83%BC%E3%83%AB)・[プロフィール記事](https://www.help-note.com/hc/ja/articles/29243805668633-%E8%87%AA%E5%B7%B1%E7%B4%B9%E4%BB%8B%E8%A8%98%E4%BA%8B%E3%82%92%E3%83%97%E3%83%AD%E3%83%95%E3%82%A3%E3%83%BC%E3%83%AB%E3%81%AB%E8%A8%AD%E5%AE%9A%E3%81%99%E3%82%8B)、[Zennユーザーページ](https://zenn.dev/zenn/articles/zenn-feed-rss)・[Publication](https://zenn.dev/zenn/articles/how-to-use-publication)、[Codebergリポジトリ](https://docs.codeberg.org/getting-started/first-repository/)・[権限](https://docs.codeberg.org/collaborating/repo-permissions/)、[Redditプロフィール設定](https://support.reddithelp.com/hc/en-us/articles/360043471231-How-do-I-update-my-profile-settings)、[Xプロフィール](https://help.x.com/en/managing-your-account/how-to-customize-your-profile)・[投稿URL](https://help.x.com/en/using-x/post-and-moment-url)、[Hugging Face Spaces](https://huggingface.co/docs/hub/spaces-overview)・[組織](https://huggingface.co/docs/hub/en/organizations)、[Kaggle Notebooks](https://www.kaggle.com/docs/notebooks)・[Datasets](https://www.kaggle.com/docs/datasets)。

自己ホスト型のMastodonなどは、originを含むプロフィールURLを基本とする。今回のページ取得でアカウント情報と公開証拠が得られる場合に、その対応を保存する。汎用Webページは、登録された正規化URLを対象として共通の検証を行う。

## 検証処理の構成

入口となるUseCaseは`verifyUrl`とし、画面からの入力はURL一つにする。操作中の本人情報と期待するAccountsプロフィールURLは、認証済みのサーバー側コンテキストから受け取る。UseCaseがURL検査、サービス判定、ページ取得、証拠抽出、判定、結果保存をまとめる。

サービス別の処理は、対応するURL規則、プロフィール・投稿の作者と入力URLの対応、取得できる識別子の抽出に絞る。共通処理はURLの正規化、取得制限、ページ全体の証拠候補の抽出、完全一致の判定、検証結果の保存を扱う。呼び出し側は、サービス別の処理手順を意識せず結果を扱えるようにする。

URLの構文解析は標準`URL`、HTMLの要素・属性・テキストの走査はWorkersの`HTMLRewriter`を用いる。本文からURLを抽出する部品には`linkify-it`を使用し、明示されたHTTPS URLを比較対象にする。テキストが複数のチャンクへ分割される場合も、URLを途中で欠落させずに抽出する。[HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/)、[linkify-it](https://github.com/markdown-it/linkify-it)

既存の検証サービスは、サービスごとの証拠位置、処理の分離、利用者への案内、テストの参考とする。採用するコードや依存部品は、今回のURL・証明形式への適合とライセンスを確認し、実装計画に記録する。

## 受け入れ条件

- 一つのURL入力からサービスとURLの種類を判定し、未登録URLも登録してリンク検証からDNS TXTの確認へ進める。両方が不成立でも未検証のまま保存でき、登録数150件の境界を検査できる。
- ブラウザから任意のユーザーIDや期待URLが送られても、セッション本人のAccountsプロフィールを証明先として扱う。
- 正規化によって同値になるURLと、別path・query・subdomain・末尾slashによって区別するURLを判定できる。
- HTML全体のリンクと可視テキスト、HTTP Link、`text/plain`本文のURLを候補として取得し、`rel="me"`付きリンクが存在する場合も許可された他の候補を確認できる。第三者投稿の読者コメントや`code`・`pre`内のコード例だけに期待するURLがある場合も一致として扱える。
- 本人のAccountsプロフィールURL全体との一致で成功し、別のURLの一部に含まれる文字列を区別できる。除外対象のHTML comment、JSON、alt、script、iframeを区別できる。
- コード例を含む同じ証拠候補に異なるAccountsユーザーへのURLが複数ある場合は`indeterminate`となり、新しい紐付けや紐付け先の更新を確定しない。同一URLの繰り返しではこの判定にならず、既存の有効な紐付けは維持する。
- 公開先、redirect、応答時間・容量・MIMEを検査し、取得できない場合と、取得できたが一致しない場合を分けて表示できる。
- URL由来ユーザー名とOAuthの固有IDを別種別の識別子として保存し、証明方法ごとに確認した対象を保持できる。
- 個別対応サービスの入力URLのリンク検証に成功すると、URL規則で確定できる対象アカウントのユーザー名・プロフィールURLを保存できる。URLで作者・所有者を確定できない記事・投稿・成果物は、取得済みの同一HTMLで対応を確認できた範囲だけ紐付ける。Codeberg・Hugging Faceの成果物は現在の所有アカウントを対象とし、組織所有も含める。所有者を確認できなければ入力URL単独で検証する。読者コメントの投稿者から作者・所有者の識別子を推定しない。
- 同じ外部アカウントにOAuthとリンク検証の両方の結果が存在し、公開許可された情報と方法別のバッジを表示できる。リンク検証の表示では、公開ページでのURL一致と編集権限の確認を混同しない。
- リンクによる証明が成立しない場合、取得失敗やリンク不一致を含めて同じ要求でDNS TXTを確認し、成功時は`dns_txt`の証明を入力URLと同じhostの登録済みURLへ適用できる。再検証が失敗しても、既存の有効な紐付けは維持する。
- Accounts APIでの照合は保存済みの識別子・証明・現在の紐付け・公開許可で行い、外部ページ取得とDNS TXTの確認は本人のURL入力による検証要求で行う。
- 一般公開した外部プロフィールURLが、匿名で取得したAccountsプロフィールの初回HTMLに`rel="me"`付きで存在する。

## 参考資料

URLや公開証拠の仕様には、本文中の公式資料を参照する。サービス別の実装方法を検討する際の調査対象は次のとおりとする。

- [doipjs](https://codeberg.org/keyoxide/doipjs)と[GitHub向けProvider](https://js.doip.rocks/serviceProviders_github.js.html)
- [KeytraceのGitHub向けProvider](https://github.com/orta/keytrace/blob/main/packages/runner/src/serviceProviders/github.ts)
- [Harborの検証器](https://join.harbor.social/docs/protocol/verifiers/)と[公開実装](https://github.com/futo-org/Harbor/blob/develop/services/verifier-bot/src/verifier.ts)
- [Divine Identity Verification Service](https://github.com/divinevideo/divine-identify-verification-service)
- [IndieWebのリンク発見](https://indieweb.org/discovery-algorithms)と[rel-me](https://indieweb.org/rel-me)
