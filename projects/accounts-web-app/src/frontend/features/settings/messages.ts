import { displayNameMaxLength, urlIdentifierLimitPerUser } from "../../../shared/constants";
import type { RestoreBackupResult } from "../../../shared/schemas/backup-schema";
import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * 「その他」画面の文言。
 * @see ../../../../docs/specification/v0.1/design-system.ja.md
 */
export const settingsMessages = defineMessages({
  ja: {
    title: "その他",
    helpLink: "使い方",
    guestSignInRequired: "ほかの設定を表示するにはログインしてください",

    // 表示名
    displayNameTitle: "表示名",
    displayNameDescription: "公開プロフィールと連携先に表示されます。",
    displayNameCount: (length: number) => `${length} / ${displayNameMaxLength}`,
    displayNameRequired: "表示名を入力してください。",
    displayNameTooLong: `表示名は${displayNameMaxLength}文字以内で入力してください。`,

    // 言語
    languageTitle: "言語",
    languageDescription: "既定はブラウザーの言語です。",

    // テーマ
    themeTitle: "テーマ",
    themeOptions: { system: "システム", light: "ライト", dark: "ダーク" },

    // データ出力
    exportTitle: "データ出力",
    exportDescription: "このサービスに保存したデータを出力します。",
    exportButton: "データ出力",
    exporting: "出力中…",
    exported: "データを出力しました。",

    // データ取込
    importTitle: "データ取込",
    importDescription: "データ出力のファイルか、テンプレート形式の JSON を取り込めます。",
    chooseFile: "ファイルを選択",
    noFileChosen: "選択されていません",
    importButton: "取り込む",
    importing: "取込中…",
    downloadTemplate: "テンプレートをダウンロード",
    copyAiPrompt: "AIに整形を頼む文面をコピー",
    showAiPrompt: "コピーされる文面を見る",
    aiPrompt: (templateText: string) =>
      [
        "添付した他サービスのエクスポートデータを、次のテンプレートと同じ形式の JSON に整形してください。",
        "出力は JSON だけにしてください。",
        "profile.displayName はテンプレートの値のままにしてください。",
        "外部アカウントごとに externalAccounts の要素を1つ作り、URL は metadata.identifiers に https から始まる完全な形で入れてください。",
        "metadata の service・linkedAt・verificationStatus・verifications と isPublic・clientVisibility はテンプレートの値のままにし、URL など識別子だけを差し替えてください。",
        "テンプレートにない項目は追加せず、対応する値がない項目はテンプレートと同じく null か空の配列にしてください。",
        "",
        templateText,
      ].join("\n"),
    restored: (result: RestoreBackupResult) =>
      `取り込みました。公開設定を戻した外部アカウント: ${result.updatedAccountCount}件、登録候補として追加: ${result.addedCandidateCount}件。`,
    restoredCandidateHint: "登録候補は「アカウント連携」画面で所有権を証明すると有効になります。",
    restoreIssuesTitle: "JSONに不備があるため復元できませんでした。次の内容を修正してから再実行してください。",
    issueWholeFile: "ファイル全体",

    // 退会
    deletionTitle: "退会",
    deletionDescription: "Freeism Accounts のデータをすべて削除します。",
    deletionOpenButton: "退会",
    deletionDialogTitle: "退会しますか？",
    deletionDialogDescription: "この操作は取り消せません。必要なら先に「データ出力」で保存してください。",
    deletionConfirmLabel: "確認のため「DELETE」と入力",
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
    title: "Other",
    helpLink: "Guide",
    guestSignInRequired: "Sign in to see the other settings.",

    displayNameTitle: "Display name",
    displayNameDescription: "Shown on your public profile and to connected services.",
    displayNameCount: (length: number) => `${length} / ${displayNameMaxLength}`,
    displayNameRequired: "Enter a display name.",
    displayNameTooLong: `Display name must be ${displayNameMaxLength} characters or fewer.`,

    languageTitle: "Language",
    languageDescription: "Defaults to your browser's language.",

    themeTitle: "Theme",
    themeOptions: { system: "System", light: "Light", dark: "Dark" },

    exportTitle: "Export data",
    exportDescription: "Exports the data you have saved in this service.",
    exportButton: "Export data",
    exporting: "Exporting…",
    exported: "Exported your data.",

    importTitle: "Import data",
    importDescription: "Import an exported file or a JSON file in the template format.",
    chooseFile: "Choose file",
    noFileChosen: "No file chosen",
    importButton: "Import",
    importing: "Importing…",
    downloadTemplate: "Download template",
    copyAiPrompt: "Copy a prompt for AI formatting",
    showAiPrompt: "Show the text to be copied",
    aiPrompt: (templateText: string) =>
      [
        "Convert the attached data exported from another service into JSON in the same format as the template below.",
        "Output only the JSON.",
        "Keep profile.displayName as it is in the template.",
        "Create one element of externalAccounts for each external account, and put its URL in metadata.identifiers as a complete URL starting with https.",
        "Keep service, linkedAt, verificationStatus, and verifications in metadata, as well as isPublic and clientVisibility, as they are in the template, and replace only identifiers such as URLs.",
        "Do not add fields that are not in the template. For fields without a corresponding value, use null or an empty array as in the template.",
        "",
        templateText,
      ].join("\n"),
    restored: (result: RestoreBackupResult) =>
      `Imported. External accounts with restored settings: ${result.updatedAccountCount}, added as candidates: ${result.addedCandidateCount}.`,
    restoredCandidateHint: "Candidates become active after you prove ownership on the Account links page.",
    restoreIssuesTitle: "The JSON file could not be imported. Please fix the following problems and try again.",
    issueWholeFile: "Whole file",

    deletionTitle: "Delete account",
    deletionDescription: "Deletes all of your Freeism Accounts data.",
    deletionOpenButton: "Delete account",
    deletionDialogTitle: "Delete your account?",
    deletionDialogDescription: "This cannot be undone. If needed, save your data with \"Export data\" first.",
    deletionConfirmLabel: 'Type "DELETE" to confirm',
    deletionButton: "Delete account",
    deleting: "Deleting…",

    codeMessages: {
      EXPORT_TOO_LARGE: "The data exceeds the 5 MiB limit and cannot be exported.",
      REQUEST_TOO_LARGE: "The file exceeds the 5 MiB limit.",
      INVALID_JSON: "The file is not valid JSON.",
      URL_LIMIT_REACHED: `Importing would exceed the limit of ${urlIdentifierLimitPerUser} web URLs. Please remove some URLs on the Account links page and try again.`,
      MISSING_REQUIRED_FIELD: "A required field is missing.",
      INVALID_TYPE: "The value has the wrong type.",
      INVALID_VALUE: "The value does not meet the requirements.",
      UNKNOWN_FIELD: "This field is not defined.",
    },
  },
});
