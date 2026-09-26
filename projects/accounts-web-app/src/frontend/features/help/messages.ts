import { defineMessages } from "../../lib/i18n/define-messages";
import type { DocumentSection } from "../app-shell/components/document-page";

/**
 * 各Providerで連携許可を取り消す設定画面。
 */
const providerRevokePages = [
  { name: "Google", url: "https://myaccount.google.com/connections" },
  { name: "GitHub", url: "https://github.com/settings/applications" },
  { name: "ORCID", url: "https://orcid.org/trusted-parties" },
] as const;

/**
 * 公開ヘルプ（使い方）の文言。
 * 節の`id`は、ほかの画面から`/help#id`で案内するときのリンク先になる。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 */
export const helpMessages = defineMessages({
  ja: {
    title: "ヘルプ",
    introduction:
      "Accountsの使い方をまとめています。保存する情報と公開・提供の扱いはプライバシーポリシー、利用の条件は利用規約を参照してください。",
    sections: [
      {
        id: "sign-in",
        title: "ログインとユーザーの切替",
        paragraphs: [],
        items: [
          "ヘッダーまたはトップページの「ログインする」から、Google・GitHub・ORCIDのいずれかのアカウントでログインします。初めての場合は、表示名「仮ユーザー」のAccountsユーザーを作成します。表示名は「設定」画面で変更できます。",
          "同じメールアドレスのAccountsユーザーが既にある場合は、新しいユーザーを作成せずに案内を表示します。既存のログイン手段でログインし、「アカウント連携」画面からその外部アカウントを連携してください。",
          "同じブラウザーで複数のAccountsユーザーにログインできます。ヘッダー右のアイコンを押すとメニューが開き、ログイン中のユーザーの切替、「アカウントを追加」による別のユーザーでのログイン、「ログアウト」ができます。ログアウトは現在のユーザーだけが対象で、ほかにログイン中のユーザーがいればそのユーザーに切り替わります。",
          "ログイン後の画面のURLは、先頭にAccountsユーザーIDが付きます（例: /ausr_.../settings）。ほかのユーザーのURLを開くと、そのユーザーにログイン中なら切り替え、ログインしていなければログインを求めます。",
          "表示言語は「設定」画面で日本語と英語から選べます。ログインしていなくても選べ、このブラウザーに保存します。",
        ],
      },
      {
        id: "account-links",
        title: "外部アカウントの追加",
        paragraphs: [],
        items: [
          "「アカウント連携」画面の「OAuthで追加連携」から、Google・GitHub・ORCIDのアカウントを追加できます。追加したアカウントでもログインできます。",
          "Webページ（GitHubのプロフィールやブログなど）は、そのページのリンクや本文に「あなたの公開プロフィールURL」を載せてから、URLを入力して「保存して検証する」を押します。公開プロフィールURLは、押すと新しいタブで開いて確認できます。",
          "「未検証で保存」は、所有権を証明せずに登録候補として保存します。後から同じURLで「保存して検証する」を押すと証明できます。",
          "サービスごとの注意点は、「アカウント連携」画面の「サービス別のヒント」で確認できます。",
        ],
      },
      {
        id: "url-verification",
        title: "URLの検証とDNS TXT",
        paragraphs: [],
        items: [
          "「保存して検証する」を押すと、Accountsがページを取得して公開プロフィールURLへのリンクを確認します。確認するのはリンクの存在で、ページの編集権限までは保証しません。",
          "リンクを確認できない場合は、同じ操作でDNS TXTを確認します。`_accounts.{host}`という名前のTXTレコードに、本人の公開プロフィールURLを値として追加してください。",
          "DNS TXTで証明したhostでは、同じhostで登録済みのURLすべてが証明の対象になります。サブドメインはhostごとに証明します。",
          "DNSの変更は反映に時間がかかることがあります。一致しない場合は、時間をおいて再度検証してください。",
        ],
      },
      {
        id: "visibility",
        title: "公開設定",
        paragraphs: [],
        items: [
          "「アカウント連携」画面の表では、外部アカウントを行、一般公開と連携先サービスを列にして、公開する組み合わせをチェックボックスで選びます。",
          "連携先サービスへ提供するには、その列の見出しで提供への同意をONにし、証明済みの外部アカウントを1件以上選びます。同意をOFFにして保存すると、そのサービスへの提供を停止します。",
          "列の見出しの「証明済みを一括選択」と「すべての連携先」の列で、まとめて選択・解除できます。",
          "変更は、表の上と下にある「公開設定を保存」でまとめて反映します。未保存の変更がある間はボタンの横に表示し、「編集内容を破棄」で保存済みの状態に戻せます。",
          "連携先サービスから連携を始めた場合は、同じ表で提供する外部アカウントを選び、「同意して戻る」を押します。この画面は表示から10分で失効します。",
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
        id: "backup",
        title: "バックアップと復元",
        paragraphs: [],
        items: [
          "「設定」画面の「JSONを出力」で、表示名・外部アカウント・公開設定をJSONファイルに保存できます。出力前に、件数と非公開の情報を含むかを確認できます。",
          "同じ画面でJSONファイルを選んで「復元する」を押すと、バックアップ時の設定に戻します。本人に紐付いていない外部アカウントは登録候補として取り込み、所有権を改めて証明すると有効になります。",
        ],
      },
      {
        id: "withdrawal",
        title: "退会",
        paragraphs: [
          "「設定」画面から退会できます。退会は取り消せません。削除する情報はプライバシーポリシーを参照してください。",
        ],
        items: [],
      },
      {
        id: "developer",
        title: "開発者向け",
        paragraphs: [
          "外部サービスの開発者は、「開発者向け」画面で自分のアプリをOAuthクライアントとして登録し、Accounts APIを利用できます。APIの仕様は同じ画面で確認できます。",
        ],
        items: [],
      },
      {
        id: "revoke",
        title: "各サービスでの連携許可の取消",
        paragraphs: [
          "連携解除や退会の後も、Google・GitHub・ORCIDの連携アプリ一覧にAccountsが残ります。各サービスの設定画面から、Accountsのアクセスを取り消せます。",
        ],
        items: [],
        externalLinks: providerRevokePages.map((page) => ({ label: `${page.name}の設定画面`, url: page.url })),
      },
    ] satisfies DocumentSection[],
  },
  en: {
    title: "Help",
    introduction:
      "This page explains how to use Accounts. See the privacy policy for the information we store and how it is shared, and the terms of use for the conditions of use.",
    sections: [
      {
        id: "sign-in",
        title: "Signing in and switching users",
        paragraphs: [],
        items: [
          "Press \"Sign in\" in the header or on the top page and sign in with your Google, GitHub, or ORCID account. If this is your first time, an Accounts user with the display name \"仮ユーザー\" (temporary user) is created. You can change the display name on the Settings page.",
          "If an Accounts user with the same email address already exists, no new user is created and guidance is shown. Sign in with your existing sign-in method and link the external account from the Account links page.",
          "You can sign in to several Accounts users on the same browser. Press the icon at the right of the header to open a menu where you can switch between signed-in users, sign in as another user with \"Add account\", and \"Sign out\". Signing out applies only to the current user; if another user is signed in, Accounts switches to that user.",
          "After you sign in, page URLs start with your Accounts user ID (for example, /ausr_.../settings). If you open a URL for another user, Accounts switches to that user when they are signed in on this browser, and otherwise asks you to sign in.",
          "You can choose Japanese or English as the display language on the Settings page, even without signing in. The choice is saved in this browser.",
        ],
      },
      {
        id: "account-links",
        title: "Adding external accounts",
        paragraphs: [],
        items: [
          "Use \"Link with OAuth\" on the Account links page to add Google, GitHub, or ORCID accounts. You can also sign in with the accounts you add.",
          "For a web page (such as a GitHub profile or a blog), put \"Your public profile URL\" in a link or text on the page, then enter the URL and press \"Save and verify\". Press the public profile URL to open it in a new tab.",
          "\"Save without verifying\" saves the URL as a candidate without proving ownership. You can prove it later by pressing \"Save and verify\" with the same URL.",
          "See \"Tips for each service\" on the Account links page for notes on each service.",
        ],
      },
      {
        id: "url-verification",
        title: "URL verification and DNS TXT",
        paragraphs: [],
        items: [
          "When you press \"Save and verify\", Accounts fetches the page and checks for a link to your public profile URL. This confirms the link exists, not that you can edit the page.",
          "If the link cannot be confirmed, the same operation checks DNS TXT. Add a TXT record named `_accounts.{host}` whose value is your public profile URL.",
          "A host proven by DNS TXT covers every URL you have registered on the same host. Subdomains are proven separately for each host.",
          "DNS changes may take time to propagate. If there is no match, please verify again later.",
        ],
      },
      {
        id: "visibility",
        title: "Sharing settings",
        paragraphs: [],
        items: [
          "The table on the Account links page has your external accounts as rows and public display and each connected service as columns. Select the combinations to share with the checkboxes.",
          "To share with a connected service, turn on consent in its column header and select at least one verified external account. Turning consent off and saving stops sharing with that service.",
          "Use \"Select all verified\" in a column header and the \"All services\" column to select or clear many at once.",
          "Press \"Save sharing settings\" above or below the table to apply your changes. While you have unsaved changes, this is shown next to the buttons, and \"Discard edits\" returns to the saved settings.",
          "When you start connecting from a connected service, select the external accounts to share in the same table and press \"Allow and return\". This page expires 10 minutes after it was opened.",
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
        id: "backup",
        title: "Backup and restore",
        paragraphs: [],
        items: [
          "Use \"Export JSON\" on the Settings page to save your display name, external accounts, and sharing settings as a JSON file. Before exporting, you can check the counts and whether private information is included.",
          "Select the JSON file on the same page and press \"Restore\" to return to the settings at the time of the backup. External accounts no longer linked to you are imported as candidates and become active after you prove ownership again.",
        ],
      },
      {
        id: "withdrawal",
        title: "Deleting your Accounts user",
        paragraphs: [
          "You can delete your Accounts user from the Settings page. This cannot be undone. See the privacy policy for the information that is deleted.",
        ],
        items: [],
      },
      {
        id: "developer",
        title: "For developers",
        paragraphs: [
          "Developers of external services can register their apps as OAuth clients on the Developers page and use the Accounts API. The API reference is on the same page.",
        ],
        items: [],
      },
      {
        id: "revoke",
        title: "Revoking access on each service",
        paragraphs: [
          "Even after you unlink an account or delete your Accounts user, Accounts stays in the connected apps list of Google, GitHub, and ORCID. You can revoke Accounts' access from each service's settings.",
        ],
        items: [],
        externalLinks: providerRevokePages.map((page) => ({ label: `${page.name} settings`, url: page.url })),
      },
    ] satisfies DocumentSection[],
  },
});
