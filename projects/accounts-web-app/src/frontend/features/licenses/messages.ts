import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * OSSライセンス画面の文言。
 * @see ../../../../docs/specification/v0.1/design-system/design-system.ja.md
 */
export const licensesMessages = defineMessages({
  ja: {
    title: "OSSライセンス",
    description: "Freeism Accounts は次のオープンソースソフトウェアを利用しています。",
    notBuilt: "ライセンス一覧はビルド後に表示されます。",
    loadFailed: "ライセンス一覧を読み込めませんでした。画面を再読み込みしてください。",
    empty: "表示するライセンスはありません。",
    tableCaption: "オープンソースソフトウェアとライセンスの一覧",
    packageColumn: "パッケージ",
    versionColumn: "バージョン",
    licenseColumn: "ライセンス",
    linkColumn: "リンク",
    unknownIdentifier: "記載なし",
    showText: "全文を表示",
    opensInNewTab: "（新しいタブで開く）",
  },
  en: {
    title: "Open source licenses",
    description: "Freeism Accounts uses the following open source software.",
    notBuilt: "The license list is available after the app is built.",
    loadFailed: "Could not load the license list. Please reload the page.",
    empty: "There are no licenses to show.",
    tableCaption: "Open source software and licenses",
    packageColumn: "Package",
    versionColumn: "Version",
    licenseColumn: "License",
    linkColumn: "Link",
    unknownIdentifier: "Not specified",
    showText: "Show full text",
    opensInNewTab: "(opens in a new tab)",
  },
});
