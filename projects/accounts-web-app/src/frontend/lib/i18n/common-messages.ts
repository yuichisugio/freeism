import { defineMessages } from "./define-messages";

/**
 * 複数の画面で使う共通の文言。
 */
export const commonMessages = defineMessages({
  ja: {
    loading: "読み込み中…",
    retry: "再読み込み",
    close: "閉じる",
    cancel: "キャンセル",
    save: "保存",
    saving: "保存中…",
    saved: "保存しました。",
    copy: "コピー",
    copied: "コピーしました。",
    copyFailed: "コピーできませんでした。手動で選択してコピーしてください。",
    unauthorized: "ログインが必要です。",
    signIn: "ログインする",
    forbidden: "この操作を行う権限がありません。",
    notFound: "対象が見つかりません。画面を再読み込みしてください。",
    rateLimited: "短時間に操作が集中しました。しばらく待ってから再度お試しください。",
    networkError: "通信に失敗しました。接続を確認して再度お試しください。",
    unexpected: (status: number) => `処理に失敗しました（HTTP ${status}）。時間をおいて再度お試しください。`,
    unexpectedResponse: "サーバーから想定外の応答がありました。時間をおいて再度お試しください。",
    notSet: "未取得",
  },
  en: {
    loading: "Loading…",
    retry: "Reload",
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    copy: "Copy",
    copied: "Copied.",
    copyFailed: "Could not copy. Please select the text and copy it manually.",
    unauthorized: "You need to sign in.",
    signIn: "Sign in",
    forbidden: "You do not have permission for this operation.",
    notFound: "The item was not found. Please reload the page.",
    rateLimited: "Too many requests in a short time. Please wait a moment and try again.",
    networkError: "The request failed. Please check your connection and try again.",
    unexpected: (status: number) => `The operation failed (HTTP ${status}). Please try again later.`,
    unexpectedResponse: "The server returned an unexpected response. Please try again later.",
    notSet: "Not available",
  },
});

export type CommonMessages = (typeof commonMessages)["ja"];
