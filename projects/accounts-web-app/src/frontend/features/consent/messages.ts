import type { VerificationMethod } from "../../../shared/schemas/verification-schema";
import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * 同意画面の文言。
 * @see ../../../../docs/specification/v0.1/design-system.ja.md
 */
export const consentMessages = defineMessages({
  ja: {
    title: (client: string) => `${client} が情報の提供を求めています`,
    activeUser: "連携するアカウント",
    serviceUrl: "紹介ページ",
    opensInNewTab: "（新しいタブで開く）",
    redirectHost: "戻り先",
    purpose: ["同意すると、選択した外部アカウントの情報を、連携先へ提供します。", "同意と選択は後から変更できます。"],
    // --------------------------------------------------
    // 選択リスト
    // --------------------------------------------------
    listHeading: "アカウント",
    bulkLabel: (client: string) => `すべての外部アカウントを${client}に公開`,
    rowLabel: (account: string, client: string) => `${account}を${client}に公開`,
    accountSeparator: "：",
    unverified: "未検証",
    methods: { oauth: "OAuth", bidirectional_link: "双方向リンク", dns_txt: "DNS TXT" } satisfies Record<
      VerificationMethod,
      string
    >,
    selectionRequired: (client: string) =>
      `${client}：公開する外部アカウントが選択されていないため、同意できません。証明済みのアカウントを1件以上選択してください。`,
    // --------------------------------------------------
    // 操作と結果
    // --------------------------------------------------
    accept: "同意して戻る",
    deny: "同意しない",
    requestMissing: "連携の要求がありません。元のサービスから連携を開始してください。",
    expired: "連携の要求の有効期限が切れました。元のサービスから連携を最初からやり直してください。",
    failed: "連携の要求を処理できませんでした。期限切れの可能性があるため、元のサービスから連携を最初からやり直してください。",
    clientMissing: "連携先のサービスが見つかりません。元のサービスから連携を最初からやり直してください。",
    rejected: "証明済みのアカウントが選択されていないため、同意できませんでした。画面を再読み込みして、選択を確認してください。",
  },
  en: {
    title: (client: string) => `${client} is requesting access to your information`,
    activeUser: "Account to connect",
    serviceUrl: "Service page",
    opensInNewTab: " (opens in a new tab)",
    redirectHost: "Return to",
    purpose: [
      "If you allow it, information about the selected external accounts is provided to this service.",
      "You can change your consent and selection later.",
    ],
    // --------------------------------------------------
    // 選択リスト
    // --------------------------------------------------
    listHeading: "External accounts",
    bulkLabel: (client: string) => `Share all external accounts with ${client}`,
    rowLabel: (account: string, client: string) => `Share ${account} with ${client}`,
    accountSeparator: ": ",
    unverified: "Unverified",
    methods: { oauth: "OAuth", bidirectional_link: "Two-way link", dns_txt: "DNS TXT" },
    selectionRequired: (client: string) =>
      `${client}: No external account is selected, so you cannot allow sharing. Select at least one verified account.`,
    // --------------------------------------------------
    // 操作と結果
    // --------------------------------------------------
    accept: "Allow and return",
    deny: "Deny",
    requestMissing: "There is no connection request. Please start the connection from the original service.",
    expired: "The request has expired. Please start the connection again from the original service.",
    failed: "The request could not be processed. It may have expired, so please start the connection again from the original service.",
    clientMissing: "The requesting service was not found. Please start the connection again from the original service.",
    rejected: "No verified account was selected, so sharing could not be allowed. Please reload the page and check your selection.",
  },
});
