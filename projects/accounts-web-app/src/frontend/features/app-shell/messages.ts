import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * ヘッダー・フッター・共通部品（保存バー・未保存の確認）の文言。
 * @see ../../../../docs/specification/v0.1/design-system/design-system.ja.md
 */
export const appShellMessages = defineMessages({
  ja: {
    appName: "Freeism Accounts",
    mainNavigation: "メインメニュー",
    home: "トップ",
    accountLinks: "アカウント連携",
    other: "その他",
    help: "使い方",
    licenses: "OSSライセンス",
    privacy: "プライバシーポリシー",
    terms: "利用規約",
    unsavedTitle: "保存していない変更があります",
    unsavedDescription: "移動すると、保存していない変更は破棄されます。保存済みの設定は維持されます。",
    discardAndLeave: "変更を破棄して移動",
    keepEditing: "編集に戻る",
    unsavedCount: (count: number) => `未保存 ${count}件`,
    noUnsavedChanges: "未保存の変更なし",
    discard: "破棄",
    notFound: "ページが見つかりません。",
  },
  en: {
    appName: "Freeism Accounts",
    mainNavigation: "Main menu",
    home: "Home",
    accountLinks: "Account links",
    other: "Other",
    help: "Guide",
    licenses: "Open source licenses",
    privacy: "Privacy policy",
    terms: "Terms of use",
    unsavedTitle: "You have unsaved changes",
    unsavedDescription: "If you leave, your unsaved changes will be discarded. Saved settings are kept.",
    discardAndLeave: "Discard changes and leave",
    keepEditing: "Keep editing",
    unsavedCount: (count: number) => `${count} unsaved`,
    noUnsavedChanges: "No changes",
    discard: "Discard",
    notFound: "Page not found.",
  },
});
