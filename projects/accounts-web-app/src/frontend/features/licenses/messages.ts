import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * OSSライセンス画面の文言。
 */
export const licensesMessages = defineMessages({
  ja: {
    title: "OSSライセンス",
    description: "Accountsの画面に含まれるオープンソースソフトウェアと、そのライセンスです。",
    notBuilt: "ライセンス一覧はビルド後に表示されます。",
    loadFailed: "ライセンス一覧を読み込めませんでした。画面を再読み込みしてください。",
    empty: "表示するライセンスはありません。",
    identifier: "ライセンス",
    unknownIdentifier: "記載なし",
    showText: "全文を表示",
    noText: "パッケージにライセンス全文のファイルがありません。",
  },
  en: {
    title: "Open source licenses",
    description: "Open source software included in the Accounts web app and its licenses.",
    notBuilt: "The license list is available after the app is built.",
    loadFailed: "Could not load the license list. Please reload the page.",
    empty: "There are no licenses to show.",
    identifier: "License",
    unknownIdentifier: "Not specified",
    showText: "Show full text",
    noText: "The package does not include a license file.",
  },
});
