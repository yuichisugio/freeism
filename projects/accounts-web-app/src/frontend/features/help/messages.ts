import { oauthClientLimitPerUser, resolveIdentifierLimit } from "../../../shared/constants";
import { defineMessages } from "../../lib/i18n/define-messages";
import type { HelpTopic } from "./lib/help-topics";

/**
 * 各Providerで連携許可を取り消す設定画面。
 */
const providerRevokePages = [
  { name: "Google", url: "https://myaccount.google.com/connections" },
  { name: "GitHub", url: "https://github.com/settings/applications" },
  { name: "ORCID", url: "https://orcid.org/trusted-parties" },
] as const;

/**
 * 使い方からリンクするAPIの文書。
 */
const apiDocumentPaths = {
  accountsOpenApi: "/api/v1/openapi.json",
  betterAuthReference: "/api/auth/reference",
} as const;

/**
 * 使い方（`/help`）の文言と本文。
 * 話題の`id`は節の`id`になり、ほかの画面から`/help#id`で案内するときのリンク先になる。
 * 本文の`` `コード` ``と`**強調**`は、表示時に`code`・`b`要素にする。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../../../docs/specification/v0.1/design-system/design-system.ja.md
 * @see ./components/help-page.test.tsx
 */
export const helpMessages = defineMessages({
  ja: {
    title: "使い方",
    tableOfContents: "目次",
    filterLabel: "絞り込み",
    filterPlaceholder: "例: DNS、退会、リダイレクト",
    noMatch: "該当する項目はありません。",
    developerChip: "開発者向け",
    opensInNewTab: "（新しいタブで開く）",
    topics: [
      {
        id: "start",
        audience: "user",
        title: "はじめに",
        items: [
          {
            id: "overview",
            question: "Freeism Accountsで何ができますか？",
            blocks: [
              {
                kind: "paragraph",
                text: "Freeism Accountsは、GitHubや自分のサイトなどの外部アカウントが自分のものだと証明し、公開プロフィールと連携先サービスへ公開する範囲を自分で選べるサービスです。",
              },
              {
                kind: "steps",
                items: [
                  "**ログインする** — Google・GitHub・ORCIDのいずれかのアカウントでログインします。初めての場合は、そのままFreeism Accountsユーザーを作成します。",
                  "**アカウント所有の証明** — 「アカウント連携」画面で、ログインで証明するか、WebページのURLで証明します。",
                  "**公開先を選ぶ** — プロフィールと連携先サービスごとに、公開する外部アカウントを選んで保存します。",
                  "**連携先とつなぐ** — Pointsなどの連携先サービスから連携を始めると、Freeism Accountsの画面で提供する外部アカウントを選んで同意できます。",
                ],
              },
            ],
          },
        ],
      },
      {
        id: "sign-in",
        audience: "user",
        title: "ログインとユーザーの切替",
        items: [
          {
            id: "how-sign-in",
            question: "どうやってログインしますか？",
            blocks: [
              {
                kind: "paragraph",
                text: "「アカウント連携」画面などに表示されるログインボタンから、Google・GitHub・ORCIDのいずれかのアカウントでログインします。初めての場合は、表示名「仮ユーザー」のFreeism Accountsユーザーを作成します。表示名は「その他」画面で変更できます。",
              },
            ],
          },
          {
            id: "same-email",
            question: "「この外部アカウントはまだ連携されていません」と表示されました",
            blocks: [
              {
                kind: "paragraph",
                text: "同じメールアドレスのFreeism Accountsユーザーが既にある場合は、新しいユーザーを作成せずに案内を表示します。既存のログイン手段でログインし、「アカウント連携」画面からその外部アカウントを連携してください。",
              },
            ],
          },
          {
            id: "switch-user",
            question: "複数のユーザーを切り替えるには？",
            blocks: [
              {
                kind: "paragraph",
                text: "同じブラウザーで複数のFreeism Accountsユーザーにログインできます。ヘッダー右の人アイコンを押すとメニューが開き、ログイン中のユーザーの切替、「アカウントを追加」による別のユーザーでのログイン、ログアウトができます。",
              },
              {
                kind: "note",
                text: "ログアウトは現在のユーザーだけが対象で、ほかにログイン中のユーザーがいればそのユーザーに切り替わります。",
              },
            ],
          },
          {
            id: "user-url",
            question: "URLの先頭に付くIDは何ですか？",
            blocks: [
              {
                kind: "paragraph",
                text: "ログイン後の画面のURLは、先頭にFreeism AccountsユーザーIDが付きます（例: `/ausr_.../settings`）。ほかのユーザーのURLを開くと、そのユーザーにログイン中なら切り替えます。ログインしていなければ、「アカウント連携」と、「その他」の表示言語・テーマ以外の項目ではログインを求め、使い方や利用規約などは現在のユーザーのまま表示します。",
              },
            ],
          },
          {
            id: "language",
            question: "表示言語やテーマを変えるには？",
            blocks: [
              {
                kind: "paragraph",
                text: "表示言語（日本語・英語）とテーマ（システム・ライト・ダーク）は「その他」画面で選べます。ログインしていなくても選べ、このブラウザーに保存します。",
              },
            ],
          },
        ],
      },
      {
        id: "account-links",
        audience: "user",
        title: "外部アカウントの追加",
        items: [
          {
            id: "oauth-add",
            question: "Google・GitHub・ORCIDのアカウントを追加するには？",
            blocks: [
              {
                kind: "paragraph",
                text: "「アカウント連携」画面の「ログインで証明」から、Google・GitHub・ORCIDのアカウントを追加できます。そのサービスにログインするだけで証明でき、追加したアカウントでもログインできます。",
              },
            ],
          },
          {
            id: "url-add",
            question: "WebページやSNSのアカウントを証明するには？",
            blocks: [
              {
                kind: "paragraph",
                text: "GitHubのプロフィールやブログなどのWebページは、「URLで証明」で次のとおり証明します。",
              },
              {
                kind: "steps",
                items: [
                  "証明したいサービスのページに、公開プロフィールURLを記載します。",
                  "その証明したいサービスのURLを入力します。",
                  "「検証する」を押します。",
                ],
              },
              {
                kind: "paragraph",
                text: "「アカウント連携」画面の公開プロフィールURLを押すと、新しいタブで開いて確認できます。",
              },
            ],
          },
          {
            id: "unverified",
            question: "「未検証で保存」とは？",
            blocks: [
              {
                kind: "paragraph",
                text: "所有権を証明せずに登録候補として保存します。後から行の「詳細」の「再検証」を押すと証明できます。",
              },
            ],
          },
          {
            id: "service-notes",
            question: "サービスごとの注意点は？",
            blocks: [
              {
                kind: "list",
                items: [
                  "**X**: ウェブサイト欄のリンクは短縮URLになるため、自己紹介文などに`https://`から始まる完全な公開プロフィールURLを書いてください。",
                  "**Mastodon**: Freeism Accountsで外部URLを一般公開した後に、Mastodonのプロフィールを再保存すると認証済みリンクになります。",
                  "**GitHub・Codeberg・Hugging Faceなどの組織アカウント**: 最後に所有権を証明した個人のFreeism Accountsユーザーに紐付きます。",
                  "**DNS TXT**: レコードの追加後、反映やキャッシュの更新に時間がかかることがあります。時間をおいて再検証してください。",
                ],
              },
              {
                kind: "note",
                text: "GitHubなどのプロフィールURLで証明すると、そのアカウントのユーザー名とプロフィールURLにも証明が適用されます。記事などのコンテンツURLは入力したURLだけが対象です。",
              },
            ],
          },
        ],
      },
      {
        id: "url-verification",
        audience: "user",
        title: "URLの検証とDNS TXT",
        items: [
          {
            id: "what-checked",
            question: "検証では何を確認しますか？",
            blocks: [
              {
                kind: "paragraph",
                text: "「検証する」を押すと、Freeism Accountsがページを取得して公開プロフィールURLへのリンクを確認します。確認するのはリンクの存在で、ページの編集権限までは保証しません。",
              },
            ],
          },
          {
            id: "dns-txt",
            question: "ページにリンクを載せられないときは？（DNS TXT）",
            blocks: [
              {
                kind: "paragraph",
                text: "リンクを確認できない場合は、同じ操作でDNS TXTを確認します。`_accounts.{host}`という名前のTXTレコードに、本人の公開プロフィールURLを値として追加してください。",
              },
              {
                kind: "paragraph",
                text: "例: `_accounts.hanako.dev` に `https://accounts.freeism.app/profiles/ausr_7k2mq9` を追加します。",
              },
            ],
          },
          {
            id: "dns-scope",
            question: "DNS TXTで証明すると、どこまでが対象になりますか？",
            blocks: [
              {
                kind: "paragraph",
                text: "DNS TXTで証明したhostでは、同じhostで登録済みのURLすべてが証明の対象になります。サブドメインはhostごとに証明します。",
              },
            ],
          },
          {
            id: "dns-wait",
            question: "DNS TXTが一致しないときは？",
            blocks: [
              {
                kind: "note",
                text: "DNSの変更は反映に時間がかかることがあります。一致しない場合は、時間をおいて再度検証してください。",
              },
            ],
          },
          {
            id: "results",
            question: "検証結果の見方は？",
            blocks: [
              {
                kind: "list",
                items: [
                  "**成功**: 所有権を証明しました。行には成功した検証方法のチップが付きます。",
                  "**証拠を確認できませんでした**: 結果の下の案内文に従ってページやDNSを直し、再検証してください。未検証の行の「詳細」には、直近の検証結果と案内文を表示します。",
                  "**判断できませんでした**: 通信の失敗などで判断できなかった状態です。案内文を確認し、時間をおいて再検証してください。",
                ],
              },
            ],
          },
        ],
      },
      {
        id: "visibility",
        audience: "user",
        title: "公開設定",
        items: [
          {
            id: "table",
            question: "表の見方は？",
            blocks: [
              {
                kind: "paragraph",
                text: "「アカウント連携」画面の表では、外部アカウントを行、プロフィールと連携先サービスを列にして、公開する組み合わせをチェックボックスで選びます。",
              },
              {
                kind: "paragraph",
                text: "列見出しの「公開中」「非公開」は、保存済みの状態で、その列に証明済みの外部アカウントが選ばれているかを示します。",
              },
            ],
          },
          {
            id: "provide",
            question: "連携先サービスへ提供するには？",
            blocks: [
              {
                kind: "paragraph",
                text: "その列で証明済みの外部アカウントを1件以上選んで保存します。1件も選ばずに保存すると、そのサービスへは情報を提供しません。",
              },
            ],
          },
          {
            id: "bulk",
            question: "まとめて選ぶには？",
            blocks: [
              {
                kind: "paragraph",
                text: "表の最初の行のチェックボックスで列ごとに、各行の左端のチェックボックスで行ごとに、まとめて選択・解除できます。未検証の行も対象です。",
              },
            ],
          },
          {
            id: "save",
            question: "変更はいつ反映されますか？",
            blocks: [
              {
                kind: "paragraph",
                text: "変更は表の下の「公開設定を保存」でまとめて反映します。未保存の変更がある間は件数を表示し、「破棄」で保存済みの状態に戻せます。",
              },
            ],
          },
          {
            id: "unverified-public",
            question: "未検証の外部アカウントは公開できますか？",
            blocks: [
              {
                kind: "paragraph",
                text: "チェックは付けられますが、証明が成立するまで一般公開・連携先への提供はしません。未検証の外部アカウントだけを選んだ公開先は「非公開」のままです。後から追加した外部アカウントは、本人が選ぶまで公開・提供しません。",
              },
            ],
          },
          {
            id: "profile-hidden",
            question: "公開プロフィールが表示されないのは？",
            blocks: [
              {
                kind: "paragraph",
                text: "プロフィールの列に証明済みの外部アカウントを1件も選んでいないと、公開プロフィールは「このプロフィールは存在しません」と表示します。",
              },
            ],
          },
          {
            id: "consent",
            question: "連携先サービスから連携を始めたときは？",
            blocks: [
              {
                kind: "paragraph",
                text: "Freeism Accountsの同意画面に移動し、連携先からの依頼が表示されます。その連携先に提供する外部アカウントを選び、「同意して戻る」を押します。証明済みの外部アカウントを1件以上選ぶと同意できます。",
              },
            ],
          },
        ],
      },
      {
        id: "unlink",
        audience: "user",
        title: "連携解除",
        items: [
          {
            id: "unlink-all",
            question: "「すべての連携解除」とは？",
            blocks: [
              {
                kind: "paragraph",
                text: "外部アカウントの行全体を対象にし、その行の識別子・証明・公開設定を終了します。OAuthのログイン手段を含む場合は、その認証連携も解除します。",
              },
            ],
          },
          {
            id: "unlink-proof",
            question: "「この証明を解除」とは？",
            blocks: [
              {
                kind: "paragraph",
                text: "行の「詳細」で、検証方法ごとに証明を終了します。OAuthの証明を解除すると、そのログイン手段も終了します。双方向リンク・DNS TXTで証明した識別子と公開設定は残ります。",
              },
            ],
          },
          {
            id: "last-login",
            question: "解除できないと表示されました",
            blocks: [
              {
                kind: "note",
                tone: "warning",
                text: "Google・GitHub・ORCIDのアカウントは合計で最低1件残す必要があり、最後のログイン手段は解除できません。",
              },
            ],
          },
        ],
      },
      {
        id: "backup",
        audience: "user",
        title: "データ出力とデータ取込",
        items: [
          {
            id: "export",
            question: "データを保存するには？",
            blocks: [
              {
                kind: "paragraph",
                text: "「その他」画面の「データ出力」で、表示名・外部アカウント・公開設定をJSONファイルに保存できます。メールアドレス・トークン・セッションは含みません。",
              },
            ],
          },
          {
            id: "import",
            question: "保存したデータを戻す・ほかのサービスから移るには？",
            blocks: [
              {
                kind: "paragraph",
                text: "「データ取込」でJSONファイルを選んで取り込むと、バックアップ時の設定に戻します。本人に紐付いていない外部アカウントは登録候補として取り込み、所有権を改めて証明すると有効になります。",
              },
              {
                kind: "paragraph",
                text: "ほかのサービスから移るときは、テンプレートに合わせたJSONを用意します。整形は「AIに整形を頼む文面をコピー」で文面をコピーして使えます。",
              },
            ],
          },
        ],
      },
      {
        id: "withdrawal",
        audience: "user",
        title: "退会",
        items: [
          {
            id: "withdraw",
            question: "退会するには？",
            blocks: [
              {
                kind: "paragraph",
                text: "「その他」画面の「退会」から手続きします。確認のため `DELETE` と入力すると退会できます。",
              },
              {
                kind: "note",
                tone: "danger",
                text: "退会は取り消せません。外部アカウントの証明、公開設定、連携先への提供、登録したOAuthクライアントがすべて削除されます。削除する情報はプライバシーポリシーを参照してください。",
              },
            ],
          },
        ],
      },
      {
        id: "revoke",
        audience: "user",
        title: "各サービスでの連携許可の取消",
        items: [
          {
            id: "revoke-apps",
            question: "連携解除や退会の後、各サービスの連携アプリ一覧に残るのは？",
            blocks: [
              {
                kind: "paragraph",
                text: "連携解除や退会の後も、Google・GitHub・ORCIDの連携アプリ一覧にFreeism Accountsが残ります。各サービスの設定画面から、Freeism Accountsのアクセスを取り消せます。",
              },
              {
                kind: "links",
                links: providerRevokePages.map((page) => ({ label: `${page.name}の設定画面`, url: page.url })),
              },
            ],
          },
        ],
      },
      {
        id: "dev-client",
        audience: "developer",
        title: "OAuthクライアントの登録",
        items: [
          {
            id: "dev-overview",
            question: "何ができますか？",
            blocks: [
              {
                kind: "paragraph",
                text: "自分のアプリをOAuthクライアントとして登録し、Freeism Accountsと連携できるようにします。登録は「その他」画面の「開発者向け」で行います。",
              },
              {
                kind: "paragraph",
                text: `1人の利用者が登録できるOAuthクライアントは${oauthClientLimitPerUser}件までです。`,
              },
            ],
          },
          {
            id: "dev-redirect",
            question: "リダイレクトURLの条件は？",
            blocks: [
              {
                kind: "paragraph",
                text: "認証・同意の後に利用者を戻すURLです。HTTPSのURL（localhost・127.0.0.1・[::1]を除く）、またはローカル開発用にlocalhost・127.0.0.1・[::1]のHTTPのURLを、#以降を付けずに登録できます。",
              },
            ],
          },
          {
            id: "dev-jwks",
            question: "公開鍵（JWK Set）はどう入力しますか？",
            blocks: [
              {
                kind: "paragraph",
                text: '`private_key_jwt`で使う公開鍵を `{"keys":[...]}` 形式のJSONで入力します。',
              },
              {
                kind: "note",
                text: "鍵を切り替えるときは、新旧の鍵を併記して保存してから旧鍵を外してください。",
              },
            ],
          },
        ],
      },
      {
        id: "dev-api",
        audience: "developer",
        title: "APIドキュメント",
        items: [
          {
            id: "openapi",
            question: "APIの仕様はどこで確認できますか？",
            blocks: [
              {
                kind: "paragraph",
                text: "Freeism Accounts APIとBetter Auth APIの仕様をOpenAPIで確認できます。",
              },
              {
                kind: "links",
                links: [
                  { label: "Freeism Accounts API（OpenAPI）", url: apiDocumentPaths.accountsOpenApi },
                  { label: "Better Auth API（OpenAPI）", url: apiDocumentPaths.betterAuthReference },
                ],
              },
              {
                kind: "paragraph",
                text: "連携アカウントの一覧取得と識別子の照合は、JSONの本文で条件を送るHTTP QUERYで呼び出します。完全な定義はOpenAPI 3.2.1のJSONで配信しています。OAuth・OpenID Connectのエンドポイントは、Better Auth APIのドキュメントを参照してください。",
              },
            ],
          },
          {
            id: "auth",
            question: "APIの認証方式は？",
            blocks: [
              {
                kind: "paragraph",
                text: "Access Tokenは`client_credentials`グラントで取得します。クライアント認証は`private_key_jwt`（登録した公開鍵に対応する秘密鍵で署名したJWT）で行い、Access TokenはDPoP（RFC 9449）で鍵に結び付けます。要求では`resource`にAPIのURL（`{Freeism AccountsのURL}/api/v1`）を指定します。",
              },
              {
                kind: "paragraph",
                text: "APIを呼び出すときは、`Authorization: DPoP {Access Token}`と、要求ごとに作る`DPoP` proof（`htm: QUERY`、要求URLの`htu`、Access Tokenのハッシュの`ath`）を送ります。Access Tokenの有効期間は15分で、Refresh Tokenは発行しません。",
              },
            ],
          },
          {
            id: "scopes",
            question: "スコープは？",
            blocks: [
              {
                kind: "list",
                items: [
                  "`openid`: 利用者のログインと、連携先への提供の同意（Authorization Code）に使います。",
                  "`identities:read`: 提供された外部アカウントの一覧取得と識別子の照合に使います。`client_credentials`で取得するAccess Tokenに付きます。",
                ],
              },
            ],
          },
          {
            id: "well-known",
            question: "メタデータ（.well-known）の場所は？",
            blocks: [
              {
                kind: "list",
                items: [
                  "`/.well-known/openid-configuration`: OpenID Connectの設定です。",
                  "`/.well-known/oauth-authorization-server`: 認可サーバーのメタデータ（トークンエンドポイントなど）です。",
                  "`/.well-known/oauth-protected-resource/api/v1`: APIのメタデータです。401・403の`WWW-Authenticate`の`resource_metadata`もこの経路を示します。",
                ],
              },
            ],
          },
          {
            id: "op-list",
            question: "連携先へ提供する外部アカウントを一覧で取得する",
            blocks: [
              { kind: "code", text: "QUERY /api/v1/external-accounts" },
              {
                kind: "paragraph",
                text: "利用者がこのクライアントへの提供を選んだ証明済みの外部アカウントをすべて返します。存在しないユーザーと、このクライアントへ提供する証明済みの外部アカウントが無いユーザーは、同じ404を返します。",
              },
              {
                kind: "statuses",
                entries: [
                  { status: "200", text: "提供する外部アカウントの一覧です。" },
                  {
                    status: "400",
                    text: "要求全体の不備です: `INVALID_JSON`・`MISSING_REQUIRED_FIELD`（`Content-Type`が無い場合を含む）・`INVALID_TYPE`・`INVALID_VALUE`・`UNKNOWN_FIELD`。",
                  },
                  {
                    status: "404",
                    text: "`NOT_FOUND`: ユーザーが存在しないか、このクライアントへ提供する証明済みの外部アカウントがありません。",
                  },
                ],
              },
            ],
          },
          {
            id: "op-resolve",
            question: "識別子をFreeism Accountsユーザーへ照合する",
            blocks: [
              { kind: "code", text: "QUERY /api/v1/identities/resolve" },
              {
                kind: "paragraph",
                text: "各識別子を、保存済みの証明済み識別子と、このクライアントへの現在の公開設定で照合します。結果は入力の順に返します。未登録の識別子と、このクライアントへ提供していない識別子は、どちらも`no_match`を返します。",
              },
              {
                kind: "statuses",
                entries: [
                  {
                    status: "200",
                    text: "すべての識別子が有効でした。`identifiers`が空の場合は、空の`results`を返します。",
                  },
                  {
                    status: "400",
                    text: `1件以上の識別子が不正な場合（有効な識別子の結果も含め、\`results\`に\`invalid_input\`を返します）と、要求全体が不正な場合（最上位の\`errors\`: \`INVALID_JSON\`・\`MISSING_REQUIRED_FIELD\`・\`INVALID_TYPE\`・${resolveIdentifierLimit}件を超える識別子を含む\`INVALID_VALUE\`・\`UNKNOWN_FIELD\`）があります。`,
                  },
                ],
              },
            ],
          },
          {
            id: "op-common",
            question: "共通の応答",
            blocks: [
              {
                kind: "statuses",
                entries: [
                  {
                    status: "401",
                    text: "`UNAUTHORIZED`: Access Token・DPoP proofが無いか、不正または期限切れです。クライアントが削除された場合も含みます。",
                  },
                  { status: "403", text: "`INSUFFICIENT_SCOPE`: Access Tokenに`identities:read`がありません。" },
                  { status: "413", text: "`REQUEST_TOO_LARGE`: 要求の本文が5MiB（5,242,880 bytes）を超えています。" },
                  { status: "415", text: "`UNSUPPORTED_MEDIA_TYPE`: `Content-Type`がJSONではありません。" },
                  { status: "429", text: "Cloudflare WAFによる流量制限です。本文はこのAPIのエラー形式に従いません。" },
                  { status: "500", text: "`INTERNAL_ERROR`: サーバーで処理に失敗しました。" },
                ],
              },
            ],
          },
        ],
      },
    ] satisfies HelpTopic[],
  },
  en: {
    title: "Guide",
    tableOfContents: "Contents",
    filterLabel: "Filter",
    filterPlaceholder: "e.g. DNS, delete, redirect",
    noMatch: "No matching items.",
    developerChip: "For developers",
    opensInNewTab: "(opens in a new tab)",
    topics: [
      {
        id: "start",
        audience: "user",
        title: "Getting started",
        items: [
          {
            id: "overview",
            question: "What can I do with Freeism Accounts?",
            blocks: [
              {
                kind: "paragraph",
                text: "Freeism Accounts lets you prove that external accounts, such as GitHub or your own website, belong to you, and choose what to show on your public profile and share with each connected service.",
              },
              {
                kind: "steps",
                items: [
                  "**Sign in** — Sign in with your Google, GitHub, or ORCID account. The first time, a Freeism Accounts user is created for you.",
                  "**Prove account ownership** — On the Account links page, prove ownership by signing in or with the URL of a web page.",
                  "**Choose where to share** — For your profile and each connected service, select the external accounts to share and save.",
                  "**Connect a service** — When you start connecting from a service such as Points, select the external accounts to share on the Freeism Accounts page and allow it.",
                ],
              },
            ],
          },
        ],
      },
      {
        id: "sign-in",
        audience: "user",
        title: "Signing in and switching users",
        items: [
          {
            id: "how-sign-in",
            question: "How do I sign in?",
            blocks: [
              {
                kind: "paragraph",
                text: "Use the sign-in button shown on pages such as Account links, and sign in with your Google, GitHub, or ORCID account. The first time, a Freeism Accounts user with the display name \"仮ユーザー\" (temporary user) is created. You can change the display name on the Other page.",
              },
            ],
          },
          {
            id: "same-email",
            question: "I was told \"This external account is not linked yet\"",
            blocks: [
              {
                kind: "paragraph",
                text: "If a Freeism Accounts user with the same email address already exists, no new user is created and guidance is shown. Sign in with your existing sign-in method and link the external account from the Account links page.",
              },
            ],
          },
          {
            id: "switch-user",
            question: "How do I switch between users?",
            blocks: [
              {
                kind: "paragraph",
                text: "You can sign in to several Freeism Accounts users on the same browser. Press the person icon at the right of the header to open a menu where you can switch between signed-in users, sign in as another user with \"Add account\", and sign out.",
              },
              {
                kind: "note",
                text: "Signing out applies only to the current user. If another user is signed in, Freeism Accounts switches to that user.",
              },
            ],
          },
          {
            id: "user-url",
            question: "What is the ID at the start of the URL?",
            blocks: [
              {
                kind: "paragraph",
                text: "After you sign in, page URLs start with your Freeism Accounts user ID (for example, `/ausr_.../settings`). If you open a URL for another user, Freeism Accounts switches to that user when they are signed in on this browser. Otherwise, Account links and the items on the Other page other than display language and theme ask you to sign in, while pages such as this guide and the terms of use open as the current user.",
              },
            ],
          },
          {
            id: "language",
            question: "How do I change the display language or theme?",
            blocks: [
              {
                kind: "paragraph",
                text: "You can choose the display language (Japanese or English) and the theme (system, light, or dark) on the Other page, even without signing in. The choices are saved in this browser.",
              },
            ],
          },
        ],
      },
      {
        id: "account-links",
        audience: "user",
        title: "Adding external accounts",
        items: [
          {
            id: "oauth-add",
            question: "How do I add a Google, GitHub, or ORCID account?",
            blocks: [
              {
                kind: "paragraph",
                text: "Use \"Prove by signing in\" on the Account links page to add Google, GitHub, or ORCID accounts. Signing in to the service proves ownership, and you can also sign in with the accounts you add.",
              },
            ],
          },
          {
            id: "url-add",
            question: "How do I prove a web page or social media account?",
            blocks: [
              {
                kind: "paragraph",
                text: "For a web page such as a GitHub profile or a blog, use \"Prove with a URL\" as follows.",
              },
              {
                kind: "steps",
                items: [
                  "Put your public profile URL on the page of the service you want to prove.",
                  "Enter the URL of that page.",
                  "Press \"Verify\".",
                ],
              },
              {
                kind: "paragraph",
                text: "Press the public profile URL on the Account links page to open it in a new tab.",
              },
            ],
          },
          {
            id: "unverified",
            question: "What does \"Save without verifying\" do?",
            blocks: [
              {
                kind: "paragraph",
                text: "It saves the URL as a candidate without proving ownership. You can prove it later by pressing \"Verify again\" in the row's \"Details\".",
              },
            ],
          },
          {
            id: "service-notes",
            question: "Are there notes for each service?",
            blocks: [
              {
                kind: "list",
                items: [
                  "**X**: links in the website field are shortened, so write your full public profile URL starting with `https://` in your bio.",
                  "**Mastodon**: after making the external URL public in Freeism Accounts, save your Mastodon profile again to get a verified link.",
                  "**Organization accounts on GitHub, Codeberg, Hugging Face and others**: linked to the Freeism Accounts user of the person who proved ownership most recently.",
                  "**DNS TXT**: a new record can take time to propagate and caches to expire. Verify again later.",
                ],
              },
              {
                kind: "note",
                text: "When you prove a profile URL on a service such as GitHub, the proof also covers that account's username and profile URL. A content URL such as an article covers only the URL you entered.",
              },
            ],
          },
        ],
      },
      {
        id: "url-verification",
        audience: "user",
        title: "URL verification and DNS TXT",
        items: [
          {
            id: "what-checked",
            question: "What does verification check?",
            blocks: [
              {
                kind: "paragraph",
                text: "When you press \"Verify\", Freeism Accounts fetches the page and checks for a link to your public profile URL. This confirms the link exists, not that you can edit the page.",
              },
            ],
          },
          {
            id: "dns-txt",
            question: "What if I cannot put a link on the page? (DNS TXT)",
            blocks: [
              {
                kind: "paragraph",
                text: "If the link cannot be confirmed, the same operation checks DNS TXT. Add a TXT record named `_accounts.{host}` whose value is your public profile URL.",
              },
              {
                kind: "paragraph",
                text: "Example: add `https://accounts.freeism.app/profiles/ausr_7k2mq9` to `_accounts.hanako.dev`.",
              },
            ],
          },
          {
            id: "dns-scope",
            question: "What does a DNS TXT proof cover?",
            blocks: [
              {
                kind: "paragraph",
                text: "A host proven by DNS TXT covers every URL you have registered on the same host. Subdomains are proven separately for each host.",
              },
            ],
          },
          {
            id: "dns-wait",
            question: "What if DNS TXT does not match?",
            blocks: [
              {
                kind: "note",
                text: "DNS changes may take time to propagate. If there is no match, please verify again later.",
              },
            ],
          },
          {
            id: "results",
            question: "How do I read the verification result?",
            blocks: [
              {
                kind: "list",
                items: [
                  "**Succeeded**: ownership was proven. The row shows a chip for each method that succeeded.",
                  "**Evidence not found**: fix the page or DNS as the guidance below the result says, then verify again. \"Details\" of an unverified row shows the latest result and its guidance.",
                  "**Could not determine**: the result could not be determined, for example because of a network failure. Check the guidance and verify again later.",
                ],
              },
            ],
          },
        ],
      },
      {
        id: "visibility",
        audience: "user",
        title: "Sharing settings",
        items: [
          {
            id: "table",
            question: "How do I read the table?",
            blocks: [
              {
                kind: "paragraph",
                text: "The table on the Account links page has your external accounts as rows and your profile and each connected service as columns. Select the combinations to share with the checkboxes.",
              },
              {
                kind: "paragraph",
                text: "\"Public\" and \"Private\" in the column headers show, for the saved settings, whether a verified external account is selected in that column.",
              },
            ],
          },
          {
            id: "provide",
            question: "How do I share with a connected service?",
            blocks: [
              {
                kind: "paragraph",
                text: "Select at least one verified external account in its column and save. If you save with none selected, no information is shared with that service.",
              },
            ],
          },
          {
            id: "bulk",
            question: "How do I select many at once?",
            blocks: [
              {
                kind: "paragraph",
                text: "Use the checkboxes in the first row of the table to select or clear a column, and the checkbox at the left of each row to select or clear a row. Unverified rows are included.",
              },
            ],
          },
          {
            id: "save",
            question: "When are my changes applied?",
            blocks: [
              {
                kind: "paragraph",
                text: "Press \"Save sharing settings\" below the table to apply your changes. While you have unsaved changes, their count is shown, and \"Discard\" returns to the saved settings.",
              },
            ],
          },
          {
            id: "unverified-public",
            question: "Can I share unverified external accounts?",
            blocks: [
              {
                kind: "paragraph",
                text: "You can select them, but they are not shown publicly or shared with connected services until ownership is proven. A destination with only unverified accounts selected stays \"Private\". External accounts you add later are not shared until you select them.",
              },
            ],
          },
          {
            id: "profile-hidden",
            question: "Why is my public profile not shown?",
            blocks: [
              {
                kind: "paragraph",
                text: "If no verified external account is selected in the profile column, your public profile shows \"Profile not found\".",
              },
            ],
          },
          {
            id: "consent",
            question: "What happens when I start connecting from a connected service?",
            blocks: [
              {
                kind: "paragraph",
                text: "You move to the Freeism Accounts consent page, which shows the request from the service. Select the external accounts to share with that service and press \"Allow and return\". You can allow it when at least one verified external account is selected.",
              },
            ],
          },
        ],
      },
      {
        id: "unlink",
        audience: "user",
        title: "Unlinking",
        items: [
          {
            id: "unlink-all",
            question: "What does \"Unlink all\" do?",
            blocks: [
              {
                kind: "paragraph",
                text: "It applies to the whole external account row and ends its identifiers, proofs, and sharing settings. If the row includes an OAuth sign-in method, that connection is also unlinked.",
              },
            ],
          },
          {
            id: "unlink-proof",
            question: "What does \"Remove this proof\" do?",
            blocks: [
              {
                kind: "paragraph",
                text: "In the row's \"Details\", it ends the proof of one verification method. Removing an OAuth proof also ends that sign-in method. Identifiers proven by a two-way link or DNS TXT, and the sharing settings, are kept.",
              },
            ],
          },
          {
            id: "last-login",
            question: "I was told I cannot unlink",
            blocks: [
              {
                kind: "note",
                tone: "warning",
                text: "You must keep at least one Google, GitHub, or ORCID account in total, so your last sign-in method cannot be unlinked.",
              },
            ],
          },
        ],
      },
      {
        id: "backup",
        audience: "user",
        title: "Data export and import",
        items: [
          {
            id: "export",
            question: "How do I save my data?",
            blocks: [
              {
                kind: "paragraph",
                text: "Use \"Export data\" on the Other page to save your display name, external accounts, and sharing settings as a JSON file. Email addresses, tokens, and sessions are not included.",
              },
            ],
          },
          {
            id: "import",
            question: "How do I restore saved data or move from another service?",
            blocks: [
              {
                kind: "paragraph",
                text: "Select a JSON file with \"Import data\" to return to the settings at the time of the backup. External accounts no longer linked to you are imported as candidates and become active after you prove ownership again.",
              },
              {
                kind: "paragraph",
                text: "When moving from another service, prepare JSON that follows the template. To have it formatted, copy the text with \"Copy a prompt for AI formatting\".",
              },
            ],
          },
        ],
      },
      {
        id: "withdrawal",
        audience: "user",
        title: "Deleting your account",
        items: [
          {
            id: "withdraw",
            question: "How do I delete my account?",
            blocks: [
              {
                kind: "paragraph",
                text: "Use \"Delete account\" on the Other page. To confirm, type `DELETE`.",
              },
              {
                kind: "note",
                tone: "danger",
                text: "This cannot be undone. Your external account proofs, sharing settings, sharing with connected services, and the OAuth clients you registered are all deleted. See the privacy policy for the information that is deleted.",
              },
            ],
          },
        ],
      },
      {
        id: "revoke",
        audience: "user",
        title: "Revoking access on each service",
        items: [
          {
            id: "revoke-apps",
            question: "Why does Freeism Accounts stay in each service's connected apps after unlinking or deleting?",
            blocks: [
              {
                kind: "paragraph",
                text: "Even after you unlink an account or delete your account, Freeism Accounts stays in the connected apps list of Google, GitHub, and ORCID. You can revoke Freeism Accounts' access from each service's settings.",
              },
              {
                kind: "links",
                links: providerRevokePages.map((page) => ({ label: `${page.name} settings`, url: page.url })),
              },
            ],
          },
        ],
      },
      {
        id: "dev-client",
        audience: "developer",
        title: "Registering an OAuth client",
        items: [
          {
            id: "dev-overview",
            question: "What can I do?",
            blocks: [
              {
                kind: "paragraph",
                text: "Register your app as an OAuth client so that it can connect to Freeism Accounts. Register it in \"For developers\" on the Other page.",
              },
              {
                kind: "paragraph",
                text: `Each user can register up to ${oauthClientLimitPerUser} OAuth clients.`,
              },
            ],
          },
          {
            id: "dev-redirect",
            question: "What redirect URLs are allowed?",
            blocks: [
              {
                kind: "paragraph",
                text: "The URL users return to after authentication and consent. You can register an HTTPS URL (other than localhost, 127.0.0.1, and [::1]), or an HTTP URL on localhost, 127.0.0.1, or [::1] for local development, without a # fragment.",
              },
            ],
          },
          {
            id: "dev-jwks",
            question: "How do I enter the public keys (JWK Set)?",
            blocks: [
              {
                kind: "paragraph",
                text: 'Enter the public keys used for `private_key_jwt` as JSON in the `{"keys":[...]}` format.',
              },
              {
                kind: "note",
                text: "To rotate keys, save both the old and new keys first, then remove the old key.",
              },
            ],
          },
        ],
      },
      {
        id: "dev-api",
        audience: "developer",
        title: "API documentation",
        items: [
          {
            id: "openapi",
            question: "Where can I find the API reference?",
            blocks: [
              {
                kind: "paragraph",
                text: "The Freeism Accounts API and the Better Auth API are described in OpenAPI.",
              },
              {
                kind: "links",
                links: [
                  { label: "Freeism Accounts API (OpenAPI)", url: apiDocumentPaths.accountsOpenApi },
                  { label: "Better Auth API (OpenAPI)", url: apiDocumentPaths.betterAuthReference },
                ],
              },
              {
                kind: "paragraph",
                text: "Listing linked accounts and resolving identifiers use HTTP QUERY with the conditions in a JSON body. The full definition is served as OpenAPI 3.2.1 JSON. See the Better Auth API reference for the OAuth and OpenID Connect endpoints.",
              },
            ],
          },
          {
            id: "auth",
            question: "How does the API authenticate clients?",
            blocks: [
              {
                kind: "paragraph",
                text: "Get an access token with the `client_credentials` grant. Authenticate the client with `private_key_jwt` (a JWT signed with the private key of a registered public key), and bind the access token to the key with DPoP (RFC 9449). Set `resource` in the request to the API URL (`{Freeism Accounts URL}/api/v1`).",
              },
              {
                kind: "paragraph",
                text: "When calling the API, send `Authorization: DPoP {access token}` together with a new `DPoP` proof for each request (`htm: QUERY`, `htu` set to the request URL, and `ath` set to the hash of the access token). Access tokens are valid for 15 minutes, and no refresh token is issued.",
              },
            ],
          },
          {
            id: "scopes",
            question: "What scopes are there?",
            blocks: [
              {
                kind: "list",
                items: [
                  "`openid`: used for user sign-in and consent to sharing with the service (Authorization Code).",
                  "`identities:read`: used to list provided external accounts and resolve identifiers. It is granted to access tokens from `client_credentials`.",
                ],
              },
            ],
          },
          {
            id: "well-known",
            question: "Where is the metadata (.well-known)?",
            blocks: [
              {
                kind: "list",
                items: [
                  "`/.well-known/openid-configuration`: the OpenID Connect configuration.",
                  "`/.well-known/oauth-authorization-server`: the authorization server metadata, such as the token endpoint.",
                  "`/.well-known/oauth-protected-resource/api/v1`: the API metadata. `resource_metadata` in the `WWW-Authenticate` header of 401 and 403 responses also points here.",
                ],
              },
            ],
          },
          {
            id: "op-list",
            question: "List the external accounts provided to this client",
            blocks: [
              { kind: "code", text: "QUERY /api/v1/external-accounts" },
              {
                kind: "paragraph",
                text: "Returns every verified external account that the user has chosen to provide to this client. A missing user and a user who provides no verified external account to this client return the same 404.",
              },
              {
                kind: "statuses",
                entries: [
                  { status: "200", text: "The provided external accounts." },
                  {
                    status: "400",
                    text: "The whole request is invalid: `INVALID_JSON`, `MISSING_REQUIRED_FIELD` (including a missing `Content-Type`), `INVALID_TYPE`, `INVALID_VALUE` or `UNKNOWN_FIELD`.",
                  },
                  {
                    status: "404",
                    text: "`NOT_FOUND`: the user does not exist or provides no verified external account to this client.",
                  },
                ],
              },
            ],
          },
          {
            id: "op-resolve",
            question: "Resolve identifiers to Freeism Accounts users",
            blocks: [
              { kind: "code", text: "QUERY /api/v1/identities/resolve" },
              {
                kind: "paragraph",
                text: "Resolves each identifier with the stored verified identifiers and the current sharing settings for this client. Results keep the input order. An unregistered identifier and one not provided to this client both return `no_match`.",
              },
              {
                kind: "statuses",
                entries: [
                  { status: "200", text: "Every identifier was valid. An empty `identifiers` returns empty `results`." },
                  {
                    status: "400",
                    text: `Either at least one identifier is invalid (\`results\` with \`invalid_input\`, including the results of the valid identifiers), or the whole request is invalid (top-level \`errors\`: \`INVALID_JSON\`, \`MISSING_REQUIRED_FIELD\`, \`INVALID_TYPE\`, \`INVALID_VALUE\` including more than ${resolveIdentifierLimit} identifiers, or \`UNKNOWN_FIELD\`).`,
                  },
                ],
              },
            ],
          },
          {
            id: "op-common",
            question: "Common responses",
            blocks: [
              {
                kind: "statuses",
                entries: [
                  {
                    status: "401",
                    text: "`UNAUTHORIZED`: the access token or DPoP proof is missing, invalid, or expired, including when the client was deleted.",
                  },
                  { status: "403", text: "`INSUFFICIENT_SCOPE`: the access token does not have `identities:read`." },
                  { status: "413", text: "`REQUEST_TOO_LARGE`: the request body exceeds 5 MiB (5,242,880 bytes)." },
                  { status: "415", text: "`UNSUPPORTED_MEDIA_TYPE`: `Content-Type` is not JSON." },
                  {
                    status: "429",
                    text: "Rate limited by Cloudflare WAF. The body does not follow this API's error format.",
                  },
                  { status: "500", text: "`INTERNAL_ERROR`: the server failed to process the request." },
                ],
              },
            ],
          },
        ],
      },
    ] satisfies HelpTopic[],
  },
});
