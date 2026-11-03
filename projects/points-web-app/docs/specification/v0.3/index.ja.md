# Freeism Points Web App v0.3 仕様

- [Freeism Points Web App v0.3 仕様](#freeism-points-web-app-v03-仕様)
  - [言語](#言語)
  - [実装する理由](#実装する理由)
  - [方針](#方針)
  - [新しい仕様](#新しい仕様)
    - [非公開の評価軸・パッケージ・OAuthクライアントへの招待機能](#非公開の評価軸パッケージoauthクライアントへの招待機能)
    - [公開API](#公開api)
    - [Fediverse化する](#fediverse化する)
    - [他の無料主義アプリと評価軸ポイントの互換性を持たせる方法](#他の無料主義アプリと評価軸ポイントの互換性を持たせる方法)
    - [本人の操作をOAuthでも受け付ける](#本人の操作をoauthでも受け付ける)
    - [ユーザーの認証＆認可付きMCPサーバーに対応](#ユーザーの認証認可付きmcpサーバーに対応)
    - [CLIに対応](#cliに対応)
    - [Web MCPに対応](#web-mcpに対応)
    - [譲渡時に、自動分配するか選べるようにする](#譲渡時に自動分配するか選べるようにする)
  - [廃止する機能](#廃止する機能)
  - [後で考える機能](#後で考える機能)

## 言語

日本語（本ページ）| [English](./index.en.md)

## 実装する理由

1. v0.2だけでは、必要な機能が足りない部分があるため

## 方針

1. v0.2で実装できていない範囲を実装

## 新しい仕様

### 非公開の評価軸・パッケージ・OAuthクライアントへの招待機能

- 説明
  - 操作権限は付与しないけど、閲覧権限のみ付与する。
  - 閲覧権限があるパッケージは、非公開パッケージでも自分の公式パッケージとして設定できる。

### Accounts連携の回数制限

- 説明
  - 無料主義アプリのアカウント連携を、1日5回など制限を加える
  - または、連携と受領による再計算は別の処理にして、「再計算」のボタンを用意する

- 必要な理由
  - 再計算が何度も起こってしまうと、サーバーの負荷がかかるし、他ユーザーの残高も上下が多くなる。

### 公開API

- 説明
  - AIなどを通じて、他のサービスから無料主義アプリの情報にアクセスする手段（API）を増やしたい

- APIの種類
  1. ポイント付与
     - 説明
       - 無料主義アプリに入って、GUIからCSVアップロードが面倒なので、APIで操作する。
       - `curl`コマンドで操作したり、外部サービスとの連携でも使用する
     - 使用場面
       1. 付与の取り消し
       2. 新しくポイント付与
       3. 既存のポイント付与額の更新
  1. 同じ評価軸が、複数の`points`サービスへ評価をアップロードする

### Fediverse化する

- 説明
  - 自分自身の意思決定に関係なく移行できる設計にする
  - ポイントが、そのサービス内だけではなく、他のPoints系サービスと共有になる
  - Pointsを改竄できないように、Pointsの秘密鍵で署名する

- ポイントを加算できない方法
  - 貢献アップロードとアカウント情報を照合するので、Pointsを勝手に加算することはできない
  - 貢献度アップロードを勝手に権限がないのに行う人が出てくる
  - AT Protocolだったら、RelayやAppViewで権限がないのにアップロードしている人を除外できる
  - 評価軸の権限情報を、権限がないのに追加する人がいるのは、作成したユーザーが登録した

### 他の無料主義アプリと評価軸ポイントの互換性を持たせる方法

- 説明
  - 無料主義アプリ間で互換性を持たせる方法

- 互換性をもたせる実現方法
  1. 基本は、評価軸ポイントの互換性の仕組みと同じで、互換性を持たせる無料主義アプリのドメインを指定して、交換比率を指定しておく
     - 懸念
       1. 評価を代用する方法だと、二重付与なので、アプリを作るほど貢献度が貰えるハックが出てくる可能性がある。
          - 解決策
            - でも、評価を代用する仕組みでも、付与対象の無料主義アプリを指定する必要があるから、アプリを作るだけで二重付与になるハックは生まれないはず
            - または、無料主義アプリ間は、二重付与を認めない無料主義アプリが出てくるかも。

### 本人の操作をOAuthでも受け付ける

- 説明
  - 本人の認可が必要なAPIは、本人のCookieセッションと、PointsのOAuth Providerが発行したアクセストークンのどちらでも受け付ける。
  - MCPとCLIから、AIや利用者が本人の認可を受けて操作できるようにする。
  - CookieセッションとOAuthの認証は、v0.2.1の取得APIと同じく`some()`で合成し、どちらかで認証する。

- scope
  - Points独自のscopeは次の3つとし、v0.2.1の`points` scopeを置き換える。

    | scope          | 許可する操作                                                                                                         |
    | -------------- | -------------------------------------------------------------------------------------------------------------------- |
    | `points:read`  | 取得の操作。本人の情報・履歴・通知・残高と、操作者が管理する非公開の評価軸・パッケージの取得                         |
    | `points:edit`  | 本人の操作。プロフィール・公開設定・公式パッケージの保存、譲渡・交換・受領、通知の既読・削除、落札の引き落とし       |
    | `points:admin` | 管理者の操作。評価軸・パッケージ・交換倍率の管理、評価の登録、月別評価方式の設定、お知らせの送信、管理者の追加・解除 |

  - `openid`・`profile`・`offline_access`は、標準のscopeとして扱う。
  - Marketsの落札の引き落としは、`points:edit`で行う。
  - 各APIの必要なscopeは、v0.3の各APIの仕様に書く。

- Cookieセッションだけで受け付けるAPI
  - OAuthクライアントの管理と、OAuthの同意の取り消し
    - トークンを持つアプリが、別のクライアントを作ったり、自分の権限を広げたりできないようにするため。
  - Accounts連携の開始と再連携
    - ブラウザでのリダイレクトが前提の流れのため。
  - 退会と再開
    - 退会は、本人がブラウザで判断する操作とする。
    - 退会した本人のトークンは拒否するため、再開も退会と同じくCookieセッションで行う。

- 宛先とDPoP
  - トークンの宛先（RFC 8707のresource）は一つにし、識別子はPointsのorigin（`https://points.freeism.app`）とする。REST APIとMCPは、同じトークンで呼べる。
    - MCPはREST APIと同じ操作を同じscopeで提供するため、宛先を分けても、盗まれたトークンでできることは変わらない。
  - DPoPは、OAuthクライアントごとに必須か任意かを決める。Better Auth OAuth Providerのクライアントの`dpop_bound_access_tokens`を使う。

    | OAuthクライアント                                          | DPoP | 理由                                         |
    | ---------------------------------------------------------- | ---- | -------------------------------------------- |
    | Markets、管理画面で登録する外部アプリ（`private_key_jwt`） | 必須 | 盗まれたトークンを鍵なしで使えないようにする |
    | CLI                                                        | 必須 | CLIは自分で鍵を作って保管できる              |
    | MCPクライアント                                            | 任意 | 多くのMCPクライアントがDPoPに対応していない  |

  - `cnf.jkt`を持つトークンには必ずDPoP proofを求め、Bearerとしての利用を拒否する。
  - DPoP必須のクライアントには、DPoPに結合したトークンだけを発行する。

- 確定の操作の安全策
  - AIが操作する場合も、確認と確定の2段階のAPIを使い、確定には確認の`validationHash`を必須にする。
  - CSRF・Originの検査は、Cookieセッションの要求だけに適用する。

- 確認すること
  - 操作したOAuthクライアントのClient IDを、ポイント増減履歴と管理操作の記録に残すか。
  - OAuthクライアントごとの回数制限を設けるか。Workers Freeの1日100,000リクエストの上限も考慮する。

### ユーザーの認証＆認可付きMCPサーバーに対応

- 説明
  - PointsのOAuth Providerで認可して、AIから操作できるようにする。
  - PointsのWorkerにMCPサーバー（`https://points.freeism.app/mcp`）を設ける。
  - MCPのツールは、REST APIと同じユースケースを呼ぶ。確認と確定は別のツールにし、確定のツールは確認のツールが返した`validationHash`を必須にする。

- 認可
  - MCPクライアントは、公開クライアント（`token_endpoint_auth_method: "none"`、PKCE）として受け付ける。
  - クライアントは自動で登録する。
    - Better Auth OAuth Providerの動的クライアント登録（RFC 7591）の`allowDynamicClientRegistration`・`allowUnauthenticatedClientRegistration`を使う。
    - MCPが推奨するClient ID Metadata Documentsは、`@better-auth/cimd`プラグインで扱える。
  - DPoPは任意とし、scopeは絞らない。本人が同意した`points:read`・`points:edit`・`points:admin`を使える。
  - トークンのない要求には`401`と、保護されたリソースのメタデータ（RFC 9728）の場所を返す。
  - 同意画面には、クライアント名と許可するscopeを明示する。

- 参考
  - [MCPの認可](https://modelcontextprotocol.io/specification/latest/basic/authorization)
  - [RFC 7591](https://www.rfc-editor.org/rfc/rfc7591)・[RFC 9728](https://www.rfc-editor.org/rfc/rfc9728)

- 確認すること
  - 動的クライアント登録とClient ID Metadata Documentsのどちらを使うか。
  - 主要なMCPクライアントが、宛先にPointsのoriginを使えるか。
  - 誰でも登録できるクライアントの登録の回数制限と、使われていないクライアントの削除。
  - Cloudflare Workers上でのMCPサーバーの実装方法。

### CLIに対応

- 説明
  - CLIから、本人の認可を受けてPointsを操作できるようにする。
  - SSH先などブラウザのない環境でも使えるように、OAuth 2.0のデバイス認可（RFC 8628）で認可を受ける。

- 認可
  - Better Auth本体の`deviceAuthorization()`と、`@better-auth/oauth-provider`の`oauthDeviceAuthorization()`を使う。どちらも1.7.6に含まれる。
  - CLIは公開クライアント（`token_endpoint_auth_method: "none"`）として、運営が一つ登録する。
  - 流れ
    1. CLIが`POST /device/code`でdevice codeとuser codeを受け取り、確認用のURLとuser codeを表示する。
    2. 利用者がブラウザで`/device`を開き、ログインしてuser codeを入力し、承認する。承認と拒否はCookieセッションで行う。
    3. CLIは`/oauth2/token`へ、device codeのgrant（`urn:ietf:params:oauth:grant-type:device_code`）で問い合わせ、承認後にトークンを受け取る。
  - 発行するトークンは、scopeと宛先を検証したOAuthのJWTとする。`offline_access`を許可した場合はRefresh Tokenも発行し、CLIはOSのキーチェーンに保存する。
  - 単独の`/device/token`は、OAuthのトークンではなくBetter Authのセッショントークンを返すため使わない。
  - DPoPは必須とし、CLIが鍵を作って保管する。
  - 承認画面には、クライアント名と許可するscopeを表示し、user codeを使ったフィッシングを防ぐ。
  - 既定値は、有効期限30分、問い合わせの間隔5秒以上、`/device`の確認は有効期限内に5回までとする。
  - `deviceCode`テーブルを追加する。

- 参考
  - [Better Auth Device Authorization](https://www.better-auth.com/docs/plugins/device-authorization)
  - [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628)

- 確認すること
  - device codeのgrantで、DPoPに結合したトークンを発行できるか。ソースではトークンの発行処理がDPoPの結合情報を受け渡している。

### Web MCPに対応

- 参考
  - [https://zenn.dev/chot/articles/268804cd6694ab](https://zenn.dev/chot/articles/268804cd6694ab)

- 説明
  - 普通のMCPはサーバー側でAPIが返したデータを扱う。バックエンドのデータを直接操作する
  - Web MCPは、フロントエンドが側でAIが扱える仕組みを提供する。フロントエンドをComputer Useを使わず操作する
  - 普通のバックエンドのMCPの方が優先度が高い

### 譲渡時に、自動分配するか選べるようにする

- 説明
  - 評価軸ポイントを譲渡する際に、自動分配するか選べるようにする
  - 現在は、譲渡する際に、自動分配するか選べないので、強制的に自動分配される

## 廃止する機能

- 計画なし

## 後で考える機能

1. 即決価格の可否をPoints側で持つことは責務なのか
   - そもそも設定として保つ必要がないのでは？
   - 持つとしてもMarketsの責務では？
     - Markets側で持つ場合は、Pointsの評価軸データをAPIで取得して、Markets側で評価軸の設定をするのか
