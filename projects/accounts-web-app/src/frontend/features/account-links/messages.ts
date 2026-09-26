import type { VerificationFailureCode, VerificationMethod, VerificationResult } from "../../../shared/schemas/verification-schema";
import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * 「アカウント連携」画面の文言。
 * `failure_code`・エラーコードから次の操作の案内を導く対応表もここに置く。
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 */
export const accountLinksMessages = defineMessages({
  ja: {
    title: "アカウント連携",
    helpLink: "使い方（ヘルプ）",
    // --------------------------------------------------
    // 公開プロフィールURL
    // --------------------------------------------------
    profileUrlLabel: "あなたの公開プロフィールURL",
    // --------------------------------------------------
    // URLの登録・検証
    // --------------------------------------------------
    urlFormTitle: "外部URLの追加・検証",
    urlLabel: "外部ページのURL",
    urlPlaceholder: "https://github.com/your-name",
    verifyUrl: "保存して検証する",
    saveUnverifiedUrl: "未検証で保存",
    verifying: "検証中…",
    urlRequired: "URLを入力してください。",
    urlTooLong: "URLが長すぎます。",
    urlCount: (count: number, limit: number) => `登録済みのURL: ${count} / ${limit}件`,
    urlLimitReached: "登録できるURLの上限に達しています。不要なURLを連携解除してから追加してください。",
    urlInputErrors: {
      INVALID_URL: "URLの形式が正しくありません。`https://`から始まる完全なURLを入力してください。",
      UNSUPPORTED_SCHEME: "HTTPSのURLだけを登録できます。",
      TRAILING_DOT_HOST: "ホスト名の末尾のドットを除いて入力してください。",
      PORT_NOT_ALLOWED: "ポート番号を指定したURLは登録できません。",
      USERINFO_NOT_ALLOWED: "ユーザー名やパスワードを含むURLは登録できません。",
      HOST_NOT_ALLOWED: "IPアドレスやローカル・内部向けのホスト名のURLは登録できません。",
      VALUE_TOO_LONG: "URLが長すぎます（2,048 bytesまで）。",
    } as Partial<Record<string, string>>,
    unverifiedSaved: "URLを未検証で保存しました。",
    unverifiedAlreadyRegistered: "このURLは登録済みです。既存の登録と証明は変更していません。",
    verifySucceeded: "所有権を証明しました。",
    verifyFailed: "証明は成立しませんでした。URLは未検証の登録のままです。",
    verifyFailedNotSaved:
      "証明が成立しなかったため、URLは保存していません。未検証のまま登録する場合は「未検証で保存」を押してください。",
    reverifyFailedKeptExisting: "今回の確認では証明が成立しませんでしたが、以前に成立した証明は引き続き有効です。",
    linkAttempt: "公開ページのリンク確認",
    dnsAttempt: "DNS TXT",
    evidenceUrl: "証拠を確認したページ",
    // --------------------------------------------------
    // 一覧表
    // --------------------------------------------------
    tableCaption: "外部アカウントと公開先",
    accountColumn: "外部アカウント",
    publicColumn: "一般公開",
    bulkRow: "すべての連携先",
    bulkRowLabel: (account: string) => `${account}をすべての連携先に公開`,
    bulkColumnLabel: (client: string) => `証明済みを一括選択（${client}）`,
    bulkColumnHint: "証明済みを一括選択",
    publicCellLabel: (account: string) => `${account}を一般公開`,
    clientCellLabel: (account: string, client: string) => `${account}を${client}に公開`,
    consentLabel: (client: string) => `${client}への提供に同意する`,
    lacksVerifiedSelection: (client: string) =>
      `${client}: 同意をONにした連携先には、証明済みの外部アカウントを1件以上選択してください。`,
    saveVisibility: "公開設定を保存",
    discardVisibility: "編集内容を破棄",
    unsavedChanges: "未保存の変更があります",
    saveBlocked: "条件を満たさない連携先があるため保存できません。",
    visibilitySaved: "公開設定を保存しました。",
    noAccounts: "連携済みの外部アカウントはありません。OAuthの追加連携またはURLの追加から始めてください。",
    noClients: "情報提供先の連携サービスはまだありません。",
    clientLink: "紹介ページ",
    // --------------------------------------------------
    // 外部アカウントの行
    // --------------------------------------------------
    statusVerified: "証明済み",
    statusUnverified: "未検証（登録候補）",
    importedCandidate: "バックアップから取り込んだ登録候補です。所有権を改めて証明すると有効になります。",
    linkedAt: "連携日時",
    email: "メールアドレス",
    identifiers: "識別子",
    candidateIdentifier: "候補",
    identifierTypes: { url: "URL", provider_account: "固有ID", provider_username: "ユーザー名" } as Record<
      "url" | "provider_account" | "provider_username",
      string
    >,
    verifiedAt: "証明日時",
    checkedAt: "直近の検証",
    noVerification: "証明の記録はありません。",
    unlinkAccount: "連携解除",
    unlinkOAuthOnly: "OAuthの認証連携だけ解除する",
    // --------------------------------------------------
    // 解除
    // --------------------------------------------------
    unlinkAccountTitle: "外部アカウントの連携を解除しますか？",
    unlinkAccountDescription: (account: string) =>
      `${account}の識別子・証明方法・公開設定をすべて終了します。OAuthのログイン手段を含む場合は、その認証連携も解除します。`,
    unlinkOAuthTitle: "OAuthの認証連携だけ解除しますか？",
    unlinkOAuthDescription: (account: string) =>
      `${account}のOAuthによる証明とログイン手段を終了します。公開ページのリンク・DNS TXTで証明した識別子と、外部アカウントの行・公開設定は残ります。`,
    unlinkConfirm: "解除する",
    unlinked: "連携を解除しました。",
    // --------------------------------------------------
    // OAuthの追加連携
    // --------------------------------------------------
    addProviderTitle: "OAuthで追加連携",
    addProvider: (provider: string) => `${provider}を連携`,
    // --------------------------------------------------
    // ヒント
    // --------------------------------------------------
    hintsOpen: "サービス別のヒント",
    hintsTitle: "サービス別のヒント",
    hints: [
      "X: ウェブサイト欄のリンクは短縮URLになるため、自己紹介文などに`https://`から始まる完全な公開プロフィールURLを書いてください。",
      "Mastodon: Accountsで外部URLを一般公開した後に、Mastodonのプロフィールを再保存すると認証済みリンクになります。",
      "GitHub・Codeberg・Hugging Faceなどの組織アカウント: 最後に所有権を証明した個人のAccountsユーザーに紐付きます。",
      "DNS TXT: レコードの追加後、反映やキャッシュの更新に時間がかかることがあります。時間をおいて再検証してください。",
      "GitHubなどのプロフィールURLで証明すると、そのアカウントのユーザー名とプロフィールURLにも証明が適用されます。記事などのコンテンツURLは入力したURLだけが対象です。",
    ],
    // --------------------------------------------------
    // 同意画面
    // --------------------------------------------------
    consentTitle: (client: string) => `${client}が情報の提供を求めています`,
    consentRedirectHost: "戻り先",
    consentServiceUrl: "紹介ページ",
    consentPurpose:
      "同意すると、下の表で選択した外部アカウントのサービス名・表示名・識別子・連携日時・証明方法ごとの検証結果を、この連携先へ提供します。連携先はそれらを公開表示し、貢献者の照合に使うことがあります。同意と選択は後からこの画面で変更できます。",
    consentActiveUser: "連携するAccountsユーザー",
    consentExpiryNotice: "この画面は表示から10分で失効します。",
    consentExpired: "連携の要求の有効期限が切れました。元のサービスから連携を最初からやり直してください。",
    consentFailed: "連携の要求を処理できませんでした。期限切れの可能性があるため、元のサービスから連携を最初からやり直してください。",
    consentClientMissing: "連携先のサービスが見つかりません。元のサービスから連携を最初からやり直してください。",
    consentAccept: "同意して戻る",
    consentDeny: "同意しない",
    consentAcceptBlocked: "同意するには、証明済みの外部アカウントを1件以上選択してください。",
    // --------------------------------------------------
    // 結果・エラー
    // --------------------------------------------------
    methods: {
      oauth: "OAuth",
      bidirectional_link: "公開ページのリンク確認",
      dns_txt: "DNS TXT",
    } satisfies Record<VerificationMethod, string>,
    results: {
      verified: "成功",
      not_verified: "証拠を確認できませんでした",
      indeterminate: "判断できませんでした",
    } satisfies Record<VerificationResult, string>,
    failureGuidance: {
      LINK_NOT_FOUND: "ページに公開プロフィールURLが見つかりませんでした。URL全体を載せて公開してから再検証してください。",
      PAGE_NOT_FOUND: "ページが見つかりませんでした（404・410）。URLを確認してください。",
      REDIRECT_TARGET_BLOCKED: "転送先が取得できない宛先でした。転送されない公開ページのURLを入力してください。",
      TOO_MANY_REDIRECTS: "転送が多すぎるため確認できませんでした。最終的なページのURLを入力してください。",
      ACCESS_RESTRICTED: "ページへのアクセスが制限されていました。ログインなしで閲覧できる公開ページか確認してください。",
      HTTP_ERROR: "ページの取得に失敗しました。時間をおいて再検証してください。",
      FETCH_TIMEOUT: "ページの取得が時間内に終わりませんでした。時間をおいて再検証してください。",
      NETWORK_ERROR: "ページに接続できませんでした。時間をおいて再検証してください。",
      RESPONSE_TOO_LARGE: "ページが大きすぎるため確認できませんでした（1MiBまで）。",
      UNSUPPORTED_CONTENT_TYPE: "HTMLまたはテキストのページだけを確認できます。",
      HELD_BY_STRONGER_PROOF:
        "この識別子はOAuthまたはDNS TXTで証明済みの別のユーザーに紐付いているため、リンク確認では移動しません。OAuthまたはDNS TXTで証明してください。",
      TXT_NOT_FOUND:
        "`_accounts.{ホスト名}`に公開プロフィールURLのTXTレコードが見つかりませんでした。追加直後は反映に時間がかかるため、時間をおいて再検証してください。",
      DNS_TIMEOUT: "DNSの照会が時間内に終わりませんでした。時間をおいて再検証してください。",
      DNS_LOOKUP_FAILED: "DNSの照会に失敗しました。時間をおいて再検証してください。",
      MULTIPLE_ACCOUNTS_PROFILES:
        "別のAccountsユーザーの公開プロフィールURLも見つかりました。証拠のページのURLを整理してから再検証してください。",
    } satisfies Record<VerificationFailureCode, string>,
    errorCodes: {
      URL_LIMIT_REACHED: "登録できるURLの上限（150件）に達しています。不要なURLを連携解除してから追加してください。",
      RATE_LIMITED: "検証の要求が短時間に集中しました。しばらく待ってから再度お試しください。",
      OWNERSHIP_CONFLICT: "同じ外部アカウントへの操作が競合しました。もう一度お試しください。",
      CONSENT_REQUIRES_VERIFIED_ACCOUNT:
        "同意をONにした連携先には、証明済みの外部アカウントを1件以上選択してください。",
      LAST_LOGIN_METHOD:
        "最後のログイン手段は解除できません。別のGoogle・GitHub・ORCIDアカウントを追加連携してから解除してください。",
    } as Partial<Record<string, string>>,
    oauthErrors: {
      account_already_linked_to_different_user:
        "この外部アカウントは別のAccountsユーザーに連携済みです。元のAccountsユーザーで連携を解除してから、もう一度連携してください。元のユーザーのログイン手段がこのアカウントだけの場合は、別のログイン手段を追加してから解除するか、元のユーザーを退会してください。",
    } as Partial<Record<string, string>>,
    oauthErrorFallback: "外部アカウントを連携できませんでした。もう一度お試しください。",
  },
  en: {
    title: "Account links",
    helpLink: "How to use (Help)",
    profileUrlLabel: "Your public profile URL",
    urlFormTitle: "Add and verify an external URL",
    urlLabel: "External page URL",
    urlPlaceholder: "https://github.com/your-name",
    verifyUrl: "Save and verify",
    saveUnverifiedUrl: "Save without verifying",
    verifying: "Verifying…",
    urlRequired: "Enter a URL.",
    urlTooLong: "The URL is too long.",
    urlCount: (count: number, limit: number) => `Registered URLs: ${count} / ${limit}`,
    urlLimitReached: "You have reached the URL limit. Unlink URLs you no longer need before adding more.",
    urlInputErrors: {
      INVALID_URL: "The URL is not valid. Enter a full URL starting with `https://`.",
      UNSUPPORTED_SCHEME: "Only HTTPS URLs can be registered.",
      TRAILING_DOT_HOST: "Remove the trailing dot from the host name.",
      PORT_NOT_ALLOWED: "URLs with a port number cannot be registered.",
      USERINFO_NOT_ALLOWED: "URLs containing a user name or password cannot be registered.",
      HOST_NOT_ALLOWED: "URLs with an IP address or a local or internal host name cannot be registered.",
      VALUE_TOO_LONG: "The URL is too long (up to 2,048 bytes).",
    } as Partial<Record<string, string>>,
    unverifiedSaved: "The URL was saved as unverified.",
    unverifiedAlreadyRegistered: "This URL is already registered. Existing registrations and proofs were not changed.",
    verifySucceeded: "Ownership was verified.",
    verifyFailed: "Verification did not succeed. The URL remains registered as unverified.",
    verifyFailedNotSaved:
      "Verification did not succeed, so the URL was not saved. To register it without verification, press “Save without verifying”.",
    reverifyFailedKeptExisting: "This check did not verify ownership, but the previously verified proof remains valid.",
    linkAttempt: "Public page link",
    dnsAttempt: "DNS TXT",
    evidenceUrl: "Page where the evidence was found",
    tableCaption: "External accounts and where they are shared",
    accountColumn: "External account",
    publicColumn: "Public",
    bulkRow: "All services",
    bulkRowLabel: (account: string) => `Share ${account} with all connected services`,
    bulkColumnLabel: (client: string) => `Select all verified (${client})`,
    bulkColumnHint: "Select all verified",
    publicCellLabel: (account: string) => `Make ${account} public`,
    clientCellLabel: (account: string, client: string) => `Share ${account} with ${client}`,
    consentLabel: (client: string) => `Allow sharing with ${client}`,
    lacksVerifiedSelection: (client: string) =>
      `${client}: select at least one verified external account for a service you allow sharing with.`,
    saveVisibility: "Save sharing settings",
    discardVisibility: "Discard edits",
    unsavedChanges: "You have unsaved changes",
    saveBlocked: "Some services do not meet the conditions, so the settings cannot be saved.",
    visibilitySaved: "Sharing settings were saved.",
    noAccounts: "No external accounts are linked yet. Start by linking with OAuth or adding a URL.",
    noClients: "There are no connected services to share with yet.",
    clientLink: "Service page",
    statusVerified: "Verified",
    statusUnverified: "Unverified (candidate)",
    importedCandidate: "Imported from a backup as a candidate. It becomes active after you prove ownership again.",
    linkedAt: "Linked at",
    email: "Email",
    identifiers: "Identifiers",
    candidateIdentifier: "candidate",
    identifierTypes: { url: "URL", provider_account: "Account ID", provider_username: "User name" } as Record<
      "url" | "provider_account" | "provider_username",
      string
    >,
    verifiedAt: "Verified at",
    checkedAt: "Last checked",
    noVerification: "No proof has been recorded.",
    unlinkAccount: "Unlink",
    unlinkOAuthOnly: "Unlink only the OAuth connection",
    unlinkAccountTitle: "Unlink this external account?",
    unlinkAccountDescription: (account: string) =>
      `All identifiers, proofs and sharing settings of ${account} will end. If it includes an OAuth sign-in method, that connection is also removed.`,
    unlinkOAuthTitle: "Unlink only the OAuth connection?",
    unlinkOAuthDescription: (account: string) =>
      `The OAuth proof and sign-in method of ${account} will end. Identifiers proven by a public page link or DNS TXT, the account row and its sharing settings are kept.`,
    unlinkConfirm: "Unlink",
    unlinked: "The link was removed.",
    addProviderTitle: "Link with OAuth",
    addProvider: (provider: string) => `Link ${provider}`,
    hintsOpen: "Tips for each service",
    hintsTitle: "Tips for each service",
    hints: [
      "X: links in the website field are shortened, so write your full public profile URL starting with `https://` in your bio.",
      "Mastodon: after making the external URL public in Accounts, save your Mastodon profile again to get a verified link.",
      "Organization accounts on GitHub, Codeberg, Hugging Face and others are linked to the person who proved ownership most recently.",
      "DNS TXT: a new record can take time to propagate and caches to expire. Verify again later.",
      "Proving with a profile URL such as GitHub also applies the proof to that account's user name and profile URL. Content URLs such as articles cover only the URL you entered.",
    ],
    consentTitle: (client: string) => `${client} is requesting access to your information`,
    consentRedirectHost: "Return to",
    consentServiceUrl: "Service page",
    consentPurpose:
      "If you allow it, the service name, display name, identifiers, link date and per-method verification results of the external accounts selected below are provided to this service. The service may display them publicly and use them to match contributors. You can change your consent and selection on this page later.",
    consentActiveUser: "Accounts user to connect",
    consentExpiryNotice: "This page expires 10 minutes after it was opened.",
    consentExpired: "The request has expired. Please start the connection again from the original service.",
    consentFailed: "The request could not be processed. It may have expired, so please start the connection again from the original service.",
    consentClientMissing: "The requesting service was not found. Please start the connection again from the original service.",
    consentAccept: "Allow and return",
    consentDeny: "Deny",
    consentAcceptBlocked: "Select at least one verified external account to allow sharing.",
    methods: {
      oauth: "OAuth",
      bidirectional_link: "Public page link",
      dns_txt: "DNS TXT",
    } satisfies Record<VerificationMethod, string>,
    results: {
      verified: "Verified",
      not_verified: "Evidence not found",
      indeterminate: "Could not be determined",
    } satisfies Record<VerificationResult, string>,
    failureGuidance: {
      LINK_NOT_FOUND: "Your public profile URL was not found on the page. Publish the full URL and verify again.",
      PAGE_NOT_FOUND: "The page was not found (404 or 410). Check the URL.",
      REDIRECT_TARGET_BLOCKED: "The page redirected to a destination that cannot be fetched. Enter the URL of a public page that does not redirect.",
      TOO_MANY_REDIRECTS: "The page redirected too many times. Enter the URL of the final page.",
      ACCESS_RESTRICTED: "Access to the page was restricted. Check that the page is public and viewable without signing in.",
      HTTP_ERROR: "The page could not be fetched. Verify again later.",
      FETCH_TIMEOUT: "Fetching the page took too long. Verify again later.",
      NETWORK_ERROR: "The page could not be reached. Verify again later.",
      RESPONSE_TOO_LARGE: "The page is too large to check (up to 1 MiB).",
      UNSUPPORTED_CONTENT_TYPE: "Only HTML or plain text pages can be checked.",
      HELD_BY_STRONGER_PROOF:
        "This identifier belongs to another user who proved it with OAuth or DNS TXT, so a page link cannot move it. Prove it with OAuth or DNS TXT.",
      TXT_NOT_FOUND:
        "No TXT record with your public profile URL was found at `_accounts.{host}`. New records can take time to propagate, so verify again later.",
      DNS_TIMEOUT: "The DNS lookup took too long. Verify again later.",
      DNS_LOOKUP_FAILED: "The DNS lookup failed. Verify again later.",
      MULTIPLE_ACCOUNTS_PROFILES:
        "Public profile URLs of other Accounts users were also found. Clean up the URLs on the evidence page and verify again.",
    } satisfies Record<VerificationFailureCode, string>,
    errorCodes: {
      URL_LIMIT_REACHED: "You have reached the limit of 150 URLs. Unlink URLs you no longer need before adding more.",
      RATE_LIMITED: "Too many verification requests in a short time. Please wait a moment and try again.",
      OWNERSHIP_CONFLICT: "Another operation on the same external account conflicted. Please try again.",
      CONSENT_REQUIRES_VERIFIED_ACCOUNT:
        "Select at least one verified external account for each service you allow sharing with.",
      LAST_LOGIN_METHOD:
        "You cannot unlink your last sign-in method. Link another Google, GitHub or ORCID account first.",
    } as Partial<Record<string, string>>,
    oauthErrors: {
      account_already_linked_to_different_user:
        "This external account is already linked to another Accounts user. Unlink it from that user first, then link it again. If it is that user's only sign-in method, add another sign-in method before unlinking, or delete that user.",
    } as Partial<Record<string, string>>,
    oauthErrorFallback: "The external account could not be linked. Please try again.",
  },
});
