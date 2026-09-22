# 外部アカウント連携

- [外部アカウント連携](#外部アカウント連携)
  - [実現したいこと](#実現したいこと)
  - [Bidirectional Linkの検証](#bidirectional-linkの検証)
    - [実装したいこと](#実装したいこと)
    - [実装方針](#実装方針)
    - [参考実装](#参考実装)
    - [URL判定](#url判定)
    - [URL照合](#url照合)
    - [個別対応する外部アカウント](#個別対応する外部アカウント)
      - [前提](#前提)
      - [GitHub Provider](#github-provider)
      - [その他](#その他)
    - [実行結果](#実行結果)
    - [必要なネットワーク対策](#必要なネットワーク対策)
    - [既存ライブラリ採用とフォークの判断](#既存ライブラリ採用とフォークの判断)
    - [公式資料・確認したソース](#公式資料確認したソース)
  - [ドメイン認証](#ドメイン認証)
    - [実現したいこと](#実現したいこと-1)

## 実現したいこと

`verifyUrl`を呼び出し、引数にURLを入れるだけで、何かしらの方法(Bidirectional Link検証 or DND検証)を順番にチェックしてアカウント認証する

URLを渡すだけで、検証結果が帰ってくる。
URL検証するためのロジックを外に漏らさず、UseCaseの一つの関数を呼び出せば良い設計にする。

具体的な処理内容としては、URLを受け取ったら検証
引数はURLのみで、URLからこの関数内でサービスを特定して、特別対応するサービスなら、その処理をして、違うなら汎用的な方法で判定する。利用者は外部プロフィール、本人の公開コンテンツ、所有するサイトなどにAccountsのプロフィールURLを置く。Accountsのバックエンドはそれを検証し、AccountsユーザーIDと外部Identityの関係をDBへ保存する。

## Bidirectional Linkの検証

### 実装したいこと

`verifyUrl`から呼び出して、Bidirectional Linkの検証をする
Bidirectional Linkで検証するためのロジックを外に漏らさず、UseCaseの一つの関数を呼び出せば良い設計にする。

### 実装方針

既存プロジェクト全体はフォークしない。共通契約、URL判定、正確な照合、検証結果の意味を小さく独自実装する。OAuth/OIDCはBetter Authへ任せ、URLの分解は標準URL、テキストからのURL抽出はlinkify-itへ任せる。HTMLの要素・テキスト・属性はHTMLRewriterで走査する。必要なProviderの取得知識とテストを既存実装から参考にする。
実装のコードの設計は、一番の大前提は、完全な整合性は不要で、より良くシンプルで汎用的な設計があれば、それを選択する

### 参考実装

| 実装                | 参考にする部分                                                             | v0.1でそのまま全面採用しない理由                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| doipjs              | URLマッチ、ProviderとFetcherの分離、サービス別の証拠取得位置               | 公開ソースのgenerateClaimはOpenPGP/ASPEを前提にする。URL完全一致の汎用エンジンではない。                                                                                     |
| Keytrace runner     | Provider内の案内文、複数証拠位置、取得結果の説明、verifyAccess             | createClaimがDID形式を強制する。AccountsプロフィールURLを直接渡せない。                                                                                                      |
| FUTO ID / Harbor    | 公開文面とOAuthの分離、getClaimFieldsByUrl、getText、healthCheck           | 同系統の実装を別製品として二重評価しない。現行HarborのサービスはPolycentric workspace、Node/Express、Puppeteer等と結び付く。checkFieldsは部分一致なのでURL判定は置き換える。 |
| Divine              | Hono/Workers、検証器のレジストリ、取得不能と不一致の区別、キャッシュの分離 | Nostr向け。公開リポジトリの閲覧とコード再配布の許諾は別であり、対象ファイルの利用条件を確認する。                                                                            |
| IndieWeb / Mastodon | rel=meの相互リンク、静的HTMLで第三者も確認できる公開方法                   | すべてのSNSがrel属性をユーザーに編集させるわけではない。専用ProviderによるBioやURL欄の検査と併用する。                                                                       |

### URL判定

1. 既知ホストのProviderを最優先する。
   - URLは標準URLパーサーで分解し、host全体とpath構造を確認する。
   - `github.com.evil.example`を`GitHub`としない。
   - 既知サービスの未対応pathや検証失敗を、汎用HTMLの緩い判定へ回して成功させない。
2. 必要な範囲で取得したレスポンスから、ActivityPub等のプロトコル固有の取得方法を探す。
   - 自己ホストされたサービスのローカルIDはoriginと組み合わせる。
   - HTTPのContent-Type、正規URL、投稿のauthorなどの対応を確認する。
   - 名前解決やサービス発見だけでは操作権限確認の成功にしない。
3. 既知ホスト以外は、未知のサイトを汎用Webリソースとして扱う。
   - 初期の汎用モードは、静的HTML内のa/linkタグのrel=meとhrefを検査する。
   - 本文にAccountsのURLが一箇所あれば無条件でSNSアカウントとして承認するモードにはしない。
   - 未知サイトではSNS内部のアカウントIDを確定できないため、外部IDは検証対象の正規URLとし、kindはweb-resourceにする。

### URL照合

- HTMLはhrefの値、プロフィールAPIのURL項目は項目全体、BioやプレーンテキストはURL抽出器で得たトークンを比較する。
  - 見出しやリンクの表示文字列だけを証拠にしない。
- 期待URLが /u/alice である場合、/u/alice-other、別ホスト、別path、URLをクエリ中へ埋め込んだページを一致にしない。
  - hostnameは標準パーサーの正規化を使い、pathやqueryを一律に小文字化・削除しない。
  - 末尾スラッシュやfragmentもアプリが保証する同一性の範囲でのみ扱う。
  - 追跡用リダイレクトは既知Providerに限定したルールで解く。
  - 外部ページのcanonical宣言や任意のredirectだけで別ユーザーのプロフィールURLを同一視しない。

### 個別対応する外部アカウント

#### 前提

- 可能な限り、PointsからのAPIリクエストでは、「URL」と「アカウント名＋ユーザー名 or ユーザーID」に対応したい。
- なので、個別対応するサイトも用意する
  - 個別対応する外部アカウントでは「URL」から「アカウント名＋ユーザー名 or ユーザーID」も取得して保存する処理を入れたい
  - 個別対応で「アカウント名＋ユーザー名 or ユーザーID」も取得できたら`provider_account`に対応したい
- API RateLimitの管理が面倒なため、追加でAPIリクエストが発生するようなことは行わない。
  - URLや取得したHTMLなどから抽出できるなら行う程度
  - 例えば、GitHubではプロフィールURLの場合に、プロフィールURLから取得したデータでAPIリクエストを行うことはしない。URLにユーザー名があるので、それを使用する
	- 個別対応のサービスに該当しない場合は、汎用的な方法で対応する

#### GitHub Provider

- URLからユーザー名を抽出する
  - ユーザー名はアカウント登録してから変更がほぼ不可能なのでユニークかつ不変性があるとして信用して良い

- GitHub Gist URLに対応
  - 例）`https://gist.github.com/yuichisugio/8e8c7d94a9318dbaef9e36da88e9a885`
  - これも、URLからユーザー名を抽出する
  - Gist URLとしての連携と抽出したユーザー名からGitHubプロフィールURLも作成して保存する

- GitHub OAuthに対応
  - GitHub IDやGitHubユーザー名が得られたら、GitHubプロフィールURLとしても保存する

- Gistを使う実装上の利点
  - プロフィールのURL枠やBioを占有しないこと、複数・長い証明を独立したファイルへ置けること、APIから本文と所有者を構造化して取得できること、証拠単位で編集・削除できることである。作者の採用動機を確認したわけではない。AccountsプロフィールURL一つを置くv0.1では、プロフィール方式を既定にしてGistを代替手段にする。

#### その他

- 相談
  - Instagram、X(Twitter)、などに対応したいけど、URLから推測できそうな外部アカウントを提案してほしい

### 実行結果

| status          | 意味                                                           |
| --------------- | -------------------------------------------------------------- |
| verified        | 所定の対象と証拠が一致した                                     |
| not-verified    | 対象を取得・解釈できたが、証拠やアカウントが一致しなかった     |
| indeterminate   | レート制限、タイムアウト、形式変更、取得上限などで判断できない |
| action-required | 利用者によるリンク配置やSNS認証が必要                          |

### 必要なネットワーク対策

URLを外部入力として受けるため、HTTP取得先に対するSSRF対策は必須。HTTPS、宛先IP、private/link-local等の到達先、redirect各段、本文サイズ、接続時間を統一した送信ポリシーで制限する。DNSの事前検査だけで実接続先まで保証できるとは考えず、Nodeなら実接続先制御、Workers等ではランタイムの保証と必要な送信プロキシを評価する。パーサーはscriptを実行しない。描画する場合もsubrequestを含めて宛先制限する。外部ページへAccountsのCookieや別サービスのトークンを転送しない。

### 既存ライブラリ採用とフォークの判断

評価単位をプロジェクト全体ではなく部品にする。URL抽出、OAuth/OIDC、HTTP標準処理のように要求が一致する部分は依存ライブラリとして使う。識別子と証拠形式が今回と違うエンジンは、無理に改造して全面依存しない。

今回の選定は、通常部品としてBetter Auth・linkify-it・標準URL/fetchを採用し、URL同一性・Evidence意味付け・Provider契約・サービス判別は独自とする。HTMLの要素・テキスト・属性の走査はHTMLRewriterで行う。Workers上の組合せは採用版を固定した統合テストが必要。HarborのgetText/URL解決とKeytraceのProvider案内・証拠表示、doipjsのサービス定義、DivineのWorkersサービス構成を参考にする。

Keytrace runnerへDIDに見せかけたローカルIDを渡す迂回策は採用しない。

### 公式資料・確認したソース

- doipjs： https://codeberg.org/keyoxide/doipjs
- doipjs公開Claim実装： https://js.doip.rocks/claim.js.html
- doipjs照合実装： https://js.doip.rocks/verifications.js.html
- doipjs文字列整形： https://js.doip.rocks/utils.js.html
- doipjs GitHub Provider： https://js.doip.rocks/serviceProviders_github.js.html
- doipjs配布情報： https://www.npmjs.com/package/doipjs
- Keytrace Claim実装： https://github.com/orta/keytrace/blob/main/packages/runner/src/claim.ts
- Keytrace GitHub Provider： https://github.com/orta/keytrace/blob/main/packages/runner/src/serviceProviders/github.ts
- Keytrace依存関係： https://github.com/orta/keytrace/blob/main/packages/runner/package.json
- FUTO IDの旧称と検証方式： https://docs.polycentric.io/futo-id/
- Harbor検証器： https://join.harbor.social/docs/protocol/verifiers/
- Harbor追加手順： https://join.harbor.social/docs/guides/add-a-platform-verifier/
- Harbor実装： https://github.com/futo-org/Harbor/blob/develop/services/verifier-bot/src/verifier.ts
- Harbor依存関係： https://github.com/futo-org/Harbor/blob/develop/services/verifier-bot/package.json
- Harborライセンス： https://github.com/futo-org/Harbor/blob/develop/LICENSE
- Divine： https://github.com/divinevideo/divine-identify-verification-service
- Divine GitHub検証器： https://github.com/divinevideo/divine-identify-verification-service/blob/main/src/platforms/github.ts
- Better Auth連携： https://better-auth.com/docs/concepts/users-accounts
- Better Authオプション： https://better-auth.com/docs/reference/options
- Better Auth Generic OAuth： https://better-auth.com/docs/plugins/generic-oauth
- GitHub user API： https://docs.github.com/en/rest/users/users
- GitHub social accounts API： https://docs.github.com/en/rest/users/social-accounts
- GitHub Gists API： https://docs.github.com/en/rest/gists/gists
- GitHub Gistの性質： https://docs.github.com/ja/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists
- GitHubレート制限： https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- IndieWeb rel-me： https://indieweb.org/rel-me
- Mastodonリンク確認： https://docs.joinmastodon.org/user/profile/
- linkify-it： https://github.com/markdown-it/linkify-it
- SSRF対策： https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html

## ドメイン認証

### 実現したいこと

1. ドメイン認証
   - DNS TXTなどで所有を証明
