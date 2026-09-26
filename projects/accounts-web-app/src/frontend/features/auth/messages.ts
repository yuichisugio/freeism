import { defineMessages } from "../../lib/i18n/define-messages";

/**
 * ログイン用のダイアログと、ログイン中のユーザーの一覧の文言。
 * @see ../../../../docs/specification/v0.1/main.ja.md
 */
export const authMessages = defineMessages({
  ja: {
    title: "Accountsにログイン",
    description:
      "Google・GitHub・ORCIDのアカウントでログインします。初めての場合は、そのままAccountsユーザーを作成します。",
    signInWith: (providerName: string) => `${providerName}でログイン`,
    redirecting: "移動中…",
    lastUsed: "前回使用",
    startFailed: "ログインを開始できませんでした。時間をおいて再度お試しください。",
    requestExpired:
      "ログインの要求の有効期限が切れました。元のサービスから連携を最初からやり直してください。Accountsだけにログインする場合は、ログイン画面を開き直してください。",
    reopenLoginPage: "ログイン画面を開き直す",
    accountNotLinkedTitle: "この外部アカウントはまだ連携されていません",
    accountNotLinkedDescription:
      "同じメールアドレスのAccountsユーザーが既にあるため、新しいユーザーは作成していません。既存のログイン手段でログインし、「アカウント連携」画面からこの外部アカウントを明示的に連携してください。",
    accountNotLinkedMovedDescription:
      "以前に連携を解除した外部アカウントの場合は、元のAccountsユーザーへ再連携するか、移動先のAccountsユーザーで明示的に連携するか、元のAccountsユーザーを退会してからログインしてください。",
    emailNotFoundTitle: "GitHubからメールアドレスを取得できませんでした",
    emailNotFoundDescription:
      "GitHubアカウントに確認済みのメールアドレスを登録してから再度お試しいただくか、GoogleまたはORCIDでログインしてください。",
    unknownErrorTitle: "ログインできませんでした",
    unknownErrorDescription: (errorCode: string) =>
      `もう一度お試しください。解決しない場合は時間をおいて再度お試しください（エラー: ${errorCode}）。`,
    sessionsTitle: "このブラウザーでログイン中のAccountsユーザー",
    signInAnotherUser: "別のAccountsユーザーでログイン",
    sessionsLoadFailed: "ログイン中のユーザーを読み込めませんでした。",
    accountsUserId: "AccountsユーザーID",
    currentSession: "現在のセッション",
    switchTo: "切り替える",
    switchToLabel: (displayName: string) => `${displayName}に切り替える`,
    switching: "切り替え中…",
    switchFailed: "切り替えられませんでした。画面を再読み込みして再度お試しください。",
    switched: "切り替えました。",
    goToAccountLinks: "アカウント連携へ",
  },
  en: {
    title: "Sign in to Accounts",
    description:
      "Sign in with your Google, GitHub, or ORCID account. If this is your first time, an Accounts user is created for you.",
    signInWith: (providerName: string) => `Sign in with ${providerName}`,
    redirecting: "Redirecting…",
    lastUsed: "Last used",
    startFailed: "Could not start signing in. Please try again later.",
    requestExpired:
      "The sign-in request has expired. Please start the connection again from the original service. To sign in to Accounts only, reopen the sign-in page.",
    reopenLoginPage: "Reopen the sign-in page",
    accountNotLinkedTitle: "This external account is not linked yet",
    accountNotLinkedDescription:
      "An Accounts user with the same email address already exists, so no new user was created. Sign in with your existing sign-in method and link this external account explicitly from the Account links page.",
    accountNotLinkedMovedDescription:
      "If you previously unlinked this external account, link it again to the original Accounts user, link it explicitly from the Accounts user you are moving to, or delete the original Accounts user before signing in.",
    emailNotFoundTitle: "Could not get an email address from GitHub",
    emailNotFoundDescription:
      "Add a verified email address to your GitHub account and try again, or sign in with Google or ORCID.",
    unknownErrorTitle: "Could not sign in",
    unknownErrorDescription: (errorCode: string) =>
      `Please try again. If the problem persists, try again later (error: ${errorCode}).`,
    sessionsTitle: "Accounts users signed in on this browser",
    signInAnotherUser: "Sign in as another Accounts user",
    sessionsLoadFailed: "Could not load the signed-in users.",
    accountsUserId: "Accounts user ID",
    currentSession: "Current session",
    switchTo: "Switch",
    switchToLabel: (displayName: string) => `Switch to ${displayName}`,
    switching: "Switching…",
    switchFailed: "Could not switch. Please reload the page and try again.",
    switched: "Switched.",
    goToAccountLinks: "Go to Account links",
  },
});
