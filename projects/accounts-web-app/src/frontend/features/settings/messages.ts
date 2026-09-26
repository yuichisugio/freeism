import { displayNameMaxLength, urlIdentifierLimitPerUser } from "../../../shared/constants";
import type { RestoreBackupResult } from "../../../shared/schemas/backup-schema";
import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * 「設定」画面の文言。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export const settingsMessages = defineMessages({
  ja: {
    title: "設定",

    // 表示言語
    languageTitle: "表示言語",
    languageDescription:
      "画面の表示言語です。選ぶとすぐに切り替わり、このブラウザーに保存します。保存していない場合は、ブラウザーの優先言語が日本語なら日本語、それ以外は英語で表示します。",

    // 表示名
    displayNameTitle: "表示名",
    displayNameDescription: "Accountsのプロフィールに表示する名前です。ほかの人と同じ名前も設定できます。",
    displayNameLabel: "表示名",
    displayNameHint: `${displayNameMaxLength}文字まで`,
    displayNameRequired: "表示名を入力してください。",
    displayNameTooLong: `表示名は${displayNameMaxLength}文字以内で入力してください。`,
    accountsUserId: (accountsUserId: string) => `AccountsユーザーID: ${accountsUserId}`,

    // JSON出力
    exportTitle: "JSON出力",
    exportDescription:
      "表示名、外部アカウントの識別子・表示情報・出力時点の証明状態、一般公開と連携先ごとの情報提供同意・公開設定をJSONで出力します。メールアドレス・トークン・セッションは含みません。",
    exportAccountCount: (count: number, unverifiedCount: number) =>
      `外部アカウント: ${count}件（うち未検証・登録候補 ${unverifiedCount}件）`,
    exportConsentCount: (count: number) => `情報提供同意: ${count}件`,
    exportIncludesPrivateData: "非公開の情報（未検証の登録・非公開の設定・情報提供同意）を含みます。ファイルの取り扱いに注意してください。",
    exportNoPrivateData: "非公開の情報は含みません。",
    exportButton: "JSONを出力",
    exporting: "出力中…",
    exported: "JSONを出力しました。",

    // 復元
    restoreTitle: "復元",
    restoreDescription:
      "出力したJSONファイルから表示名・公開設定・情報提供同意を復元します。所有権を証明していない外部アカウントは登録候補として取り込みます。",
    restoreFileLabel: "バックアップJSONファイル",
    restoreButton: "復元する",
    restoring: "復元中…",
    restored: (result: RestoreBackupResult) =>
      `復元しました。公開設定を戻した外部アカウント: ${result.updatedAccountCount}件、登録候補として追加: ${result.addedCandidateCount}件、情報提供同意: ${result.clientConsentCount}件。`,
    restoredCandidateHint: "登録候補は「アカウント連携」画面で所有権を証明すると有効になります。",
    restoreIssuesTitle: "JSONに不備があるため復元できませんでした。次の内容を修正してから再実行してください。",
    issueWholeFile: "ファイル全体",

    // 退会
    deletionTitle: "退会",
    deletionDescription: "退会すると、Accountsへのログインとセッション、外部アカウントの紐付け、一般公開、OAuthクライアントへの情報提供を終了します。",
    deletionTargetsTitle: "削除するデータ",
    deletionTargets: [
      "プロフィール（表示名）",
      "外部アカウントの情報と紐付け",
      "一般公開・連携先ごとの情報提供同意と公開設定",
      "開発者として登録したOAuthクライアントの設定・公開鍵",
      "ログイン手段・セッション・認可・トークン",
    ],
    deletionClientsTitle: "終了する登録OAuthクライアント",
    deletionNoClients: "登録したOAuthクライアントはありません。",
    deletionConfirm: "内容を確認した",
    deletionButton: "退会する",
    deleting: "退会処理中…",

    // エラーコード
    codeMessages: {
      EXPORT_TOO_LARGE: "出力するデータが上限（5MiB）を超えるため出力できません。",
      REQUEST_TOO_LARGE: "ファイルが上限（5MiB）を超えています。",
      INVALID_JSON: "JSONの構文が正しくありません。",
      URL_LIMIT_REACHED: `復元するとWeb URLが上限（${urlIdentifierLimitPerUser}件）を超えます。「アカウント連携」画面でURLを整理してから再実行してください。`,
      MISSING_REQUIRED_FIELD: "必須の項目がありません。",
      INVALID_TYPE: "値の型が正しくありません。",
      INVALID_VALUE: "値が条件を満たしていません。",
      UNKNOWN_FIELD: "定義されていない項目です。",
    } as Partial<Record<string, string>>,
  },
  en: {
    title: "Settings",

    languageTitle: "Display language",
    languageDescription:
      "The language of these pages. Your choice applies immediately and is saved in this browser. If nothing is saved, Japanese is used when your browser's preferred language is Japanese, and English otherwise.",

    displayNameTitle: "Display name",
    displayNameDescription: "The name shown on your Accounts profile. It does not need to be unique.",
    displayNameLabel: "Display name",
    displayNameHint: `Up to ${displayNameMaxLength} characters`,
    displayNameRequired: "Enter a display name.",
    displayNameTooLong: `Display name must be ${displayNameMaxLength} characters or fewer.`,
    accountsUserId: (accountsUserId: string) => `Accounts user ID: ${accountsUserId}`,

    exportTitle: "Export JSON",
    exportDescription:
      "Exports your display name, the identifiers, display information and verification status of your external accounts, and your public and per-service sharing settings as JSON. Email addresses, tokens and sessions are not included.",
    exportAccountCount: (count: number, unverifiedCount: number) =>
      `External accounts: ${count} (${unverifiedCount} unverified or candidates)`,
    exportConsentCount: (count: number) => `Sharing consents: ${count}`,
    exportIncludesPrivateData:
      "Includes private information (unverified entries, private settings and sharing consents). Handle the file with care.",
    exportNoPrivateData: "Does not include private information.",
    exportButton: "Export JSON",
    exporting: "Exporting…",
    exported: "Exported the JSON file.",

    restoreTitle: "Restore",
    restoreDescription:
      "Restores your display name, visibility settings and sharing consents from an exported JSON file. External accounts whose ownership is not proven are imported as candidates.",
    restoreFileLabel: "Backup JSON file",
    restoreButton: "Restore",
    restoring: "Restoring…",
    restored: (result: RestoreBackupResult) =>
      `Restored. External accounts with restored settings: ${result.updatedAccountCount}, added as candidates: ${result.addedCandidateCount}, sharing consents: ${result.clientConsentCount}.`,
    restoredCandidateHint: "Candidates become active after you prove ownership on the Account links page.",
    restoreIssuesTitle: "The JSON file could not be restored. Please fix the following problems and try again.",
    issueWholeFile: "Whole file",

    deletionTitle: "Delete account",
    deletionDescription:
      "Deleting your account ends sign-in and sessions, external account links, public listing and information sharing with OAuth clients.",
    deletionTargetsTitle: "Data to be deleted",
    deletionTargets: [
      "Profile (display name)",
      "External account information and links",
      "Public listing, sharing consents and per-service visibility settings",
      "OAuth clients you registered as a developer, including their public keys",
      "Sign-in methods, sessions, authorizations and tokens",
    ],
    deletionClientsTitle: "OAuth clients that will be terminated",
    deletionNoClients: "You have not registered any OAuth clients.",
    deletionConfirm: "I have reviewed the above",
    deletionButton: "Delete account",
    deleting: "Deleting…",

    codeMessages: {
      EXPORT_TOO_LARGE: "The data exceeds the 5 MiB limit and cannot be exported.",
      REQUEST_TOO_LARGE: "The file exceeds the 5 MiB limit.",
      INVALID_JSON: "The file is not valid JSON.",
      URL_LIMIT_REACHED: `Restoring would exceed the limit of ${urlIdentifierLimitPerUser} web URLs. Please remove some URLs on the Account links page and try again.`,
      MISSING_REQUIRED_FIELD: "A required field is missing.",
      INVALID_TYPE: "The value has the wrong type.",
      INVALID_VALUE: "The value does not meet the requirements.",
      UNKNOWN_FIELD: "This field is not defined.",
    },
  },
});
