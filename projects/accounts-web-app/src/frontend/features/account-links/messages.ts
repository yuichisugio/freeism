import type { VerificationFailureCode, VerificationMethod, VerificationResult } from "../../../shared/schemas/verification-schema";
import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * 「アカウント連携」画面の文言。
 * `failure_code`・エラーコードから次の操作の案内を導く対応表もここに置く。
 * @see ../../../../docs/specification/v0.1/design-system.ja.md
 * @see ../../../../docs/specification/v0.1/verify-url.ja.md
 */
export const accountLinksMessages = defineMessages({
  ja: {
    title: "アカウント連携",
    helpLink: "使い方",
    // --------------------------------------------------
    // 公開プロフィールURL
    // --------------------------------------------------
    profileUrlTitle: "公開プロフィールURL",
    opensInNewTab: "（新しいタブで開く）",
    // --------------------------------------------------
    // URLで証明
    // --------------------------------------------------
    urlProofTitle: "URLで証明",
    urlProofSteps: [
      { before: "証明したいサービスのページに、上の", strong: "「公開プロフィールURL」", after: "を記載する。" },
      { before: "", strong: "「その証明したいサービスのURL」", after: "を下に入力する。" },
      { before: "「検証する」を押す。", strong: "", after: "" },
    ],
    urlLabel: "外部ページのURL",
    urlPlaceholder: "https://github.com/your-name",
    verifyUrl: "検証する",
    saveUnverifiedUrl: "未検証で保存",
    verifying: "検証中…",
    troubleLink: "困った場合はこちら",
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
    // --------------------------------------------------
    // ログインで証明
    // --------------------------------------------------
    oauthProofTitle: "ログインで証明",
    oauthProofDescription: "各サービスにログインすると、そのアカウントを証明済みとして追加します。",
    addProvider: (provider: string) => `${provider}を連携`,
    // --------------------------------------------------
    // 公開設定の表
    // --------------------------------------------------
    visibilityTitle: "公開設定",
    tableCaption: "外部アカウントと公開先",
    accountColumn: "外部アカウント",
    profileColumn: "プロフィール",
    published: "公開中",
    unpublished: "非公開",
    bulkShort: "一括",
    bulkAllLabel: "すべての行をすべての公開先に一括で公開",
    bulkColumnLabel: (destination: string) => `すべての行を一括で${destination}に公開`,
    rowLabel: (account: string) => `${account}をすべての公開先に公開`,
    cellLabel: (account: string, destination: string) => `${account}を${destination}に公開`,
    accountLabelSeparator: "：",
    statusUnverified: "未検証",
    details: "詳細",
    saveVisibility: "公開設定を保存",
    visibilitySaved: "公開設定を保存しました。",
    noAccounts: "連携済みの外部アカウントはありません。「URLで証明」または「ログインで証明」から追加してください。",
    unpublishedProfile: "プロフィール：公開する外部アカウントが選択されていないため、公開プロフィールは表示されません。",
    unpublishedClient: (client: string) =>
      `${client}：公開する外部アカウントが選択されていないため、${client} に情報を提供しません。`,
    // --------------------------------------------------
    // 行の詳細
    // --------------------------------------------------
    verificationGroupLabel: (method: string) => `${method}の証明`,
    verifiedAt: "証明日時",
    evidenceLabels: {
      oauth: "証拠",
      bidirectional_link: "証拠を確認したページ",
      dns_txt: "TXTレコード名",
    } satisfies Record<VerificationMethod, string>,
    oauthEvidence: (service: string) => `${service} のログイン`,
    identifier: "識別子",
    identifierTypes: { url: "URL", provider_account: "固有ID", provider_username: "ユーザー名" } as Record<
      "url" | "provider_account" | "provider_username",
      string
    >,
    unlinkVerification: "この証明を解除",
    unlinkAccount: "すべての連携解除",
    latestAttempt: (checkedAt: string, result: string) => `直近の検証 ${checkedAt}：${result}`,
    neverChecked: "まだ検証していません。",
    reverify: "再検証",
    reverifying: "検証中…",
    noUrlGuidance: "URLの無い外部アカウントは、上の「ログインで証明」から同じアカウントでログインし直すと証明できます。",
    importedCandidate: "バックアップから取り込んだ登録候補です。所有権を改めて証明すると有効になります。",
    // --------------------------------------------------
    // 解除
    // --------------------------------------------------
    unlinkAccountTitle: "外部アカウントの連携を解除しますか？",
    unlinkAccountDescription: (account: string) =>
      `${account}の識別子・証明方法・公開設定をすべて終了します。OAuthのログイン手段を含む場合は、その認証連携も解除します。`,
    unlinkVerificationTitle: "この証明を解除しますか？",
    unlinkOAuthDescription: (account: string) => `${account}のOAuthによる証明とログイン手段を終了します。`,
    unlinkProofDescription: (account: string, method: string) => `${account}の「${method}」による証明を終了します。`,
    unlinkOAuthKeeps: "双方向リンク・DNS TXTで証明した識別子と、外部アカウントの行・公開設定は残ります。",
    unlinkProofKeeps: "ほかの証明が残るため、証明済みのままです。",
    unlinkLastProof: "行と公開設定は残り、未検証になります。",
    unlinkDnsScope: "この行の DNS TXT の証明だけを解除します。同じホストの他の行の証明は残ります。",
    unlinkConfirm: "解除する",
    accountUnlinked: "連携を解除しました。",
    verificationUnlinked: "証明を解除しました。",
    // --------------------------------------------------
    // 結果・エラー
    // --------------------------------------------------
    methods: {
      oauth: "OAuth",
      bidirectional_link: "双方向リンク",
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
        "別のFreeism Accountsユーザーの公開プロフィールURLも見つかりました。証拠のページのURLを整理してから再検証してください。",
    } satisfies Record<VerificationFailureCode, string>,
    errorCodes: {
      URL_LIMIT_REACHED: "登録できるURLの上限（150件）に達しています。不要なURLを連携解除してから追加してください。",
      RATE_LIMITED: "検証の要求が短時間に集中しました。しばらく待ってから再度お試しください。",
      OWNERSHIP_CONFLICT: "同じ外部アカウントへの操作が競合しました。もう一度お試しください。",
      LAST_LOGIN_METHOD:
        "最後のログイン手段は解除できません。別のGoogle・GitHub・ORCIDアカウントを追加連携してから解除してください。",
    } as Partial<Record<string, string>>,
    oauthErrors: {
      account_already_linked_to_different_user:
        "この外部アカウントは別のFreeism Accountsユーザーに連携済みです。元のFreeism Accountsユーザーで連携を解除してから、もう一度連携してください。元のユーザーのログイン手段がこのアカウントだけの場合は、別のログイン手段を追加してから解除するか、元のユーザーを退会してください。",
    } as Partial<Record<string, string>>,
    oauthErrorFallback: "外部アカウントを連携できませんでした。もう一度お試しください。",
  },
  en: {
    title: "Account links",
    helpLink: "Guide",
    profileUrlTitle: "Public profile URL",
    opensInNewTab: " (opens in a new tab)",
    urlProofTitle: "Prove with a URL",
    urlProofSteps: [
      { before: "On the page of the service you want to prove, add the ", strong: "“Public profile URL”", after: " above." },
      { before: "Enter ", strong: "“the URL of that service”", after: " below." },
      { before: "Press “Verify”.", strong: "", after: "" },
    ],
    urlLabel: "External page URL",
    urlPlaceholder: "https://github.com/your-name",
    verifyUrl: "Verify",
    saveUnverifiedUrl: "Save without verifying",
    verifying: "Verifying…",
    troubleLink: "Having trouble?",
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
    oauthProofTitle: "Prove by signing in",
    oauthProofDescription: "Sign in to a service to add that account as verified.",
    addProvider: (provider: string) => `Link ${provider}`,
    visibilityTitle: "Sharing settings",
    tableCaption: "External accounts and where they are shared",
    accountColumn: "External account",
    profileColumn: "Profile",
    published: "Shared",
    unpublished: "Not shared",
    bulkShort: "All",
    bulkAllLabel: "Share all rows with all destinations",
    bulkColumnLabel: (destination: string) => `Share all rows with ${destination}`,
    rowLabel: (account: string) => `Share ${account} with all destinations`,
    cellLabel: (account: string, destination: string) => `Share ${account} with ${destination}`,
    accountLabelSeparator: ": ",
    statusUnverified: "Unverified",
    details: "Details",
    saveVisibility: "Save sharing settings",
    visibilitySaved: "Sharing settings were saved.",
    noAccounts: "No external accounts are linked yet. Add one with “Prove with a URL” or “Prove by signing in”.",
    unpublishedProfile: "Profile: no external account is selected, so your public profile is not shown.",
    unpublishedClient: (client: string) =>
      `${client}: no external account is selected, so no information is provided to ${client}.`,
    verificationGroupLabel: (method: string) => `${method} proof`,
    verifiedAt: "Verified at",
    evidenceLabels: {
      oauth: "Evidence",
      bidirectional_link: "Page where the evidence was found",
      dns_txt: "TXT record name",
    } satisfies Record<VerificationMethod, string>,
    oauthEvidence: (service: string) => `Sign-in with ${service}`,
    identifier: "Identifier",
    identifierTypes: { url: "URL", provider_account: "Account ID", provider_username: "User name" } as Record<
      "url" | "provider_account" | "provider_username",
      string
    >,
    unlinkVerification: "Remove this proof",
    unlinkAccount: "Unlink everything",
    latestAttempt: (checkedAt: string, result: string) => `Last checked ${checkedAt}: ${result}`,
    neverChecked: "Not verified yet.",
    reverify: "Verify again",
    reverifying: "Verifying…",
    noUrlGuidance: "An external account without a URL can be proved by signing in with the same account again from “Prove by signing in” above.",
    importedCandidate: "Imported from a backup as a candidate. It becomes active after you prove ownership again.",
    unlinkAccountTitle: "Unlink this external account?",
    unlinkAccountDescription: (account: string) =>
      `All identifiers, proofs and sharing settings of ${account} will end. If it includes an OAuth sign-in method, that connection is also removed.`,
    unlinkVerificationTitle: "Remove this proof?",
    unlinkOAuthDescription: (account: string) => `The OAuth proof and sign-in method of ${account} will end.`,
    unlinkProofDescription: (account: string, method: string) => `The “${method}” proof of ${account} will end.`,
    unlinkOAuthKeeps: "Identifiers proven by a two-way link or DNS TXT, the account row and its sharing settings are kept.",
    unlinkProofKeeps: "Other proofs remain, so the account stays verified.",
    unlinkLastProof: "The row and its sharing settings are kept, and it becomes unverified.",
    unlinkDnsScope: "Only the DNS TXT proof of this row is removed. Proofs of other rows on the same host are kept.",
    unlinkConfirm: "Unlink",
    accountUnlinked: "The link was removed.",
    verificationUnlinked: "The proof was removed.",
    methods: {
      oauth: "OAuth",
      bidirectional_link: "Two-way link",
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
        "Public profile URLs of other Freeism Accounts users were also found. Clean up the URLs on the evidence page and verify again.",
    } satisfies Record<VerificationFailureCode, string>,
    errorCodes: {
      URL_LIMIT_REACHED: "You have reached the limit of 150 URLs. Unlink URLs you no longer need before adding more.",
      RATE_LIMITED: "Too many verification requests in a short time. Please wait a moment and try again.",
      OWNERSHIP_CONFLICT: "Another operation on the same external account conflicted. Please try again.",
      LAST_LOGIN_METHOD:
        "You cannot unlink your last sign-in method. Link another Google, GitHub or ORCID account first.",
    } as Partial<Record<string, string>>,
    oauthErrors: {
      account_already_linked_to_different_user:
        "This external account is already linked to another Freeism Accounts user. Unlink it from that user first, then link it again. If it is that user's only sign-in method, add another sign-in method before unlinking, or delete that user.",
    } as Partial<Record<string, string>>,
    oauthErrorFallback: "The external account could not be linked. Please try again.",
  },
});

export type AccountLinksMessages = (typeof accountLinksMessages)["ja"];
