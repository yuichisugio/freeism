import { oauthClientLimitPerUser } from "../../../shared/constants";
import { defineMessages } from "../../lib/i18n/define-messages";
import type { DocumentSection } from "../app-shell/components/document-page";

/**
 * プライバシーポリシー（`/privacy`）の文言。
 * 仕様の「文書化要件」「公開設定」「JSONによるバックアップと移行」「運営者の権限」に基づき、保持する情報・公開先・解除・バックアップ・運営者による確認の扱いを説明する。
 * 操作の手順は使い方（`/help`）で説明する。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export const privacyPolicyMessages = defineMessages({
  ja: {
    title: "プライバシーポリシー",
    introduction:
      "Freeism Accountsが保存する情報と、その一般公開・連携先サービスへの提供・削除の扱いを説明します。",
    sections: [
      {
        id: "retention",
        title: "保存する情報",
        paragraphs: ["Freeism Accountsは、次の情報を保存します。"],
        items: [
          "Freeism Accountsの表示名とFreeism AccountsユーザーID",
          "連携した外部アカウントのサービス名・表示名・固有ID・ユーザー名・URLと連携日時",
          "証明方法（OAuth・双方向リンク・DNS TXT）ごとの検証日時・結果・証拠URL",
          "一般公開と、連携を始めた連携先サービスごとに公開を選んだ外部アカウント",
          "ログインに使ったOAuthのメールアドレス（本人の画面で複数アカウントを見分ける補助と、運営者による不正利用への対応に使い、一般公開・連携先へは提供しません）",
          "外部サービスのOAuthのトークン（暗号化して保存します）",
          "ログイン中のセッションごとのIPアドレスとブラウザーの種類（User-Agent）（不正利用の防止に使います）",
          "ログインなどの要求回数を制限するための、IPアドレスと要求先ごとの回数（制限の期間が過ぎた記録は削除します）",
          "開発者として登録したOAuthクライアントのアプリ名・紹介URL・説明文・リダイレクトURL・公開鍵",
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
          "一般公開: 選んだ外部アカウントを公開プロフィール（/profiles/{Freeism AccountsユーザーID}）に掲載します。URLを知っている人は、ログインせずに閲覧できます。",
          "連携先サービス: 公開を選んだ証明済みの外部アカウントのサービス名・表示名・識別情報・連携日時・検証結果を提供します。連携先はそれらを公開表示し、貢献者の照合に使うことがあります。",
          "連携先サービスの列で証明済みの外部アカウントを1件も選ばずに保存すると、そのサービスへの提供を停止します。提供済みの情報の扱いは、連携先サービスの方針に従います。",
          "未検証の外部アカウントは、公開を選んでいても一般公開・連携先へは提供しません。証明が成立した時点で、選んだ公開先への公開・提供を始めます。",
          "後から追加した外部アカウントは、本人が選ぶまで公開・提供しません。",
        ],
      },
      {
        id: "unlink-and-withdrawal",
        title: "連携解除と退会",
        paragraphs: [],
        items: [
          "「すべての連携解除」では、その外部アカウントの識別子・証明・公開設定を終了し、一般公開と連携先サービスへの提供から外します。",
          "「この証明を解除」では、選んだ検証方法の証明だけを終了します。OAuthの証明を解除すると、そのログイン手段も終了します。双方向リンク・DNS TXTで証明した識別子と公開設定は残ります。",
          "退会すると、プロフィール、外部アカウントの紐付け、公開・提供設定、開発者として登録したOAuthクライアント、セッション・認可・トークンを削除し、一般公開と連携先サービスへの提供を終了します。",
          "連携解除や退会の後も、Google・GitHub・ORCIDの連携アプリ一覧にFreeism Accountsが残ります。取り消す方法は、使い方の「各サービスでの連携許可の取消」を参照してください。",
        ],
      },
      {
        id: "backup",
        title: "バックアップと移行",
        paragraphs: [],
        items: [
          "データ出力のJSONには、表示名、外部アカウントの識別子・表示情報・出力時点の証明状態、一般公開と連携先サービスごとの公開選択を含みます。未検証の登録や非公開の設定も含むため、ファイルの取り扱いに注意してください。",
          "メールアドレス・OAuthのトークン・セッション・暗号鍵・URL検証で取得したページの本文は、データ出力に含みません。",
          "他のサービスへ移行する場合は、移行先で外部アカウントの所有権を改めて証明し、連携先サービスとの連携をやり直します。ログイン手段・セッション・開発者として登録したOAuthクライアントは移行の対象外です。",
        ],
      },
      {
        id: "browser-storage",
        title: "Cookieとブラウザーへの保存",
        paragraphs: [],
        items: [
          "ログインの状態をCookieで保持します。ログインの有効期間は7日を基本とし、利用に応じて延長します。",
          "前回のログイン方法をCookieに、選んだ表示言語とテーマをブラウザーの保存領域に記録します。",
        ],
      },
      {
        id: "external-services",
        title: "外部サービスへの接続",
        paragraphs: [
          "外部アカウントのサービスアイコンを表示するため、閲覧者のブラウザーからGoogleのアイコン配信（www.google.com）へ外部アカウントのホスト名を送ります。公開プロフィールの閲覧でも同じです。また、画面の書体を読み込むため、閲覧者のブラウザーからGoogle Fontsへ接続します。これらの接続では、閲覧者のIPアドレスなどの通信の情報がGoogleに伝わります。",
        ],
        items: [],
      },
      {
        id: "logs",
        title: "ログの扱い",
        paragraphs: [
          "Freeism Accountsが出力するログには、操作の種類・日時・成否・エラーの分類・処理時間など、個人を識別しない項目だけを記録します。表示名・ID・メールアドレス・URL・IPアドレスなどの個人情報や、トークン・Cookieは含めません。",
        ],
        items: [],
      },
      {
        id: "operator",
        title: "運営者による確認と利用の停止",
        paragraphs: [
          "運営者は、不正利用への対応のため、メールアドレスを含むFreeism Accountsユーザーの情報を確認し、利用を停止することがあります。停止中は、公開プロフィールと連携先サービスへの提供も停止します。",
        ],
        items: [],
      },
      {
        id: "changes",
        title: "このポリシーの変更",
        paragraphs: ["このポリシーを変更する場合は、このページで公開します。"],
        items: [],
      },
    ] satisfies DocumentSection[],
  },
  en: {
    title: "Privacy policy",
    introduction:
      "This policy explains the information Freeism Accounts stores, and how it is shown publicly, shared with connected services, and deleted.",
    sections: [
      {
        id: "retention",
        title: "Information we store",
        paragraphs: ["Freeism Accounts stores the following information."],
        items: [
          "Your Freeism Accounts display name and Freeism Accounts user ID",
          "The service name, display name, unique ID, username, URL, and link date of each linked external account",
          "The verification date, result, and evidence URL for each proof method (OAuth, two-way link, DNS TXT)",
          "The external accounts you select for public display and for each connected service you connect",
          "The OAuth email address used to sign in (used to help you tell your accounts apart on your own pages and for the operator's handling of abuse; never shared publicly or with connected services)",
          "OAuth tokens from external services (stored encrypted)",
          "The IP address and browser type (User-Agent) of each signed-in session (used to prevent abuse)",
          "IP addresses and per-endpoint request counts used to limit sign-in and other requests (records are deleted after the limit period ends)",
          "The app name, service URL, description, redirect URLs, and public keys of OAuth clients you register as a developer",
        ],
      },
      {
        id: "not-retained",
        title: "Information we do not store",
        paragraphs: [],
        items: [
          "The content of external pages fetched for URL verification is not stored.",
          "Freeism Accounts does not handle passwords. You sign in with your Google, GitHub, or ORCID account.",
        ],
      },
      {
        id: "publication",
        title: "Public display and sharing with connected services",
        paragraphs: [
          "Public display and each connected service (OAuth client) are configured independently. Both cover only the verified external accounts you select on the Account links page.",
        ],
        items: [
          "Public display: the selected external accounts are listed on your public profile (/profiles/{Freeism Accounts user ID}). Anyone who knows the URL can view it without signing in.",
          "Connected services: the service name, display name, identifiers, link date, and verification results of the verified external accounts you select are shared. The service may display them publicly and use them to match contributors.",
          "If you save a connected service's column with no verified external account selected, sharing with that service stops. Information already shared is handled according to the connected service's own policy.",
          "Unverified external accounts are not shown publicly or shared with connected services, even if selected. Showing and sharing start when ownership is proven.",
          "External accounts you add later are not shared until you select them.",
        ],
      },
      {
        id: "unlink-and-withdrawal",
        title: "Unlinking and deleting your account",
        paragraphs: [],
        items: [
          "\"Unlink all\" ends the identifiers, proofs, and sharing settings of the external account, and removes it from public display and from connected services.",
          "\"Remove this proof\" ends only the proof of the selected verification method. Removing an OAuth proof also ends that sign-in method. Identifiers proven by a two-way link or DNS TXT, and the sharing settings, are kept.",
          "Deleting your account deletes your profile, external account links, sharing settings, OAuth clients you registered as a developer, and your sessions, authorizations, and tokens, and ends public display and sharing with connected services.",
          "Even after you unlink an account or delete your account, Freeism Accounts stays in the connected apps list of Google, GitHub, and ORCID. See \"Revoking access on each service\" in the guide to revoke it.",
        ],
      },
      {
        id: "backup",
        title: "Backup and migration",
        paragraphs: [],
        items: [
          "The data export includes your display name, the identifiers, display information, and proof status at export time of your external accounts, and your selections for public display and each connected service. It also includes unverified entries and private settings, so handle the file with care.",
          "Email addresses, OAuth tokens, sessions, encryption keys, and the content of pages fetched for URL verification are not included in the data export.",
          "When moving to another service, prove ownership of your external accounts again there and reconnect your connected services. Sign-in methods, sessions, and OAuth clients you registered as a developer are not migrated.",
        ],
      },
      {
        id: "browser-storage",
        title: "Cookies and browser storage",
        paragraphs: [],
        items: [
          "Your sign-in is kept in a cookie. A sign-in lasts 7 days by default and is extended while you use Freeism Accounts.",
          "Your last sign-in method is stored in a cookie, and the display language and theme you choose are stored in the browser's storage.",
        ],
      },
      {
        id: "external-services",
        title: "Connections to external services",
        paragraphs: [
          "To show the icons of the services of external accounts, the viewer's browser sends the host names of external accounts to Google's icon service (www.google.com). The same applies when viewing a public profile. To load the fonts used on the pages, the viewer's browser also connects to Google Fonts. Through these connections, communication information such as the viewer's IP address reaches Google.",
        ],
        items: [],
      },
      {
        id: "logs",
        title: "Logs",
        paragraphs: [
          "Logs written by Freeism Accounts record only items that do not identify individuals, such as the operation type, time, outcome, error category, and duration. They do not include personal information such as display names, IDs, email addresses, URLs, and IP addresses, or tokens and cookies.",
        ],
        items: [],
      },
      {
        id: "operator",
        title: "Review and suspension by the operator",
        paragraphs: [
          "To handle abuse, the operator may review Freeism Accounts user information, including email addresses, and suspend use of the Service. While suspended, the public profile and sharing with connected services are also stopped.",
        ],
        items: [],
      },
      {
        id: "changes",
        title: "Changes to this policy",
        paragraphs: ["If we change this policy, we will publish the changes on this page."],
        items: [],
      },
    ] satisfies DocumentSection[],
  },
});

/**
 * 利用規約（`/terms`）の文言。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export const termsOfUseMessages = defineMessages({
  ja: {
    title: "利用規約",
    introduction:
      "この規約は、Freeism Accounts（以下「本サービス」）の利用条件を定めます。本サービスを利用した時点で、この規約に同意したものとします。",
    sections: [
      {
        id: "service",
        title: "本サービスの内容",
        paragraphs: [
          "本サービスは、外部アカウントやWebページの所有権を証明し、一般公開と連携先サービスごとに提供する情報を利用者が選べるようにするものです。",
        ],
        items: [],
      },
      {
        id: "account",
        title: "Freeism Accountsユーザー",
        paragraphs: [],
        items: [
          "Google・GitHub・ORCIDのアカウントでログインして利用します。ログインに使う外部アカウントは、利用者が自身の責任で管理してください。",
          "Freeism Accountsユーザーは個人として利用するものとします。",
        ],
      },
      {
        id: "ownership",
        title: "登録する外部アカウントとURL",
        paragraphs: [],
        items: [
          "利用者本人が所有・管理する外部アカウントとWebページだけを登録してください。",
          "双方向リンクによる証明はページにリンクがあることを確認するもので、ページの編集権限までは保証しません。",
        ],
      },
      {
        id: "sharing",
        title: "公開と連携先サービス",
        paragraphs: [],
        items: [
          "一般公開と連携先サービスへの提供は、利用者が選んだ範囲で行います。",
          "連携先サービスへ提供した情報の扱いは、そのサービスの規約・方針に従います。",
        ],
      },
      {
        id: "developer",
        title: "開発者の責任",
        paragraphs: [],
        items: [
          "OAuthクライアントを登録した開発者は、対応する秘密鍵を自身のバックエンドで安全に管理してください。",
          "提供を受けた情報は、利用者が同意した目的（公開表示と貢献者の照合）の範囲で扱ってください。",
          `1人の利用者が登録できるOAuthクライアントは${oauthClientLimitPerUser}件までです。`,
        ],
      },
      {
        id: "prohibited",
        title: "禁止事項",
        paragraphs: ["利用者は、次の行為を行わないものとします。"],
        items: [
          "他人になりすます行為や、他人の外部アカウント・Webページを登録する行為",
          "本サービス、ほかの利用者、外部サービスに過度な負荷をかける行為や、不正にアクセスする行為",
          "法令または公序良俗に反する行為",
        ],
      },
      {
        id: "suspension",
        title: "利用の停止",
        paragraphs: [
          "利用者がこの規約に違反した場合、運営者は利用を停止することがあります。利用を停止した利用者が登録したOAuthクライアントも無効になります。",
        ],
        items: [],
      },
      {
        id: "withdrawal",
        title: "退会",
        paragraphs: ["利用者は、「その他」画面からいつでも退会できます。"],
        items: [],
      },
      {
        id: "disclaimer",
        title: "免責",
        paragraphs: [
          "本サービスは現状のまま提供し、特定の目的への適合、証明結果の正確性、継続的な提供を保証しません。運営者は、本サービスの内容を変更し、または提供を終了することがあります。",
        ],
        items: [],
      },
      {
        id: "changes",
        title: "規約の変更",
        paragraphs: [
          "この規約を変更する場合は、このページで公開します。変更後に本サービスを利用した時点で、変更後の規約に同意したものとします。",
        ],
        items: [],
      },
    ] satisfies DocumentSection[],
  },
  en: {
    title: "Terms of use",
    introduction:
      "These terms set out the conditions for using Freeism Accounts (the \"Service\"). By using the Service, you agree to these terms.",
    sections: [
      {
        id: "service",
        title: "The Service",
        paragraphs: [
          "The Service lets you prove ownership of external accounts and web pages, and choose what information is shown publicly and shared with each connected service.",
        ],
        items: [],
      },
      {
        id: "account",
        title: "Freeism Accounts users",
        paragraphs: [],
        items: [
          "You sign in with a Google, GitHub, or ORCID account. You are responsible for managing the external accounts you use to sign in.",
          "A Freeism Accounts user is for use by an individual.",
        ],
      },
      {
        id: "ownership",
        title: "External accounts and URLs you register",
        paragraphs: [],
        items: [
          "Register only external accounts and web pages that you own or manage.",
          "Two-way link verification confirms that a link exists on the page, not that you can edit the page.",
        ],
      },
      {
        id: "sharing",
        title: "Public display and connected services",
        paragraphs: [],
        items: [
          "Public display and sharing with connected services cover only what you select.",
          "Information shared with a connected service is handled according to that service's own terms and policies.",
        ],
      },
      {
        id: "developer",
        title: "Developer responsibilities",
        paragraphs: [],
        items: [
          "Developers who register an OAuth client must keep the corresponding private key secure in their own backend.",
          "Use the information you receive only for the purposes users consented to (public display and matching contributors).",
          `Each user can register up to ${oauthClientLimitPerUser} OAuth clients.`,
        ],
      },
      {
        id: "prohibited",
        title: "Prohibited conduct",
        paragraphs: ["You must not do any of the following."],
        items: [
          "Impersonating others, or registering external accounts or web pages that belong to others",
          "Placing excessive load on, or gaining unauthorized access to, the Service, other users, or external services",
          "Violating laws or public order and morals",
        ],
      },
      {
        id: "suspension",
        title: "Suspension",
        paragraphs: [
          "If you violate these terms, the operator may suspend your use of the Service. OAuth clients registered by a suspended user are also disabled.",
        ],
        items: [],
      },
      {
        id: "withdrawal",
        title: "Deleting your account",
        paragraphs: ["You can delete your account from the Other page at any time."],
        items: [],
      },
      {
        id: "disclaimer",
        title: "Disclaimer",
        paragraphs: [
          "The Service is provided as is, without any guarantee of fitness for a particular purpose, accuracy of verification results, or continued availability. The operator may change or discontinue the Service.",
        ],
        items: [],
      },
      {
        id: "changes",
        title: "Changes to these terms",
        paragraphs: [
          "If we change these terms, we will publish the changes on this page. By using the Service after the change, you agree to the updated terms.",
        ],
        items: [],
      },
    ] satisfies DocumentSection[],
  },
});
