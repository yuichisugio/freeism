import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * ヘルプの1つの節。
 * `items`は箇条書きで表示する。
 */
export type HelpSection = {
  id: string;
  title: string;
  paragraphs: string[];
  items: string[];
};

/**
 * 各Providerで連携許可を取り消す設定画面。
 */
export const providerRevokePages = [
  { name: "Google", url: "https://myaccount.google.com/connections" },
  { name: "GitHub", url: "https://github.com/settings/applications" },
  { name: "ORCID", url: "https://orcid.org/trusted-parties" },
] as const;

/**
 * 公開ヘルプ・プライバシー説明の文言。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 */
export const helpMessages = defineMessages({
  ja: {
    title: "ヘルプ・プライバシー",
    introduction:
      "Accountsは、Google・GitHub・ORCIDなどの外部アカウントやWebページの所有権を証明し、一般公開と連携先サービスごとに提供する情報を本人が選ぶためのサービスです。",
    revokeTitle: "各サービスでの連携許可の取消",
    revokeDescription:
      "連携解除や退会の後も、Google・GitHub・ORCIDの連携アプリ一覧にAccountsが残ります。各サービスの設定画面から、Accountsのアクセスを取り消せます。",
    revokeLinkLabel: (providerName: string) => `${providerName}の設定画面`,
    sections: [
      {
        id: "retention",
        title: "保存する情報",
        paragraphs: ["Accountsは、次の情報を保存します。"],
        items: [
          "Accountsの表示名とAccountsユーザーID",
          "連携した外部アカウントのサービス名・表示名・固有ID・ユーザー名・URLと連携日時",
          "証明方法（OAuth・公開ページのリンク確認・DNS TXT）ごとの検証日時・結果・証拠URL",
          "一般公開と連携先サービスごとの情報提供同意・公開選択",
          "ログインに使ったOAuthのメールアドレス（本人の画面で複数アカウントを見分ける補助にだけ使い、一般公開・連携先へは提供しません）",
          "外部サービスのOAuthのトークン（暗号化して保存します）",
        ],
      },
      {
        id: "not-retained",
        title: "保存しない情報",
        paragraphs: [],
        items: [
          "URL検証のために取得した外部ページの本文は保存しません。",
          "パスワードは扱いません。ログインにはGoogle・GitHub・ORCIDのアカウントを使います。",
        ],
      },
      {
        id: "publication",
        title: "一般公開と連携先サービスへの提供",
        paragraphs: [
          "一般公開と各連携先サービス（OAuthクライアント）は、それぞれ独立して設定します。どちらも、本人が「アカウント連携」画面で選んだ証明済みの外部アカウントだけを対象にします。",
        ],
        items: [
          "一般公開: 選んだ外部アカウントを公開プロフィール（/profiles/{AccountsユーザーID}）に掲載します。URLを知っている人は、ログインせずに閲覧できます。",
          "連携先サービス: 情報提供に同意し、公開を選んだ外部アカウントのサービス名・表示名・識別情報・検証結果を提供します。同意をOFFにして保存すると、そのサービスへの提供を停止します。",
          "未検証のURLは、本人の画面とJSON出力だけで扱い、一般公開・連携先へは提供しません。",
          "後から追加した外部アカウントは、本人が選ぶまで公開・提供しません。",
        ],
      },
      {
        id: "unlink",
        title: "連携解除",
        paragraphs: [],
        items: [
          "「連携解除」は、外部アカウントの行全体を対象にし、その行の識別子・証明・公開設定を終了します。",
          "「OAuthの認証連携だけ解除する」は、OAuthのログイン手段と証明だけを終了し、公開ページのリンク確認・DNS TXTで証明した識別子と公開設定を残します。",
          "Google・GitHub・ORCIDのアカウントは合計で最低1件残す必要があり、最後のログイン手段は解除できません。",
        ],
      },
      {
        id: "url-verification",
        title: "URLの検証とDNS TXT",
        paragraphs: [],
        items: [
          "外部ページに本人の公開プロフィールURLへのリンクを置き、「保存して検証する」を押すと、Accountsがページを取得してリンクを確認します。確認するのはリンクの存在で、ページの編集権限までは保証しません。",
          "リンクを確認できない場合は、同じ操作でDNS TXTを確認します。`_accounts.{host}`という名前のTXTレコードに、本人の公開プロフィールURLを値として追加してください。",
          "DNS TXTで証明したhostでは、同じhostで登録済みのURLすべてが証明の対象になります。サブドメインはhostごとに証明します。",
          "DNSの変更は反映に時間がかかることがあります。一致しない場合は、時間をおいて再度検証してください。",
        ],
      },
      {
        id: "backup",
        title: "バックアップと移行",
        paragraphs: [],
        items: [
          "「設定」画面から、表示名・外部アカウント・公開設定をJSONファイル（5MiBまで）で出力できます。メールアドレス・トークン・セッションは含みません。",
          "同じJSONファイルで復元できます。本人に紐付いていない外部アカウントは登録候補として取り込み、所有権を改めて証明した後に有効になります。",
          "他のサービスへ移行する場合は、移行先で外部アカウントの所有権を改めて証明し、連携先サービスとの連携をやり直します。ログイン手段・セッション・開発者として登録したOAuthクライアントは移行の対象外です。",
        ],
      },
      {
        id: "withdrawal",
        title: "退会",
        paragraphs: [
          "「設定」画面から退会できます。退会すると、プロフィール、外部アカウントの紐付け、公開・提供設定、開発者として登録したOAuthクライアント、セッション・認可・トークンを削除し、一般公開と連携先サービスへの提供を終了します。",
        ],
        items: [],
      },
      {
        id: "logs",
        title: "ログの扱い",
        paragraphs: [
          "ログには、操作の種類・日時・成否・エラーの分類・処理時間など、個人を識別しない項目だけを記録します。表示名・ID・メールアドレス・URL・IPアドレスなどの個人情報や、トークン・Cookieは記録しません。",
        ],
        items: [],
      },
    ] satisfies HelpSection[],
  },
  en: {
    title: "Help and privacy",
    introduction:
      "Accounts lets you prove ownership of external accounts such as Google, GitHub, and ORCID, and of web pages, and choose what information is shared publicly and with each connected service.",
    revokeTitle: "Revoking access on each service",
    revokeDescription:
      "Even after you unlink an account or delete your Accounts user, Accounts stays in the connected apps list of Google, GitHub, and ORCID. You can revoke Accounts' access from each service's settings.",
    revokeLinkLabel: (providerName: string) => `${providerName} settings`,
    sections: [
      {
        id: "retention",
        title: "Information we store",
        paragraphs: ["Accounts stores the following information."],
        items: [
          "Your Accounts display name and Accounts user ID",
          "The service name, display name, unique ID, username, URL, and link date of each linked external account",
          "The verification date, result, and evidence URL for each proof method (OAuth, public page link, DNS TXT)",
          "Your consent and selections for public display and for each connected service",
          "The OAuth email address used to sign in (used only to help you tell your accounts apart on your own pages; never shared publicly or with connected services)",
          "OAuth tokens from external services (stored encrypted)",
        ],
      },
      {
        id: "not-retained",
        title: "Information we do not store",
        paragraphs: [],
        items: [
          "The content of external pages fetched for URL verification is not stored.",
          "Accounts does not handle passwords. You sign in with your Google, GitHub, or ORCID account.",
        ],
      },
      {
        id: "publication",
        title: "Public display and sharing with connected services",
        paragraphs: [
          "Public display and each connected service (OAuth client) are configured independently. Both cover only the verified external accounts you select on the Account links page.",
        ],
        items: [
          "Public display: the selected external accounts are listed on your public profile (/profiles/{Accounts user ID}). Anyone who knows the URL can view it without signing in.",
          "Connected services: if you consent, the service name, display name, identifiers, and verification results of the accounts you select are shared. Turning consent off and saving stops sharing with that service.",
          "Unverified URLs are used only on your own pages and in your JSON export; they are never shared publicly or with connected services.",
          "External accounts you add later are not shared until you select them.",
        ],
      },
      {
        id: "unlink",
        title: "Unlinking",
        paragraphs: [],
        items: [
          "\"Unlink\" applies to the whole external account row and ends its identifiers, proofs, and sharing settings.",
          "\"Unlink only the OAuth connection\" ends only the OAuth sign-in method and its proof, and keeps identifiers proven by public page links or DNS TXT, along with the sharing settings.",
          "You must keep at least one Google, GitHub, or ORCID account in total, so your last sign-in method cannot be unlinked.",
        ],
      },
      {
        id: "url-verification",
        title: "URL verification and DNS TXT",
        paragraphs: [],
        items: [
          "Place a link to your public profile URL on the external page and press \"Save and verify\". Accounts fetches the page and checks the link. This confirms the link exists, not that you can edit the page.",
          "If the link cannot be confirmed, the same operation checks DNS TXT. Add a TXT record named `_accounts.{host}` whose value is your public profile URL.",
          "A host proven by DNS TXT covers every URL you have registered on the same host. Subdomains are proven separately for each host.",
          "DNS changes may take time to propagate. If there is no match, please verify again later.",
        ],
      },
      {
        id: "backup",
        title: "Backup and migration",
        paragraphs: [],
        items: [
          "From the Settings page, you can export your display name, external accounts, and sharing settings as a JSON file (up to 5 MiB). Email addresses, tokens, and sessions are not included.",
          "You can restore from the same JSON file. External accounts no longer linked to you are imported as candidates and become active after you prove ownership again.",
          "When moving to another service, prove ownership of your external accounts again there and reconnect your connected services. Sign-in methods, sessions, and OAuth clients you registered as a developer are not migrated.",
        ],
      },
      {
        id: "withdrawal",
        title: "Deleting your Accounts user",
        paragraphs: [
          "You can delete your Accounts user from the Settings page. This deletes your profile, external account links, sharing settings, OAuth clients you registered as a developer, and your sessions, authorizations, and tokens, and ends public display and sharing with connected services.",
        ],
        items: [],
      },
      {
        id: "logs",
        title: "Logs",
        paragraphs: [
          "Logs record only items that do not identify individuals, such as the operation type, time, outcome, error category, and duration. Personal information such as display names, IDs, email addresses, URLs, and IP addresses, as well as tokens and cookies, is not logged.",
        ],
        items: [],
      },
    ] satisfies HelpSection[],
  },
});
